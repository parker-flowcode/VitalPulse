/**
 * MeasureScreen.js — VitalPulse
 *
 * Usa vision-camera-resize-plugin v3.2.0 para acceder a píxeles de forma
 * compatible con el Oppo Reno 12F (chip MediaTek Helio G99).
 *
 * Por qué useResizePlugin y no toArrayBuffer():
 * - toArrayBuffer() con pixelFormat="yuv" falla en MediaTek porque el buffer
 *   YUV NV21 no es contiguo en memoria en este chip.
 * - El resize plugin usa la API nativa de Android (ImageReader) que sí
 *   funciona correctamente en todos los chips.
 *
 * Canal usado: float32 en lugar de uint8
 * - Con uint8 y pixelFormat='rgb', el Oppo devuelve 255 en todos los bytes
 *   (saturación por la AEC automática del sensor).
 * - Con float32, los valores van de 0.0 a 1.0 y tenemos más precisión.
 * - Multiplicamos por 255 para trabajar en la misma escala que los algoritmos.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Vibration, StatusBar, AppState, useWindowDimensions,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Accelerometer } from 'expo-sensors';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import WaveformChart from '../components/WaveformChart';
import CircularProgress from '../components/CircularProgress';
import useHealthStore from '../store/healthstore';
import { processPPGSignal, detrend, resetKalman, detectRawSaturation, detectFinger } from '../utils/ppgProcessor';
import { estimateBPCalibrated } from '../utils/bpEstimator';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../theme/designTokens';

const MEASURE_DURATION = 60;
const MOTION_THRESHOLD = 0.12;

export default function MeasureScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const fontScale = Math.max(0.85, Math.min(1.15, SCREEN_WIDTH / 390));
  const timerSize = Math.min(150, SCREEN_HEIGHT * 0.18);

  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    { fps: 30 },
    { videoResolution: { width: 640, height: 480 } },
  ]);
  const { hasPermission, requestPermission } = useCameraPermission();

  const { resize } = useResizePlugin();

  const accelSubscription   = useRef(null);
  const isPausedRef        = useRef(false);
  const appStateRef         = useRef(AppState.currentState);
  const isFinalizedRef      = useRef(false);
  const isCapturingRef      = useRef(false);
  const localValuesRef      = useRef([]);
  const timerRef            = useRef(null);
  const workletCallbackRef  = useRef(null);
  // BUG#16: Refs para controlar cada cuánto procesamos (evita reprocesar toda la señal cada vez)
  const lastChartUpdateRef  = useRef(0);
  const lastBPMCheckRef     = useRef(0);
  const lastAutoCancelRef   = useRef(0);

  const isCapturingSV = useSharedValue(false);

  const [isRunning, setIsRunning]         = useState(false);
  const [timeLeft, setTimeLeft]           = useState(MEASURE_DURATION);
  const [displayValues, setDisplayValues] = useState([]);
  const [signalQuality, setSignalQuality] = useState(0);
  const [liveBPM, setLiveBPM]             = useState(0);
  const [motionAlert, setMotionAlert]     = useState(false);
  const [phase, setPhase]                 = useState('idle');
  const [cameraReady, setCameraReady]     = useState(false);
  const cameraReadySV = useSharedValue(false);
  const [frameCount, setFrameCount]       = useState(0);
  const [fingerState, setFingerState]     = useState({ state: 'waiting', message: '' });

  const { calibration, userProfile, settings, addMeasurement } = useHealthStore();

  const hardStopRef = useRef();
  const setIsRunningRef = useRef();
  const setPhaseRef = useRef();
  const resetToIdleRef = useRef();
  const setMotionAlertRef = useRef();
  hardStopRef.current = hardStop;
  setIsRunningRef.current = setIsRunning;
  setPhaseRef.current = setPhase;
  resetToIdleRef.current = resetToIdle;
  setMotionAlertRef.current = setMotionAlert;

  // ─── Recibir valor de luminancia desde el worklet ─────────────────────────
  const receiveFrame = useCallback((val) => {
    if (!isCapturingRef.current || isFinalizedRef.current || val < 0) return;

    const count = localValuesRef.current.length;
    if (count > 0) {
      const prev = localValuesRef.current[count - 1];
      if (prev > 0 && Math.abs(val - prev) / prev > 0.25) {
        localValuesRef.current.push(prev * 0.7 + val * 0.3);
      } else {
        localValuesRef.current.push(val);
      }
    } else {
      localValuesRef.current.push(val);
    }
    const newCount = localValuesRef.current.length;

    if (newCount % 15 === 0) setFrameCount(newCount);

    // Actualizar gráfico cada ~4 frames nuevos (más rápido, menos latencia visual)
    if (newCount - lastChartUpdateRef.current >= 4 && newCount > 5) {
      lastChartUpdateRef.current = newCount;
      const raw = localValuesRef.current.slice(-100);
      const detrended = detrend(raw);
      setDisplayValues(detrended);
    }

    // BPM + finger detection cada ~30 frames nuevos (empezar antes)
    if (newCount - lastBPMCheckRef.current >= 30 && newCount > 30) {
      lastBPMCheckRef.current = newCount;
      const elapsed = MEASURE_DURATION - timeLeft;
      const currentFps = elapsed > 0 ? Math.round(newCount / elapsed) : 19;

      const finger = detectFinger(localValuesRef.current);
      setFingerState(finger);

      if (!finger.fingerPresent) {
        if (finger.state === 'saturated_high') {
          setSignalQuality(0.05);
          setLiveBPM(0);
        } else if (finger.state === 'no_finger') {
          setSignalQuality(0);
          setLiveBPM(0);
        }
        return;
      }

      const partial = processPPGSignal(localValuesRef.current, currentFps);
      if (partial.ready && partial.bpm >= 40 && partial.bpm <= 200) {
        setLiveBPM(partial.bpm);
        setSignalQuality(partial.quality);

        if (partial.quality > 0.6) {
          Vibration.vibrate(50);
        } else if (partial.quality < 0.3) {
          Vibration.vibrate(150);
        }
      }

      // Auto-cancelación cada ~1s de frames nuevos
      if (newCount >= currentFps * 15 && newCount - lastAutoCancelRef.current >= currentFps) {
        lastAutoCancelRef.current = newCount;
        const recent = localValuesRef.current.slice(-currentFps * 5);
        if (recent.length >= currentFps * 3) {
          const check = processPPGSignal(recent, currentFps);
          const currentFinger = detectFinger(recent);

          if (currentFinger.state === 'saturated_high') {
            hardStopRef.current();
            setIsRunningRef.current(false);
            setPhaseRef.current('idle');
            Alert.alert(
              '🔴 Presión excesiva',
              'Estás presionando demasiado fuerte. La sangre se ha desplazado del tejido y el sensor solo ve luz blanca.\n\n• Reduce la presión del dedo sobre la cámara\n• Debes ver un tono rojizo, no blanco',
              [{ text: 'Entendido', onPress: resetToIdleRef.current }]
            );
            return;
          }

          if (check.ready && check.quality < 0.2 && currentFinger.state !== 'saturated_high') {
            hardStopRef.current();
            setIsRunningRef.current(false);
            setPhaseRef.current('idle');
            Alert.alert(
              'Señal demasiado débil',
              'La calidad de la señal es muy baja durante más de 5 segundos.\n• Cubre completamente la cámara y el flash con el dedo\n• Ajusta la presión del dedo',
              [{ text: 'Entendido', onPress: resetToIdleRef.current }]
            );
          }
        }
      }
    }
  }, []);

  useEffect(() => {
    workletCallbackRef.current = Worklets.createRunOnJS(receiveFrame);
  }, [receiveFrame]);

  // ─── Frame Processor ──────────────────────────────────────────────────
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (!isCapturingSV.value || !cameraReadySV.value) return;
    if (workletCallbackRef.current == null) return;

    try {
      const resized = resize(frame, {
        scale:       { width: 16, height: 16 },
        pixelFormat: 'rgb',
        dataType:    'float32',
      });
      let sum = 0, count = 0;
      for (let i = 0; i < resized.length; i += 3) {
        sum += resized[i];
        count++;
      }
      if (count > 0) {
        workletCallbackRef.current((sum / count) * 255);
      }
    } catch {
      try {
        const raw = frame.toArrayBuffer('rgb');
        let sum = 0, count = 0;
        for (let i = 0; i < raw.length; i += 3) {
          sum += raw[i];
          count++;
        }
        if (count > 0) {
          workletCallbackRef.current(sum / count);
        }
      } catch {}
    }
  }, [isCapturingSV, resize, cameraReadySV]);

  // ─── AppState / cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current === 'active' && next.match(/inactive|background/)) hardStop();
      appStateRef.current = next;
    });
    return () => { sub.remove(); hardStop(); };
  }, []);

  useEffect(() => {
    return () => {
      try {
        if (accelSubscription.current) {
          accelSubscription.current.remove();
        }
      } catch (e) {}
      accelSubscription.current = null;
    };
  }, []);

  const hardStop = () => {
    isCapturingSV.value    = false;
    isCapturingRef.current = false;
    clearInterval(timerRef.current);
    timerRef.current = null;
    Vibration.cancel();
    accelSubscription.current?.remove();
    accelSubscription.current = null;
  };

  const startAccelerometer = () => {
    try {
      if (!Accelerometer || typeof Accelerometer.addListener !== 'function') {
        console.warn('[Accelerometer] Módulo no disponible');
        return;
      }
      Accelerometer.setUpdateInterval(300);
      let lx = 0, ly = 0, lz = 1, init = false;
      accelSubscription.current = Accelerometer.addListener(({ x, y, z }) => {
        if (!init) { lx = x; ly = y; lz = z; init = true; return; }
        const delta = Math.abs(x - lx) + Math.abs(y - ly) + Math.abs(z - lz);
        if (delta > MOTION_THRESHOLD) {
          if (!isPausedRef.current && isCapturingRef.current) {
            isPausedRef.current = true;
            isCapturingSV.value = false;
            setMotionAlert(true);
          }
        } else {
          if (isPausedRef.current && isCapturingRef.current) {
            isPausedRef.current = false;
            isCapturingSV.value = true;
            setMotionAlert(false);
          }
        }
        lx = x; ly = y; lz = z;
      });
    } catch (e) {
      console.warn('[Accelerometer] Error:', e.message);
    }
  };

  // ─── Iniciar medición ─────────────────────────────────────────────────────
  const startMeasurement = () => {
    if (!cameraReady) {
      Alert.alert('Cámara no lista', 'Espera un momento y vuelve a intentarlo.');
      return;
    }

    resetKalman();

    localValuesRef.current = [];
    isFinalizedRef.current = false;
    isCapturingRef.current = false;
    isCapturingSV.value    = false;
    // Resetear contadores de procesamiento
    lastChartUpdateRef.current = 0;
    lastBPMCheckRef.current = 0;
    lastAutoCancelRef.current = 0;
    setDisplayValues([]);
    setLiveBPM(0);
    setSignalQuality(0);
    setFrameCount(0);
    setTimeLeft(MEASURE_DURATION);
    setPhase('preparing');

    setIsRunning(true);
    setTimeout(() => {
      if (isFinalizedRef.current) return;

      setPhase('measuring');

      setTimeout(() => {
        isCapturingRef.current = true;
        isCapturingSV.value    = true;
        startAccelerometer();
        Vibration.vibrate(200);
      }, 200);

      let elapsed = 0;
      timerRef.current = setInterval(() => {
        elapsed++;
        setTimeLeft(Math.max(0, MEASURE_DURATION - elapsed));

        if (elapsed >= MEASURE_DURATION && !isFinalizedRef.current) {
          isFinalizedRef.current = true;
          clearInterval(timerRef.current);
          timerRef.current = null;
          finalizeMeasurement();
        }
      }, 1000);
    }, 1500);
  };

  // ─── Finalizar ────────────────────────────────────────────────────────────
  const finalizeMeasurement = () => {
    isCapturingRef.current = false;
    isCapturingSV.value    = false;
    hardStop();
    setIsRunning(false);
    setPhase('processing');
    Vibration.vibrate(200);
    setTimeout(() => Vibration.vibrate(200), 350);

    setTimeout(() => {
      const values = [...localValuesRef.current];

      const MIN_FRAMES = 95;
      if (values.length < MIN_FRAMES) {
        setPhase('idle');
        Alert.alert(
          'Señal insuficiente',
          `Solo se capturaron ${values.length} frames (mínimo ${MIN_FRAMES}).\nCubre completamente la cámara y el flash con el dedo.`,
          [{ text: 'Reintentar', onPress: resetToIdle }]
        );
        return;
      }

      const satInfo = detectRawSaturation(values);
      if (satInfo.state !== 'ok') {
        setPhase('idle');
        const msg = satInfo.state === 'saturated_high'
          ? '🔴 La señal está saturada por exceso de luz.\n• Estás presionando demasiado fuerte\n• El dedo debe verse rojizo, no blanco'
          : '🌑 La señal está demasiado oscura.\n• Cubre completamente la cámara trasera\n• Asegúrate de que el flash esté encendido';
        Alert.alert('Señal no válida', msg, [{ text: 'Reintentar', onPress: resetToIdle }]);
        return;
      }

      const realFPS = Math.max(10, Math.round(values.length / MEASURE_DURATION));
      const result  = processPPGSignal(values, realFPS || 19);

      if (!result.ready || result.bpm < 40 || result.bpm > 200) {
        setPhase('idle');
        Alert.alert(
          'Lectura no válida',
          `BPM: ${result.bpm || 0}\n\n• Cubre bien la cámara y el flash\n• No aprietes demasiado el dedo\n• Mantén el móvil quieto`,
          [{ text: 'Reintentar', onPress: resetToIdle }]
        );
        return;
      }

      const bp = estimateBPCalibrated(
        result.morphology, result.bpm, calibration, userProfile, result.sdnn || 0,
        settings.preferRegression ?? true,
        result.quality || 0
      );

      const measurement = {
        bpm: result.bpm, bpmFFT: result.bpmFFT, bpmPeaks: result.bpmPeaks,
        bp, quality: result.quality, confidence: result.confidence,
        rrIntervals: result.rrIntervals || [], sdnn: result.sdnn || 0,
        signalLength: values.length,
        snr: result.snr,
        saturated: result.saturated,
        stability: result.stability,
      };

      addMeasurement(measurement)
        .then(() => navigation.navigate('Results', { measurement }))
        .catch(() => navigation.navigate('Results', { measurement }));
      localValuesRef.current = [];
    }, 400);
  };

  const stopMeasurement = (goBack = true) => {
    isFinalizedRef.current = true;
    hardStop();
    setIsRunning(false);
    setPhase('idle');
    if (goBack && navigation.canGoBack()) navigation.goBack();
  };

  const resetToIdle = () => {
    localValuesRef.current = [];
    isFinalizedRef.current = false;
    isCapturingRef.current = false;
    isCapturingSV.value    = false;
    lastChartUpdateRef.current = 0;
    lastBPMCheckRef.current = 0;
    lastAutoCancelRef.current = 0;
    setDisplayValues([]);
    setLiveBPM(0);
    setSignalQuality(0);
    setFrameCount(0);
    setTimeLeft(MEASURE_DURATION);
    setPhase('idle');
    setMotionAlert(false);
    setFingerState({ state: 'waiting', message: '' });
  };

  // ─── Computed values for theming ──────────────────────────────────────────
  const isDark = phase === 'preparing' || phase === 'measuring';
  const containerBg = isDark ? COLORS.darkBg : phase === 'processing' ? COLORS.bg : COLORS.bg;
  const headerTextColor = isDark ? COLORS.darkText : COLORS.textPrimary;
  const closeColor = isDark ? COLORS.darkMuted : COLORS.textMuted;
  const timerTextColor = isDark ? COLORS.darkText : COLORS.textPrimary;
  const timerLabelColor = isDark ? COLORS.darkMuted : COLORS.textMuted;
  const circularTrackColor = isDark ? COLORS.darkCard : COLORS.border;

  // ─── Calidad de señal ─────────────────────────────────────────────────────
  const qualityColor = signalQuality > 0.6
    ? COLORS.success
    : signalQuality > 0.3
      ? COLORS.warning
      : COLORS.danger;
  const qualityLabel = signalQuality > 0.6
    ? 'Señal buena'
    : signalQuality > 0.3
      ? 'Señal regular'
      : 'Señal débil';

  // ─── Estilos dinámicos responsivos ────────────────────────────────────────
  const bottomAreaStyle = {
    padding: 20,
    paddingBottom: insets.bottom + 16,
    marginBottom: 60,
  };

  const startBtnStyle = {
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 16,
    ...SHADOWS.elevated,
  };

  const stopBtnStyle = {
    backgroundColor: 'transparent',
    borderRadius: 28,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: COLORS.danger + '99',
  };

  const waveformWidth = SCREEN_WIDTH - 32;
  const waveformHeight = Math.min(90, SCREEN_HEIGHT * 0.12);

  // ─── Permisos ─────────────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <View style={styles.center}>
          <Text style={styles.permIcon}>📷</Text>
          <Text style={[styles.permTitle, { fontSize: Math.round(20 * fontScale) }]}>
            Cámara requerida
          </Text>
          <Text style={styles.permText}>
            VitalPulse necesita la cámara trasera para medir tu pulso.
          </Text>
          <TouchableOpacity style={styles.startBtn} onPress={requestPermission}>
            <Text style={styles.startBtnText}>Conceder permiso</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.bg }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <Text style={[styles.permText, { color: COLORS.textSecondary }]}>
          Cámara trasera no disponible.
        </Text>
      </View>
    );
  }

  if (phase === 'processing') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <View style={styles.center}>
          <Text style={styles.processingIcon}>🫀</Text>
          <Text style={[styles.processingTitle, { fontSize: Math.round(22 * fontScale) }]}>
            Analizando señal...
          </Text>
          <Text style={styles.processingSubtitle}>
            Procesando {frameCount} frames con FFT
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Renderizado principal ───────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: containerBg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={containerBg}
      />
      <Camera
        style={styles.hiddenCamera}
        device={device}
        // BUG#21: Cámara solo activa cuando se necesita (ahorra batería significativamente)
        isActive={phase === 'preparing' || phase === 'measuring' || phase === 'processing'}
        format={format}
        fps={format?.maxFps ? Math.min(30, format.maxFps) : 30}
        torch={isRunning || phase === 'preparing' ? 'on' : 'off'}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
        photo={false}
        video={false}
        enableZoomGesture={false}
        onInitialized={() => { setCameraReady(true); cameraReadySV.value = true; }}
        onError={(e) => console.warn('[Camera] Error:', e.message)}
      />

      <SafeAreaView style={styles.overlay}>
        {/* ── Cabecera ── */}
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={[styles.headerTitle, { color: headerTextColor, fontSize: Math.round(17 * fontScale) }]}>
            Midiendo pulso
          </Text>
          <TouchableOpacity
            onPress={() => stopMeasurement(true)}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.closeBtnText, { color: closeColor }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* ── Timer ── */}
        <View style={styles.timerContainer}>
          <View style={[styles.circularTimerWrapper, { width: timerSize, height: timerSize, borderRadius: timerSize / 2 }]}>
            <CircularProgress
              size={timerSize}
              strokeWidth={6}
              progress={1 - timeLeft / MEASURE_DURATION}
              color={qualityColor}
              bgColor={circularTrackColor}
            />
            <View style={styles.circularTimerInner}>
              <Text style={[styles.timer, { color: timerTextColor, fontSize: Math.round(42 * fontScale), lineHeight: Math.round(44 * fontScale) }]}>
                {timeLeft}
              </Text>
              <Text style={[styles.timerLabel, { color: timerLabelColor, fontSize: Math.round(12 * fontScale) }]}>
                segundos
              </Text>
            </View>
          </View>
        </View>

        {/* ── Fase: Idle ── */}
        {phase === 'idle' && (
          <View style={styles.instructionsCard}>
            <Text style={[styles.instructionsTitle, { fontSize: Math.round(17 * fontScale) }]}>
              Cómo medir correctamente
            </Text>

            <View style={styles.stepRow}>
              <Text style={styles.stepIcon}>👆</Text>
              <Text style={styles.stepText}>
                Coloca el dedo índice cubriendo completamente la cámara trasera y el flash.
              </Text>
            </View>

            <View style={styles.stepRow}>
              <Text style={styles.stepIcon}>💡</Text>
              <Text style={styles.stepText}>
                El flash se encenderá — es normal y necesario.
              </Text>
            </View>

            <View style={styles.stepRow}>
              <Text style={styles.stepIcon}>🤫</Text>
              <Text style={styles.stepText}>
                Presiona suavemente. Sin apretar en exceso.
              </Text>
            </View>

            <View style={styles.stepRow}>
              <Text style={styles.stepIcon}>🧘</Text>
              <Text style={styles.stepText}>
                Apoya el codo y mantén el móvil completamente quieto.
              </Text>
            </View>

            {!cameraReady && (
              <Text style={styles.cameraLoading}>⏳ Iniciando cámara...</Text>
            )}
          </View>
        )}

        {/* ── Fase: Preparando ── */}
        {phase === 'preparing' && (
          <View style={styles.prepCard}>
            <Text style={styles.prepIcon}>👆</Text>
            <Text style={[styles.prepText, { fontSize: Math.round(22 * fontScale) }]}>
              Coloca el dedo ahora...
            </Text>
            <Text style={styles.prepSub}>
              Cubre completamente la cámara trasera y el flash
            </Text>
          </View>
        )}

        {/* ── Fase: Midiendo ── */}
        {phase === 'measuring' && (
          <View style={styles.measuringContainer}>
            {/* Waveform */}
            <View style={styles.waveformContainer}>
              <WaveformChart data={displayValues} width={waveformWidth} height={waveformHeight} />
            </View>

            {/* BPM en vivo */}
            <View style={styles.liveBPMContainer}>
              <Text style={[styles.liveBPM, { fontSize: Math.round(56 * fontScale) }]}>
                {liveBPM > 0 ? liveBPM : '---'}
              </Text>
              <Text style={[styles.liveBPMLabel, { fontSize: Math.round(12 * fontScale) }]}>
                {liveBPM > 0 ? 'BPM detectado' : 'Detectando...'}
              </Text>
            </View>

            {/* Indicadores de calidad */}
            <View style={styles.qualityBlock}>
              <View style={styles.qualityRow}>
                <View style={[styles.qualityDot, { backgroundColor: qualityColor }]} />
                <Text style={[styles.qualityText, { color: qualityColor }]}>
                  {qualityLabel}
                </Text>
                <View style={styles.qualityDotRightGroup}>
                  <View style={[
                    styles.qualityDotSmall,
                    { backgroundColor: signalQuality > 0.3 ? qualityColor : COLORS.darkMuted },
                  ]} />
                  <View style={[
                    styles.qualityDotSmall,
                    { backgroundColor: signalQuality > 0.6 ? qualityColor : COLORS.darkMuted },
                  ]} />
                  <View style={[
                    styles.qualityDotSmall,
                    { backgroundColor: signalQuality > 0.8 ? qualityColor : COLORS.darkMuted },
                  ]} />
                  <View style={[
                    styles.qualityDotSmall,
                    { backgroundColor: signalQuality > 0.95 ? qualityColor : COLORS.darkMuted },
                  ]} />
                </View>
              </View>
              <View style={styles.qualityBar}>
                <View style={[
                  styles.qualityFill,
                  {
                    width: `${Math.round(signalQuality * 100)}%`,
                    backgroundColor: qualityColor,
                  },
                ]} />
              </View>
              <Text style={styles.frameCountText}>
                {frameCount} frames capturados
              </Text>
            </View>

            {/* Alerta de movimiento */}
            {motionAlert && (
              <View style={styles.motionAlert}>
                <Text style={styles.motionAlertText}>
                  ⚠️ Movimiento — mantén quieto el móvil
                </Text>
              </View>
            )}

            {/* Alerta de dedo */}
            {fingerState.state !== 'waiting' && fingerState.state !== 'valid' && (
              <View style={[
                styles.fingerAlert,
                fingerState.state === 'saturated_high' && styles.fingerAlertSaturated,
                fingerState.state === 'no_finger' && styles.fingerAlertDark,
                fingerState.state === 'low_ac' && styles.fingerAlertNoFinger,
              ]}>
                <Text style={styles.fingerAlertText}>
                  {fingerState.state === 'saturated_high'
                    ? '🔴 Presión excesiva — reduce la fuerza'
                    : fingerState.state === 'no_finger'
                      ? '🌑 Señal muy oscura — cubre bien la cámara'
                      : fingerState.state === 'low_ac'
                        ? '⚠️ Señal plana — ajusta la presión del dedo'
                        : fingerState.message}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Área inferior ── */}
        <View style={[styles.bottomArea, bottomAreaStyle]}>
          {phase === 'idle' && (
            <TouchableOpacity
              style={[startBtnStyle, !cameraReady && styles.startBtnDisabled]}
              onPress={startMeasurement}
              disabled={!cameraReady}
            >
              <Text style={[styles.startBtnText, { fontSize: Math.round(18 * fontScale) }]}>
                {cameraReady ? 'Iniciar medición' : '⏳ Iniciando cámara...'}
              </Text>
            </TouchableOpacity>
          )}
          {(phase === 'measuring' || phase === 'preparing') && (
            <TouchableOpacity style={stopBtnStyle} onPress={() => stopMeasurement(true)}>
              <Text style={[styles.stopBtnText, { fontSize: Math.round(16 * fontScale) }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          )}
          <Text style={styles.legalNote}>
            ⚠️ Esta app no es un dispositivo médico. Consulte a su médico.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Contenedor principal
  container: {
    flex: 1,
  },
  hiddenCamera: {
    position: 'absolute',
    top: -9999,
    left: 0,
    width: 120,
    height: 120,
  },
  overlay: {
    flex: 1,
  },

  // Safe area + centro
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.bg,
  },

  // Permisos
  permIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  permTitle: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: 12,
  },
  permText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },

  // Processing
  processingIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  processingTitle: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: 10,
  },
  processingSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Cabecera
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontWeight: '600',
    textAlign: 'center',
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  closeBtnText: {
    fontSize: 20,
    fontWeight: '600',
  },

  // Timer circular
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  circularTimerWrapper: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  circularTimerInner: {
    position: 'absolute',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timer: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    marginTop: 2,
  },

  // Instrucciones (idle)
  instructionsCard: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  instructionsTitle: {
    color: COLORS.primary,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 10,
  },
  stepIcon: {
    fontSize: 18,
    width: 26,
    textAlign: 'center',
    lineHeight: 22,
  },
  stepText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  cameraLoading: {
    color: COLORS.warning,
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },

  // Preparando
  prepCard: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: COLORS.darkCard,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: `${COLORS.warning}44`,
    alignItems: 'center',
  },
  prepIcon: {
    fontSize: 52,
    marginBottom: 12,
  },
  prepText: {
    color: COLORS.warning,
    fontWeight: '700',
  },
  prepSub: {
    color: COLORS.darkMuted,
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Midiendo
  measuringContainer: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  waveformContainer: {
    backgroundColor: COLORS.darkCard,
    borderRadius: 16,
    padding: 0,
    marginBottom: 16,
    borderWidth: 0,
    overflow: 'hidden',
  },
  liveBPMContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  liveBPM: {
    color: COLORS.primaryLight,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  liveBPMLabel: {
    color: COLORS.darkMuted,
    marginTop: 2,
  },

  // Calidad
  qualityBlock: {
    backgroundColor: COLORS.darkCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 0,
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qualityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  qualityText: {
    fontSize: 13,
    fontWeight: '600',
    width: 100,
  },
  qualityDotRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  qualityDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  qualityBar: {
    height: 4,
    backgroundColor: COLORS.darkBg,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 10,
  },
  qualityFill: {
    height: '100%',
    borderRadius: 2,
  },
  frameCountText: {
    color: COLORS.darkMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },

  // Alertas
  motionAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.dangerLight + '33',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.danger + '44',
  },
  motionAlertText: {
    color: COLORS.danger,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  fingerAlert: {
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
  },
  fingerAlertSaturated: {
    backgroundColor: COLORS.dangerLight + '33',
    borderColor: COLORS.danger + '44',
  },
  fingerAlertDark: {
    backgroundColor: COLORS.darkCard,
    borderColor: COLORS.darkBorder,
  },
  fingerAlertNoFinger: {
    backgroundColor: COLORS.warningLight + '33',
    borderColor: COLORS.warning + '44',
  },
  fingerAlertText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
    color: COLORS.warning,
  },

  // Área inferior
  bottomArea: {
    // padding, paddingBottom, marginBottom se establecen dinámicamente
  },

  // Botón de inicio (estilo base — padding y margin se aplican dinámicamente)
  startBtnDisabled: {
    opacity: 0.6,
  },
  startBtnText: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
  },

  // Botón cancelar (estilo base)
  stopBtnText: {
    color: COLORS.danger,
    fontWeight: '600',
  },

  // Nota legal
  legalNote: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
