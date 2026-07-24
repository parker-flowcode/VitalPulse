/**
 * MeasureScreen.js — VitalPulse
 *
 * Usa vision-camera-resize-plugin v3.2.0 para acceder a pixeles de forma
 * compatible con el Oppo Reno 12F (chip MediaTek Helio G99).
 *
 * Por que useResizePlugin y no toArrayBuffer():
 * - toArrayBuffer() con pixelFormat="yuv" falla en MediaTek porque el buffer
 *   YUV NV21 no es contiguo en memoria en este chip.
 * - El resize plugin usa la API nativa de Android (ImageReader) que si
 *   funciona correctamente en todos los chips.
 *
 * Canal usado: float32 en lugar de uint8
 * - Con uint8 y pixelFormat='rgb', el Oppo devuelve 255 en todos los bytes
 *   (saturacion por la AEC automatica del sensor).
 * - Con float32, los valores van de 0.0 a 1.0 y tenemos mas precision.
 * - Multiplicamos por 255 para trabajar en la misma escala que los algoritmos.
 *
 * v5.1: Siempre modo claro (blanco). Tema extraido de ThemeContext.
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
import { SPACING, RADIUS, SHADOWS } from '../theme/designTokens';
import { useTheme } from '../theme/ThemeContext';

const MEASURE_DURATION = 60;
const MOTION_THRESHOLD = 0.12;
const PREP_DELAY = 1000;        // v5.1: reducido de 1500ms a 1000ms
const CAPTURE_START_DELAY = 200;
const CHART_UPDATE_INTERVAL = 2;    // v5.1: cada 2 frames (era 4)
const BPM_CHECK_INTERVAL = 10;      // v5.1: cada 10 frames (era 30)

export default function MeasureScreen({ navigation }) {
  const { colors } = useTheme();

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

  const accelSubscription      = useRef(null);
  const isPausedRef            = useRef(false);
  const appStateRef            = useRef(AppState.currentState);
  const isFinalizedRef         = useRef(false);
  const isCapturingRef         = useRef(false);
  const localValuesRef         = useRef([]);
  const timerRef               = useRef(null);
  const workletCallbackRef     = useRef(null);
  const lastChartUpdateRef     = useRef(0);
  const lastBPMCheckRef        = useRef(0);
  const lastAutoCancelRef      = useRef(0);

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

    // v5.1: Actualizar grafico cada 2 frames (mas rapido, menos latencia)
    if (newCount - lastChartUpdateRef.current >= CHART_UPDATE_INTERVAL && newCount > 5) {
      lastChartUpdateRef.current = newCount;
      const raw = localValuesRef.current.slice(-100);
      const detrended = detrend(raw);
      setDisplayValues(detrended);
    }

    // v5.1: BPM + finger detection cada 10 frames (empezar antes)
    if (newCount - lastBPMCheckRef.current >= BPM_CHECK_INTERVAL && newCount > 30) {
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

      // Auto-cancelacion cada ~1s de frames nuevos
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
              'Presion excesiva',
              'Estas presionando demasiado fuerte. La sangre se ha desplazado del tejido y el sensor solo ve luz blanca.\n\nReduce la presion del dedo sobre la camara\nDebes ver un tono rojizo, no blanco',
              [{ text: 'Entendido', onPress: resetToIdleRef.current }]
            );
            return;
          }

          if (check.ready && check.quality < 0.2 && currentFinger.state !== 'saturated_high') {
            hardStopRef.current();
            setIsRunningRef.current(false);
            setPhaseRef.current('idle');
            Alert.alert(
              'Senal demasiado debil',
              'La calidad de la senal es muy baja durante mas de 5 segundos.\nCubre completamente la camara y el flash con el dedo\nAjusta la presion del dedo',
              [{ text: 'Entendido', onPress: resetToIdleRef.current }]
            );
          }
        }
      }
    }
  }, [timeLeft]);

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
        console.warn('[Accelerometer] Modulo no disponible');
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

  // ─── Iniciar medicion ─────────────────────────────────────────────────────
  const startMeasurement = () => {
    if (!cameraReady) {
      Alert.alert('Camara no lista', 'Espera un momento y vuelve a intentarlo.');
      return;
    }

    resetKalman();

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
    setPhase('preparing');

    setIsRunning(true);
    // v5.1: Delay de preparacion reducido a 1000ms
    setTimeout(() => {
      if (isFinalizedRef.current) return;

      setPhase('measuring');

      setTimeout(() => {
        isCapturingRef.current = true;
        isCapturingSV.value    = true;
        startAccelerometer();
        Vibration.vibrate(200);
      }, CAPTURE_START_DELAY);

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
    }, PREP_DELAY);
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
          'Senal insuficiente',
          `Solo se capturaron ${values.length} frames (minimo ${MIN_FRAMES}).\nCubre completamente la camara y el flash con el dedo.`,
          [{ text: 'Reintentar', onPress: resetToIdle }]
        );
        return;
      }

      const satInfo = detectRawSaturation(values);
      if (satInfo.state !== 'ok') {
        setPhase('idle');
        const msg = satInfo.state === 'saturated_high'
          ? 'La senal esta saturada por exceso de luz.\nEstas presionando demasiado fuerte\nEl dedo debe verse rojizo, no blanco'
          : 'La senal esta demasiado oscura.\nCubre completamente la camara trasera\nAsegurate de que el flash este encendido';
        Alert.alert('Senal no valida', msg, [{ text: 'Reintentar', onPress: resetToIdle }]);
        return;
      }

      const realFPS = Math.max(10, Math.round(values.length / MEASURE_DURATION));
      const result  = processPPGSignal(values, realFPS || 19);

      if (!result.ready || result.bpm < 40 || result.bpm > 200) {
        setPhase('idle');
        Alert.alert(
          'Lectura no valida',
          `BPM: ${result.bpm || 0}\n\nCubre bien la camara y el flash\nNo aprietes demasiado el dedo\nManten el movil quieto`,
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

  // ─── Calidad de senal ─────────────────────────────────────────────────────
  const qualityColor = signalQuality > 0.6
    ? colors.success
    : signalQuality > 0.3
      ? colors.warning
      : colors.danger;
  const qualityLabel = signalQuality > 0.6
    ? 'Senal buena'
    : signalQuality > 0.3
      ? 'Senal regular'
      : 'Senal debil';

  // ─── Estilos dinamicos responsivos ────────────────────────────────────────
  const bottomAreaStyle = {
    padding: 20,
    paddingBottom: insets.bottom + 16,
    marginBottom: 60,
  };

  const startBtnStyle = {
    backgroundColor: colors.primary,
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
    borderColor: colors.danger + '99',
  };

  const waveformWidth = SCREEN_WIDTH - 32;
  const waveformHeight = Math.min(90, SCREEN_HEIGHT * 0.12);

  // ─── Permisos ─────────────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <View style={[styles.center, { backgroundColor: colors.bg }]}>
          <Text style={styles.permIcon}>📷</Text>
          <Text style={[styles.permTitle, { color: colors.textPrimary, fontSize: Math.round(20 * fontScale) }]}>
            Camara requerida
          </Text>
          <Text style={[styles.permText, { color: colors.textSecondary }]}>
            VitalPulse necesita la camara trasera para medir tu pulso.
          </Text>
          <TouchableOpacity style={[styles.startBtn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
            <Text style={[styles.startBtnText, { color: colors.textOnPrimary }]}>Conceder permiso</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <Text style={[styles.permText, { color: colors.textSecondary }]}>
          Camara trasera no disponible.
        </Text>
      </View>
    );
  }

  if (phase === 'processing') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <View style={[styles.center, { backgroundColor: colors.bg }]}>
          <Text style={styles.processingIcon}>🫀</Text>
          <Text style={[styles.processingTitle, { color: colors.textPrimary, fontSize: Math.round(22 * fontScale) }]}>
            Analizando senal...
          </Text>
          <Text style={[styles.processingSubtitle, { color: colors.textSecondary }]}>
            Procesando {frameCount} frames con FFT
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Renderizado principal ───────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.bg}
      />
      <Camera
        style={styles.hiddenCamera}
        device={device}
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
          <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: Math.round(17 * fontScale) }]}>
            Midiendo pulso
          </Text>
          <TouchableOpacity
            onPress={() => stopMeasurement(true)}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* ── Timer circular ── */}
        <View style={styles.timerContainer}>
          <View style={[styles.circularTimerWrapper, { width: timerSize, height: timerSize, borderRadius: timerSize / 2 }]}>
            <CircularProgress
              size={timerSize}
              strokeWidth={6}
              progress={1 - timeLeft / MEASURE_DURATION}
              // v5.1: Siempre azul (#2563EB) sobre gris (#E2E8F0)
              color={colors.primary}
              bgColor={colors.border}
            />
            <View style={styles.circularTimerInner}>
              <Text style={[styles.timer, { color: colors.textPrimary, fontSize: Math.round(42 * fontScale), lineHeight: Math.round(44 * fontScale) }]}>
                {timeLeft}
              </Text>
              <Text style={[styles.timerLabel, { color: colors.textMuted, fontSize: Math.round(12 * fontScale) }]}>
                segundos
              </Text>
            </View>
          </View>
        </View>

        {/* ── Fase: Idle ── */}
        {phase === 'idle' && (
          <View style={[styles.instructionsCard, {
            backgroundColor: colors.bgCard,
            borderColor: colors.border,
          }]}>
            <Text style={[styles.instructionsTitle, { color: colors.primary, fontSize: Math.round(17 * fontScale) }]}>
              Como medir correctamente
            </Text>

            <View style={styles.stepRow}>
              <Text style={styles.stepIcon}>👆</Text>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                Coloca el dedo indice cubriendo completamente la camara trasera y el flash.
              </Text>
            </View>

            <View style={styles.stepRow}>
              <Text style={styles.stepIcon}>💡</Text>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                El flash se encendera es normal y necesario.
              </Text>
            </View>

            <View style={styles.stepRow}>
              <Text style={styles.stepIcon}>🤫</Text>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                Presiona suavemente. Sin apretar en exceso.
              </Text>
            </View>

            <View style={styles.stepRow}>
              <Text style={styles.stepIcon}>🧘</Text>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                Apoya el codo y mantén el movil completamente quieto.
              </Text>
            </View>

            {!cameraReady && (
              <Text style={[styles.cameraLoading, { color: colors.warning }]}>
                ⏳ Iniciando camara...
              </Text>
            )}
          </View>
        )}

        {/* ── Fase: Preparando ── */}
        {phase === 'preparing' && (
          <View style={[styles.prepCard, {
            backgroundColor: colors.bgCard,
            borderColor: colors.warning + '44',
          }]}>
            <Text style={styles.prepIcon}>👆</Text>
            <Text style={[styles.prepText, { color: colors.warning, fontSize: Math.round(22 * fontScale) }]}>
              Coloca el dedo ahora...
            </Text>
            <Text style={[styles.prepSub, { color: colors.textMuted }]}>
              Cubre completamente la camara trasera y el flash
            </Text>
          </View>
        )}

        {/* ── Fase: Midiendo ── */}
        {phase === 'measuring' && (
          <View style={styles.measuringContainer}>
            {/* Waveform en card clara #F8F9FA */}
            <View style={[styles.waveformContainer, { backgroundColor: colors.bgCard }]}>
              <WaveformChart data={displayValues} width={waveformWidth} height={waveformHeight} />
            </View>

            {/* BPM en vivo */}
            <View style={styles.liveBPMContainer}>
              <Text style={[styles.liveBPM, { color: colors.primaryLight, fontSize: Math.round(56 * fontScale) }]}>
                {liveBPM > 0 ? liveBPM : '---'}
              </Text>
              <Text style={[styles.liveBPMLabel, { color: colors.textMuted, fontSize: Math.round(12 * fontScale) }]}>
                {liveBPM > 0 ? 'BPM detectado' : 'Detectando...'}
              </Text>
            </View>

            {/* Indicadores de calidad */}
            <View style={[styles.qualityBlock, { backgroundColor: colors.bgCard }]}>
              <View style={styles.qualityRow}>
                <View style={[styles.qualityDot, { backgroundColor: qualityColor }]} />
                <Text style={[styles.qualityText, { color: qualityColor }]}>
                  {qualityLabel}
                </Text>
                <View style={styles.qualityDotRightGroup}>
                  <View style={[
                    styles.qualityDotSmall,
                    { backgroundColor: signalQuality > 0.3 ? qualityColor : colors.textMuted },
                  ]} />
                  <View style={[
                    styles.qualityDotSmall,
                    { backgroundColor: signalQuality > 0.6 ? qualityColor : colors.textMuted },
                  ]} />
                  <View style={[
                    styles.qualityDotSmall,
                    { backgroundColor: signalQuality > 0.8 ? qualityColor : colors.textMuted },
                  ]} />
                  <View style={[
                    styles.qualityDotSmall,
                    { backgroundColor: signalQuality > 0.95 ? qualityColor : colors.textMuted },
                  ]} />
                </View>
              </View>
              <View style={[styles.qualityBar, { backgroundColor: colors.divider }]}>
                <View style={[
                  styles.qualityFill,
                  {
                    width: `${Math.round(signalQuality * 100)}%`,
                    backgroundColor: qualityColor,
                  },
                ]} />
              </View>
              <Text style={[styles.frameCountText, { color: colors.textMuted }]}>
                {frameCount} frames capturados
              </Text>
            </View>

            {/* Alerta de movimiento */}
            {motionAlert && (
              <View style={[styles.motionAlert, {
                backgroundColor: colors.dangerLight + '33',
                borderColor: colors.danger + '44',
              }]}>
                <Text style={[styles.motionAlertText, { color: colors.danger }]}>
                  ⚠️ Movimiento mantén quieto el movil
                </Text>
              </View>
            )}

            {/* Alerta de dedo */}
            {fingerState.state !== 'waiting' && fingerState.state !== 'valid' && (
              <View style={[
                styles.fingerAlert,
                fingerState.state === 'saturated_high' && {
                  backgroundColor: colors.dangerLight + '33',
                  borderColor: colors.danger + '44',
                },
                fingerState.state === 'no_finger' && {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                },
                fingerState.state === 'low_ac' && {
                  backgroundColor: colors.warningLight + '33',
                  borderColor: colors.warning + '44',
                },
              ]}>
                <Text style={[styles.fingerAlertText, { color: colors.warning }]}>
                  {fingerState.state === 'saturated_high'
                    ? 'Presion excesiva reduce la fuerza'
                    : fingerState.state === 'no_finger'
                      ? 'Senal muy oscura cubre bien la camara'
                      : fingerState.state === 'low_ac'
                        ? 'Senal plana ajusta la presion del dedo'
                        : fingerState.message}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Area inferior ── */}
        <View style={[styles.bottomArea, bottomAreaStyle]}>
          {phase === 'idle' && (
            <TouchableOpacity
              style={[startBtnStyle, !cameraReady && styles.startBtnDisabled]}
              onPress={startMeasurement}
              disabled={!cameraReady}
            >
              <Text style={[styles.startBtnText, { color: colors.textOnPrimary, fontSize: Math.round(18 * fontScale) }]}>
                {cameraReady ? 'Iniciar medicion' : '⏳ Iniciando camara...'}
              </Text>
            </TouchableOpacity>
          )}
          {(phase === 'measuring' || phase === 'preparing') && (
            <TouchableOpacity style={stopBtnStyle} onPress={() => stopMeasurement(true)}>
              <Text style={[styles.stopBtnText, { color: colors.danger, fontSize: Math.round(16 * fontScale) }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.legalNote, { color: colors.textMuted }]}>
            ⚠️ Esta app no es un dispositivo medico. Consulte a su medico.
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
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  // Permisos
  permIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  permTitle: {
    fontWeight: '700',
    marginBottom: 12,
  },
  permText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  startBtn: {
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  startBtnText: {
    fontWeight: '700',
  },

  // Processing
  processingIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  processingTitle: {
    fontWeight: '700',
    marginBottom: 10,
  },
  processingSubtitle: {
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
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    ...SHADOWS.card,
  },
  instructionsTitle: {
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
    fontSize: 14,
    lineHeight: 22,
  },
  cameraLoading: {
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },

  // Preparando
  prepCard: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  prepIcon: {
    fontSize: 52,
    marginBottom: 12,
  },
  prepText: {
    fontWeight: '700',
  },
  prepSub: {
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
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  liveBPMLabel: {
    marginTop: 2,
  },

  // Calidad
  qualityBlock: {
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
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 10,
  },
  qualityFill: {
    height: '100%',
    borderRadius: 2,
  },
  frameCountText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },

  // Alertas
  motionAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
  },
  motionAlertText: {
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
  fingerAlertText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Area inferior
  bottomArea: {
    // padding, paddingBottom, marginBottom se establecen dinamicamente
  },

  // Boton de inicio (estado deshabilitado)
  startBtnDisabled: {
    opacity: 0.6,
  },

  // Boton cancelar (estilo base)
  stopBtnText: {
    fontWeight: '600',
  },

  // Nota legal
  legalNote: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
