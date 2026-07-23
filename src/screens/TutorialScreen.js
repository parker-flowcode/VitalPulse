/**
 * TutorialScreen.js — VitalPulse
 *
 * Modo tutorial interactivo: simula una medición PPG completa SIN cámara real.
 * Genera datos PPG sintéticos y ejecuta todo el pipeline de procesamiento
 * para que el usuario vea el flujo completo antes de usar la cámara real.
 *
 * Útil para:
 * - Primeros usuarios que quieren entender el proceso
 * - Demostración sin necesidad de cámara
 * - Prueba del algoritmo con datos controlados
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Line } from 'react-native-svg';
import { processPPGSignal, resetKalman } from '../utils/ppgProcessor';
import { estimateBPCalibrated, classifyBPM, classifyBP } from '../utils/bpEstimator';
import useHealthStore from '../store/healthstore';
import LegalDisclaimer from '../components/LegalDisclaimer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 120;
const SYNTHETIC_BPM = 72;
const SYNTHETIC_FPS = 30;
const DURATION_SEC = 15;
const TOTAL_FRAMES = SYNTHETIC_FPS * DURATION_SEC;

// ─── Generador de señal PPG sintética ─────────────────────────────────────────
function generateSyntheticPPG(bpm = SYNTHETIC_BPM, fps = SYNTHETIC_FPS, duration = DURATION_SEC) {
  const totalSamples = fps * duration;
  const beatFreq = bpm / 60; // Hz
  const samplesPerBeat = Math.round(fps / beatFreq);
  const signal = [];

  for (let i = 0; i < totalSamples; i++) {
    const beatPhase = (i % samplesPerBeat) / samplesPerBeat;

    // Pulso principal (sístole): forma de campana asimétrica
    const pulse = Math.exp(-((beatPhase - 0.15) ** 2) / 0.008) * 0.9;

    // Onda dicrota (segundo pico más pequeño): ~45% del principal
    const dicrotic = Math.exp(-((beatPhase - 0.35) ** 2) / 0.015) * 0.3;

    // Componente DC + ruido fisiológico suave
    const noise = (Math.random() - 0.5) * 0.03;
    const baseline = 0.05;

    const value = baseline + pulse + dicrotic + noise;
    signal.push(value * 200 + 20); // escalar a rango ~20-220 (como RAW real)
  }

  return signal;
}

// ─── Gráfica del waveform ─────────────────────────────────────────────────────
function TutorialWaveform({ data = [], width = CHART_WIDTH, height = CHART_HEIGHT, color = '#2563EB' }) {
  if (data.length < 2) {
    return (
      <View style={[styles.chartContainer, { width, height }]}>
        <Svg width={width} height={height}>
          <Line x1={0} y1={height / 2} x2={width} y2={height / 2}
            stroke="#CBD5E1" strokeWidth="1.5" opacity="0.3" />
        </Svg>
      </View>
    );
  }

  const displayData = data.slice(-80);
  const minVal = Math.min(...displayData);
  const maxVal = Math.max(...displayData);
  const range = maxVal - minVal || 1;
  const padding = 8;
  const usableHeight = height - padding * 2;

  const points = displayData
    .map((val, i) => {
      const x = (i / (displayData.length - 1)) * width;
      const y = padding + usableHeight - ((val - minVal) / range) * usableHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <View style={[styles.chartContainer, { width, height }]}>
      <Svg width={width} height={height}>
        <Polyline points={points} fill="none" stroke={color} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TutorialScreen({ navigation }) {
  const { calibration, userProfile } = useHealthStore();
  const [phase, setPhase] = useState('idle'); // idle | simulating | results
  const [progress, setProgress] = useState(0);
  const [rawValues, setRawValues] = useState([]);
  const [liveWaveform, setLiveWaveform] = useState([]);
  const [liveBPM, setLiveBPM] = useState(0);
  const [liveQuality, setLiveQuality] = useState(0);
  const [result, setResult] = useState(null);
  const [timer, setTimer] = useState(DURATION_SEC);

  const rawRef = useRef([]);
  const intervalRef = useRef(null);
  const synthSignalRef = useRef(null);
  const frameIndexRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ─── Generar señal sintética al montar ─────────────────────────────────────
  useEffect(() => {
    synthSignalRef.current = generateSyntheticPPG();
    return () => {
      clearInterval(intervalRef.current);
      resetKalman();
    };
  }, []);

  // ─── Animación pulso ────────────────────────────────────────────────────────
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 250, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ])
    );
    if (phase === 'simulating') anim.start();
    else anim.stop();
    return () => anim.stop();
  }, [phase, pulseAnim]);

  // ─── Timers ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'simulating') {
      const tick = () => {
        frameIndexRef.current++;
        const idx = frameIndexRef.current;

        if (idx >= TOTAL_FRAMES) {
          finishSimulation();
          return;
        }

        // Obtener valor sintético actual
        const val = synthSignalRef.current[idx] || 0;
        rawRef.current.push(val);
        setRawValues([...rawRef.current]);

        // Actualizar waveform cada 3 frames
        if (idx % 3 === 0) {
          setLiveWaveform(rawRef.current.slice(-80));
        }

        // Estimar BPM parcial cada ~100 frames
        if (idx % 100 === 0 && idx > 60) {
          const elapsed = idx / SYNTHETIC_FPS;
          const fps = elapsed > 0 ? Math.round(idx / elapsed) : SYNTHETIC_FPS;
          const partial = processPPGSignal(rawRef.current, fps);
          if (partial.ready && partial.bpm > 0) {
            setLiveBPM(partial.bpm);
            setLiveQuality(partial.quality);
          }
        }

        // Actualizar progreso y timer
        const elapsed = idx / SYNTHETIC_FPS;
        setProgress(Math.min(1, elapsed / DURATION_SEC));
        setTimer(Math.max(0, Math.round(DURATION_SEC - elapsed)));
      };

      intervalRef.current = setInterval(tick, 1000 / SYNTHETIC_FPS);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [phase]);

  const finishSimulation = () => {
    clearInterval(intervalRef.current);
    resetKalman();

    const values = rawRef.current;
    const fps = values.length > DURATION_SEC
      ? Math.round(values.length / DURATION_SEC)
      : SYNTHETIC_FPS;

    const processed = processPPGSignal(values, fps);
    const bp = estimateBPCalibrated(
      processed.morphology, processed.bpm, calibration, userProfile, processed.sdnn || 0
    );

    setResult({
      bpm: processed.bpm,
      bp,
      quality: processed.quality,
      confidence: processed.confidence,
      snr: processed.snr,
      sdnn: processed.sdnn,
      bpmFFT: processed.bpmFFT,
      bpmPeaks: processed.bpmPeaks,
    });
    setPhase('results');
  };

  const startSimulation = () => {
    rawRef.current = [];
    frameIndexRef.current = 0;
    setRawValues([]);
    setLiveWaveform([]);
    setLiveBPM(0);
    setLiveQuality(0);
    setProgress(0);
    setTimer(DURATION_SEC);
    setResult(null);
    resetKalman();
    setPhase('simulating');
  };

  const resetToIdle = () => {
    setPhase('idle');
    setRawValues([]);
    setLiveWaveform([]);
    setLiveBPM(0);
    setLiveQuality(0);
    setProgress(0);
    setTimer(DURATION_SEC);
    setResult(null);
  };

  const qualityColor = liveQuality > 0.6 ? '#10B981' : liveQuality > 0.3 ? '#F59E0B' : '#94A3B8';

  // ─── Pantalla de resultados simulados ───────────────────────────────────────
  if (phase === 'results' && result) {
    const bpmClass = classifyBPM(result.bpm);
    const bpClass = result.bp ? classifyBP(result.bp.systolic, result.bp.diastolic) : null;

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>✅ Simulación completada</Text>
            <Text style={styles.subtitle}>
              Datos generados artificialmente — no es una medición real
            </Text>
          </View>

          {/* BPM */}
          <View style={[styles.resultCard, { borderColor: bpmClass.color + '44' }]}>
            <Text style={styles.cardLabel}>FRECUENCIA CARDÍACA</Text>
            <Text style={[styles.bigValue, { color: bpmClass.color }]}>{result.bpm}</Text>
            <Text style={styles.bigUnit}>BPM (objetivo: {SYNTHETIC_BPM})</Text>
            <View style={[styles.badge, { backgroundColor: bpmClass.color + '22' }]}>
              <Text style={[styles.badgeText, { color: bpmClass.color }]}>{bpmClass.label}</Text>
            </View>
          </View>

          {/* PA */}
          {result.bp && bpClass && (
            <View style={[styles.resultCard, { borderColor: bpClass.color + '44' }]}>
              <Text style={styles.cardLabel}>PRESIÓN ARTERIAL ESTIMADA</Text>
              <Text style={[styles.bigValue, { color: bpClass.color, fontSize: 48 }]}>
                {result.bp.systolic}/{result.bp.diastolic}
              </Text>
              <Text style={styles.bigUnit}>mmHg</Text>
            </View>
          )}

          {/* Métricas de calidad */}
          <View style={styles.metricsCard}>
            <Text style={styles.cardLabel}>MÉTRICAS DE CALIDAD</Text>
            <View style={styles.metricsGrid}>
              {[
                { label: 'Calidad', value: (result.quality * 100).toFixed(0) + '%', color: '#10B981' },
                { label: 'Confianza', value: (result.confidence * 100).toFixed(0) + '%', color: '#10B981' },
                { label: 'SNR', value: result.snr ? result.snr.toFixed(1) + ' dB' : 'N/A', color: '#10B981' },
                { label: 'SDNN', value: result.sdnn ? Math.round(result.sdnn) + ' ms' : '0 ms', color: '#64748B' },
                { label: 'FFT', value: result.bpmFFT + ' BPM', color: '#64748B' },
                { label: 'Picos', value: result.bpmPeaks + ' BPM', color: '#64748B' },
              ].map((m, i) => (
                <View key={i} style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={startSimulation}>
              <Text style={styles.primaryBtnText}>Repetir simulación</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('Main')}>
              <Text style={styles.secondaryBtnText}>Probar con cámara real</Text>
            </TouchableOpacity>
          </View>

          <LegalDisclaimer compact />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Estado idle (antes de empezar) ──────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.heroSection}>
            <Text style={styles.heroIcon}>🎮</Text>
            <Text style={styles.heroTitle}>Modo Tutorial</Text>
            <Text style={styles.heroSubtitle}>
              Aprende cómo funciona VitalPulse sin usar la cámara real
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>¿Qué vas a ver?</Text>
            {[
              '📊 Señal PPG sintética generada en tiempo real',
              '❤️ Detección de BPM con FFT + picos',
              '📈 Estimación de presión arterial',
              '🎯 Métricas de calidad y SNR',
              '⏱️ Simulación completa de 15 segundos',
            ].map((text, i) => (
              <Text key={i} style={styles.infoItem}>{text}</Text>
            ))}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Cómo medir realmente</Text>
            <Text style={styles.infoText}>
              En una medición real, coloca tu dedo índice sobre la cámara trasera,
              cubriendo también el flash. Mantén el móvil quieto durante 60 segundos.
            </Text>
          </View>

          <TouchableOpacity style={styles.startBtn} onPress={startSimulation}>
            <Text style={styles.startBtnText}>▶️ Iniciar simulación</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.realBtn} onPress={() => navigation.navigate('Main')}>
            <Text style={styles.realBtnText}>📷 Ir a medición real</Text>
          </TouchableOpacity>

          <LegalDisclaimer />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Estado simulating ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.simSafe}>
      <View style={styles.simContainer}>
        {/* Header */}
        <View style={styles.simHeader}>
          <Text style={styles.simTitle}>🔬 Simulando...</Text>
          <TouchableOpacity onPress={resetToIdle} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Corazón animado */}
        <View style={styles.heartContainer}>
          <Animated.Text style={[styles.heartIcon, { transform: [{ scale: pulseAnim }] }]}>
            ❤️
          </Animated.Text>
          <Text style={styles.heartBPM}>{liveBPM > 0 ? liveBPM : '---'}</Text>
          <Text style={styles.heartLabel}>
            {liveBPM > 0 ? 'BPM detectado' : 'Generando señal...'}
          </Text>
        </View>

        {/* Timer */}
        <View style={styles.timerRow}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.timerText}>{timer}s</Text>
        </View>

        {/* Waveform sintético */}
        <View style={styles.waveformCard}>
          <Text style={styles.waveformLabel}>SEÑAL PPG SINTÉTICA</Text>
          <TutorialWaveform data={liveWaveform} color={qualityColor} />
        </View>

        {/* Calidad */}
        <View style={styles.qualityRow}>
          <View style={[styles.qualityDot, { backgroundColor: qualityColor }]} />
          <Text style={[styles.qualityText, { color: qualityColor }]}>
            {liveQuality > 0.6 ? 'Señal buena' : liveQuality > 0.3 ? 'Señal regular' : 'Generando...'}
          </Text>
        </View>

        <Text style={styles.framesText}>{rawValues.length} frames generados</Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Estilos ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { padding: 20, paddingBottom: 40 },
  // Hero
  heroSection: { alignItems: 'center', marginBottom: 28, marginTop: 20 },
  heroIcon: { fontSize: 64, marginBottom: 16 },
  heroTitle: { color: '#1E293B', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  heroSubtitle: { color: '#64748B', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  // Info cards
  infoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  infoTitle: { color: '#2563EB', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  infoItem: { color: '#1E293B', fontSize: 14, lineHeight: 24 },
  infoText: { color: '#64748B', fontSize: 14, lineHeight: 22 },
  // Buttons
  startBtn: {
    backgroundColor: '#2563EB', borderRadius: 16, padding: 18,
    alignItems: 'center', marginBottom: 12,
  },
  startBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  realBtn: {
    backgroundColor: 'transparent', borderRadius: 16, padding: 16,
    alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#2563EB',
  },
  realBtnText: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
  // Simulation
  simSafe: { flex: 1, backgroundColor: '#0F172A' },
  simContainer: { flex: 1, padding: 20 },
  simHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  simTitle: { color: '#F59E0B', fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { color: '#64748B', fontSize: 22, fontWeight: '600' },
  // Heart animation
  heartContainer: { alignItems: 'center', marginBottom: 20 },
  heartIcon: { fontSize: 64, marginBottom: 8 },
  heartBPM: { color: '#FFFFFF', fontSize: 56, fontWeight: '700', fontVariant: ['tabular-nums'] },
  heartLabel: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
  // Progress
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  progressBar: { flex: 1, height: 6, backgroundColor: '#1E293B', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 3 },
  timerText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', width: 36, textAlign: 'right' },
  // Waveform
  waveformCard: {
    backgroundColor: '#1E293B', borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#334155',
  },
  waveformLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  chartContainer: { backgroundColor: 'transparent', overflow: 'hidden' },
  // Quality
  qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  qualityDot: { width: 8, height: 8, borderRadius: 4 },
  qualityText: { fontSize: 13, fontWeight: '600' },
  framesText: { color: '#64748B', fontSize: 11, textAlign: 'center' },
  // Results
  header: { marginBottom: 24 },
  title: { color: '#1E293B', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#F59E0B', fontSize: 13, marginTop: 4 },
  resultCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24,
    marginBottom: 16, borderWidth: 1, alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLabel: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 },
  bigValue: { fontSize: 72, fontWeight: '800', fontVariant: ['tabular-nums'], lineHeight: 76 },
  bigUnit: { color: '#64748B', fontSize: 13, marginTop: 6, marginBottom: 12 },
  badge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 10 },
  badgeText: { fontSize: 14, fontWeight: '700' },
  metricsCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  metricItem: { width: '31%', alignItems: 'center', marginBottom: 12 },
  metricValue: { fontSize: 20, fontWeight: '700' },
  metricLabel: { color: '#94A3B8', fontSize: 11, marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  primaryBtn: {
    flex: 1, backgroundColor: '#2563EB', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    flex: 1, backgroundColor: 'transparent', borderRadius: 14,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2563EB',
  },
  secondaryBtnText: { color: '#2563EB', fontSize: 14, fontWeight: '600' },
});
