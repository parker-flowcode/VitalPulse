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
  Alert, Vibration, Dimensions, AppState, Platform,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import WaveformChart from '../components/WaveformChart';
import FingerOverlay from '../components/FingerOverlay';
import CircularProgress from '../components/CircularProgress';
import useHealthStore from '../store/healthstore';
import { processPPGSignal, detrend, resetKalman, detectRawSaturation } from '../utils/ppgProcessor';
import { estimateBPCalibrated } from '../utils/bpEstimator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MEASURE_DURATION = 60;
const MOTION_THRESHOLD = 0.12;

export default function MeasureScreen({ navigation }) {
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    { fps: 30 },
    { videoResolution: { width: 640, height: 480 } },
  ]);
  const { hasPermission, requestPermission } = useCameraPermission();

  // useResizePlugin es un hook — se llama aquí, su función resize
  // puede llamarse desde el worklet porque está vinculada al contexto nativo
  const { resize } = useResizePlugin();

  const accelSubscription   = useRef(null);
  const isPausedRef        = useRef(false);
  const appStateRef         = useRef(AppState.currentState);
  const isFinalizedRef      = useRef(false);
  const isCapturingRef      = useRef(false);
  const localValuesRef      = useRef([]);
  const timerRef            = useRef(null);
  const workletCallbackRef  = useRef(null);

  // SharedValue: accesible desde worklet Y JS thread
  const isCapturingSV = useSharedValue(false);

  const [isRunning, setIsRunning]         = useState(false);
  const [timeLeft, setTimeLeft]           = useState(MEASURE_DURATION);
  const [displayValues, setDisplayValues] = useState([]);
  const [signalQuality, setSignalQuality] = useState(0);
  const [liveBPM, setLiveBPM]             = useState(0);
  const [motionAlert, setMotionAlert]     = useState(false);
  const [phase, setPhase]                 = useState('idle');
  const [cameraReady, setCameraReady]     = useState(false);
  const [frameCount, setFrameCount]       = useState(0);
  const [pressureHint, setPressureHint]   = useState(''); // '' | 'Suave' | 'Fuerte' | 'Ok'

  const { calibration, userProfile, settings, addMeasurement } = useHealthStore();

  // Refs para funciones accesibles desde callbacks sin re-crear useCallback
  const hardStopRef = useRef();
  const setIsRunningRef = useRef();
  const setPhaseRef = useRef();
  const resetToIdleRef = useRef();
  hardStopRef.current = hardStop;
  setIsRunningRef.current = setIsRunning;
  setPhaseRef.current = setPhase;
  resetToIdleRef.current = resetToIdle;

  // ─── Recibir valor de luminancia desde el worklet ─────────────────────────
  const receiveFrame = useCallback((val) => {
    if (!isCapturingRef.current || isFinalizedRef.current || val < 0) return;

    // Pre-filtrado temporal: suavizado exponencial para eliminar picos de ruido
    // del sensor en Android. Si el nuevo valor difiere >25% del anterior,
    // se mezcla con el histórico para evitar artefactos.
    const count = localValuesRef.current.length;
    if (count > 0) {
      const prev = localValuesRef.current[count - 1];
      if (prev > 0 && Math.abs(val - prev) / prev > 0.25) {
        // Spike detectado: suavizar con el valor anterior (70% anterior, 30% nuevo)
        localValuesRef.current.push(prev * 0.7 + val * 0.3);
      } else {
        localValuesRef.current.push(val);
      }
    } else {
      localValuesRef.current.push(val);
    }
    const newCount = localValuesRef.current.length;

    if (newCount % 15 === 0) setFrameCount(newCount);
    if (newCount % 12 === 0 && newCount > 10) {
      // Tomamos los últimos 100 valores y aplicamos detrend para eliminar la componente DC
      const raw = localValuesRef.current.slice(-100);
      const detrended = detrend(raw);
      setDisplayValues(detrended);
    }

    // BPM en tiempo real cada ~100 frames con signalQuality temprana
    if (newCount % 100 === 0 && newCount > 60) {
      const elapsed = MEASURE_DURATION - timeLeft;
      const currentFps = elapsed > 0 ? Math.round(newCount / elapsed) : 19;
      const partial = processPPGSignal(localValuesRef.current, currentFps);
      if (partial.ready && partial.bpm >= 40 && partial.bpm <= 200) {
        setLiveBPM(partial.bpm);
        setSignalQuality(partial.quality);

        // Feedback háptico progresivo basado en calidad
        if (partial.quality > 0.6) {
          Vibration.vibrate(50); // Vibración corta: señal buena
        } else if (partial.quality < 0.3) {
          Vibration.vibrate(150); // Vibración larga: señal débil
        }
      }

      // Auto-cancelación si calidad baja persistente (>5s)
      // Solo comprobamos si hay al menos ~10s de datos para dar tiempo a colocar el dedo
      if (newCount >= currentFps * 15 && newCount % currentFps === 0) {
        const recent = localValuesRef.current.slice(-currentFps * 5);
        if (recent.length >= currentFps * 3) {
          const check = processPPGSignal(recent, currentFps);
          if (check.ready && check.quality < 0.2) {
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
  }, [timeLeft]);

  // Crear la función puente worklet→JS una vez y guardarla en ref
  useEffect(() => {
    workletCallbackRef.current = Worklets.createRunOnJS(receiveFrame);
  }, [receiveFrame]);

  // ─── Frame Processor: hilo nativo, 30fps ──────────────────────────────────
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    // Ensure processing only when capturing is active and camera is ready
    if (!isCapturingSV.value || !cameraReady) return;
    if (workletCallbackRef.current == null) return;

    // Intentar usar el resize plugin (Android). Si falla (p.ej. iOS), usar toArrayBuffer.
    // Resolución aumentada de 8×8 a 16×16 para mejor SNR en Android
    // (64 píxeles → 256 píxeles = 4× más información)
    try {
      const resized = resize(frame, {
        scale:       { width: 16, height: 16 },
        pixelFormat: 'rgb',
        dataType:    'float32',
      });
      // 16*16*3 = 768 floats. Usar canal R
      let sum = 0, count = 0;
      for (let i = 0; i < resized.length; i += 3) {
        sum += resized[i];
        count++;
      }
      if (count > 0) {
        workletCallbackRef.current((sum / count) * 255);
      }
    } catch {
      // Fallback para iOS: obtener buffer RGB y promediar el canal rojo
      try {
        const raw = frame.toArrayBuffer('rgb'); // returns Uint8Array
        // raw length = width*height*3, but we only need a quick average of red channel
        let sum = 0, count = 0;
        for (let i = 0; i < raw.length; i += 3) {
          sum += raw[i]; // red channel (0‑255)
          count++;
        }
        if (count > 0) {
          workletCallbackRef.current(sum / count);
        }
      } catch {
        // Silenciar cualquier error en fallback
      }
    }
  }, [isCapturingSV, resize, cameraReady]);

  // ─── AppState / cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current === 'active' && next.match(/inactive|background/)) hardStop();
      appStateRef.current = next;
    });
    return () => { sub.remove(); hardStop(); };
  }, []);

  // ─── Unmount cleanup for accelerometer ───────────────────────────────────────
  useEffect(() => {
    return () => {
      if (accelSubscription.current) {
        accelSubscription.current.remove();
        accelSubscription.current = null;
      }
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
    Accelerometer.setUpdateInterval(300);
    let lx = 0, ly = 0, lz = 1, init = false;
    accelSubscription.current = Accelerometer.addListener(({ x, y, z }) => {
      if (!init) { lx = x; ly = y; lz = z; init = true; return; }
      const delta = Math.abs(x - lx) + Math.abs(y - ly) + Math.abs(z - lz);
      if (delta > MOTION_THRESHOLD) {
        // Motion detected – pause capture if not already paused
        if (!isPausedRef.current && isCapturingRef.current) {
          isPausedRef.current = true;
          isCapturingSV.value = false; // stop processing frames
          setMotionAlert(true);
        }
      } else {
        // Motion below threshold – resume capture if it was paused
        if (isPausedRef.current && isCapturingRef.current) {
          isPausedRef.current = false;
          isCapturingSV.value = true; // resume processing frames
          setMotionAlert(false);
        }
      }
      lx = x; ly = y; lz = z;
    });
  };

  // ─── Iniciar medición ─────────────────────────────────────────────────────
  const startMeasurement = () => {
    if (!cameraReady) {
      Alert.alert('Cámara no lista', 'Espera un momento y vuelve a intentarlo.');
      return;
    }

    // Resetear Kalman al inicio de cada medición para evitar contaminación entre mediciones
    resetKalman();

    localValuesRef.current = [];
    isFinalizedRef.current = false;
    isCapturingRef.current = false;
    isCapturingSV.value    = false;
    setDisplayValues([]);
    setLiveBPM(0);
    setSignalQuality(0);
    setFrameCount(0);
    setTimeLeft(MEASURE_DURATION);
    setPhase('preparing');

    // 3 segundos para colocar el dedo
    setTimeout(() => {
      if (isFinalizedRef.current) return;

      setPhase('measuring');
      setIsRunning(true);
      isCapturingRef.current = true;
      isCapturingSV.value    = true;
      startAccelerometer();
      Vibration.vibrate(200);

      // Timer independiente
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
    }, 3000);
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

      // Validación de frames mínimos: al menos ~5 segundos de datos a 19 FPS
      const MIN_FRAMES = 95; // 19fps * 5seg
      if (values.length < MIN_FRAMES) {
        setPhase('idle');
        Alert.alert(
          'Señal insuficiente',
          `Solo se capturaron ${values.length} frames (mínimo ${MIN_FRAMES}).\nCubre completamente la cámara y el flash con el dedo.`,
          [{ text: 'Reintentar', onPress: resetToIdle }]
        );
        return;
      }

      // Validación de saturación raw: si la señal está sobreexpuesta o subexpuesta
      if (detectRawSaturation(values)) {
        setPhase('idle');
        Alert.alert(
          'Señal saturada',
          'La señal está saturada (sobreexpuesta o subexpuesta).\n• Ajusta la presión del dedo sobre la cámara\n• Cubre completamente el flash',
          [{ text: 'Reintentar', onPress: resetToIdle }]
        );
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
        settings.preferRegression ?? true
      );

      const measurement = {
        bpm: result.bpm, bpmFFT: result.bpmFFT, bpmPeaks: result.bpmPeaks,
        bp, quality: result.quality, confidence: result.confidence,
        rrIntervals: result.rrIntervals || [], sdnn: result.sdnn || 0,
        signalLength: values.length,
        // Phase 2 metrics
        snr: result.snr,
        saturated: result.saturated,
        stability: result.stability,
      };

    addMeasurement(measurement)
      .then(() => navigation.navigate('Results', { measurement }))
      .catch(() => navigation.navigate('Results', { measurement }));
    // Clear stored PPG values to free memory after processing
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
    setDisplayValues([]);
    setLiveBPM(0);
    setSignalQuality(0);
    setFrameCount(0);
    setTimeLeft(MEASURE_DURATION);
    setPhase('idle');
  };

  // ─── Permisos ──────────────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.permIcon}>📷</Text>
          <Text style={styles.permTitle}>Cámara requerida</Text>
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
      <View style={styles.center}>
        <Text style={styles.permText}>Cámara trasera no disponible.</Text>
      </View>
    );
  }

  if (phase === 'processing') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.processingIcon}>🫀</Text>
          <Text style={styles.processingTitle}>Analizando señal...</Text>
          <Text style={styles.processingSubtitle}>
            Procesando {frameCount} frames con FFT
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const qualityColor = signalQuality > 0.6 ? '#2BBFA4' : signalQuality > 0.3 ? '#FFA500' : '#F25C54';
  const qualityLabel = signalQuality > 0.6 ? 'Señal buena' : signalQuality > 0.3 ? 'Señal regular' : 'Señal débil';

  return (
    <View style={styles.container}>
      {/*
        Camera en top:-9999 — fuera del viewport pero activa.
        El resize plugin accede al frame nativo independientemente
        de dónde esté posicionada la Camera en pantalla.
        pixelFormat="yuv" es el formato nativo del sensor Android —
        el resize plugin convierte internamente a RGB/float32.
      */}
      <Camera
        style={styles.hiddenCamera}
        device={device}
        isActive={true}
        format={format}
        fps={format?.maxFps ? Math.min(30, format.maxFps) : 30}
        torch={isRunning ? 'on' : 'off'}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
        photo={false}
        video={false}
        enableZoomGesture={false}
        onInitialized={() => setCameraReady(true)}
        onError={(e) => console.warn('[Camera] Error:', e.message)}
      />
      {/* Overlay visual para guiar la posición del dedo */}
       {phase === 'measuring' && <FingerOverlay quality={signalQuality} />}

      <SafeAreaView style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => stopMeasurement(true)}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Midiendo pulso</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Timer con barra circular */}
        <View style={styles.timerContainer}>
          <View style={styles.circularTimerWrapper}>
            <CircularProgress
              size={130}
              strokeWidth={6}
              progress={1 - timeLeft / MEASURE_DURATION}
              color={qualityColor}
              bgColor="#132220"
            />
            <View style={styles.circularTimerInner}>
              <Text style={styles.timer}>{timeLeft}</Text>
              <Text style={styles.timerLabel}>segundos</Text>
            </View>
          </View>
        </View>

        {/* Idle */}
        {phase === 'idle' && (
          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsTitle}>Cómo medir correctamente</Text>
            <Text style={styles.instructionsText}>
              {'👆 Coloca el dedo índice cubriendo completamente\n   la cámara trasera y el flash.\n\n'}
              {'💡 El flash se encenderá — es normal y necesario.\n\n'}
              {'🤫 Presiona suavemente. Sin apretar en exceso.\n\n'}
              {'🧘 Apoya el codo y mantén el móvil completamente quieto.'}
            </Text>
            {!cameraReady && <Text style={styles.cameraLoading}>⏳ Iniciando cámara...</Text>}
          </View>
        )}

        {/* Preparing */}
         {phase === 'preparing' && (
           <View style={styles.prepCard}>
             <Text style={styles.prepIcon}>👆</Text>
             <Text style={styles.prepText}>Coloca el dedo ahora...</Text>
             <Text style={styles.prepSub}>
               Cubre completamente la cámara trasera y el flash
             </Text>
           </View>
         )}

        {/* Measuring */}
        {phase === 'measuring' && (
          <View style={styles.measuringContainer}>
            <View style={styles.waveformContainer}>
              <WaveformChart data={displayValues} width={SCREEN_WIDTH - 48} height={90} />
            </View>

            <View style={styles.liveBPMContainer}>
              <Text style={styles.liveBPM}>{liveBPM > 0 ? liveBPM : '---'}</Text>
              <Text style={styles.liveBPMLabel}>
                {liveBPM > 0 ? 'BPM detectado' : 'Esperando señal...'}
              </Text>
            </View>

            <View style={styles.qualityRow}>
              <View style={[styles.qualityDot, { backgroundColor: qualityColor }]} />
              <Text style={[styles.qualityText, { color: qualityColor }]}>{qualityLabel}</Text>
              <View style={styles.qualityBar}>
                <View style={[styles.qualityFill, {
                  width: `${Math.round(signalQuality * 100)}%`,
                  backgroundColor: qualityColor,
                }]} />
              </View>
            </View>

            <Text style={styles.frameCountText}>{frameCount} frames capturados</Text>

            {motionAlert && (
              <View style={styles.motionAlert}>
                <Text style={styles.motionAlertText}>
                  ⚠️ Movimiento — mantén quieto el móvil
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Botones */}
        <View style={styles.bottomArea}>
          {phase === 'idle' && (
            <TouchableOpacity
              style={[styles.startBtn, !cameraReady && styles.startBtnDisabled]}
              onPress={startMeasurement}
              disabled={!cameraReady}
            >
              <Text style={styles.startBtnText}>
                {cameraReady ? '❤️  Iniciar medición' : '⏳ Iniciando cámara...'}
              </Text>
            </TouchableOpacity>
          )}
          {(phase === 'measuring' || phase === 'preparing') && (
            <TouchableOpacity style={styles.stopBtn} onPress={() => stopMeasurement(true)}>
              <Text style={styles.stopBtnText}>Cancelar</Text>
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

const styles = StyleSheet.create({
  // Main container now uses column flex layout with space-between to distribute content vertically
  container:    { flex: 1, flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#1C2B2A' },
  hiddenCamera: { position: 'absolute', top: -9999, left: 0, width: 120, height: 120 },
  overlay:      { flex: 1 },
  safe:         { flex: 1, backgroundColor: '#1C2B2A' },
  center:       { flex: 1, backgroundColor: '#1C2B2A', justifyContent: 'center', alignItems: 'center', padding: 24 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  closeBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { color: '#4A6A67', fontSize: 22, fontWeight: '600' },
  title:        { color: '#fff', fontSize: 18, fontWeight: '600' },
  timerContainer: { alignItems: 'center', paddingVertical: 16 },
  circularTimerWrapper: { width: 130, height: 130, alignItems: 'center', justifyContent: 'center' },
  circularTimerInner: { position: 'absolute', alignItems: 'center' },
  timer:        { color: '#2BBFA4', fontSize: 36, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timerLabel:   { color: '#4A6A67', fontSize: 11, marginTop: 2 },
  instructionsBox: { margin: 20, backgroundColor: '#132220', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1A7F6E44' },
  instructionsText:  { color: '#8BBAB5', fontSize: 14, lineHeight: 26 },
  cameraLoading:     { color: '#FFA500', fontSize: 13, marginTop: 12, textAlign: 'center' },
  instructionsTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  prepCard:     { margin: 20, backgroundColor: '#132220', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#FFA50044', alignItems: 'center' },
  prepIcon:     { fontSize: 52, marginBottom: 12 },
  prepText:     { color: '#FFA500', fontSize: 22, fontWeight: '700' },
  prepSub:      { color: '#4A6A67', fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 22 },
  measuringContainer: { flex: 1, paddingHorizontal: 20 },
   waveformContainer:  { backgroundColor: '#0F1F1E', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#1A7F6E33' },
  liveBPMContainer:   { alignItems: 'center', marginBottom: 10 },
  liveBPM:      { color: '#2BBFA4', fontSize: 56, fontWeight: '700', fontVariant: ['tabular-nums'] },
  liveBPMLabel: { color: '#4A6A67', fontSize: 12, marginTop: 2 },
  qualityRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  qualityDot:   { width: 8, height: 8, borderRadius: 4 },
  qualityText:  { fontSize: 13, fontWeight: '600', width: 100 },
  qualityBar:   { flex: 1, height: 4, backgroundColor: '#132220', borderRadius: 2, overflow: 'hidden' },
  qualityFill:  { height: '100%', borderRadius: 2 },
  frameCountText: { color: '#2A4A47', fontSize: 11, textAlign: 'center', marginBottom: 8 },
  motionAlert:  { backgroundColor: 'rgba(242,92,84,0.15)', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#F25C5444' },
  motionAlertText: { color: '#F25C54', fontSize: 13, textAlign: 'center' },
  bottomArea:   { padding: 20, paddingBottom: 12 },
  startBtn:         { backgroundColor: '#1A7F6E', borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 12 },
  startBtnDisabled: { backgroundColor: '#1A4A3A', opacity: 0.6 },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  stopBtn:      { backgroundColor: 'transparent', borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#F25C5466' },
  stopBtnText:  { color: '#F25C54', fontSize: 16, fontWeight: '600' },
  legalNote:    { color: '#F25C54', fontSize: 11, textAlign: 'center', opacity: 0.7 },
  permIcon:     { fontSize: 48, marginBottom: 16 },
  permTitle:    { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  permText:     { color: '#4A6A67', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  processingIcon:     { fontSize: 64, marginBottom: 20 },
  processingTitle:    { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 10 },
  processingSubtitle: { color: '#4A6A67', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
