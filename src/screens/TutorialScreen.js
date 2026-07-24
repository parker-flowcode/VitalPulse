/**
 * TutorialScreen.js — VitalPulse v5.0
 *
 * Modo tutorial interactivo: simula una medicion PPG completa SIN camara real.
 * Genera datos PPG sinteticos y ejecuta todo el pipeline de procesamiento
 * para que el usuario vea el flujo completo antes de usar la camara real.
 *
 * Redesign: premium minimalist, theme-aware, blue heart animation.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Line } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
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

// ─── Simulation dark palette (per user instruction: dark bg for camera viewfinder) ──
const SIM_BG = '#0F172A';
const SIM_CARD_BG = '#1E293B';
const SIM_BORDER = '#334155';

// ─── Generador de senal PPG sintetica ─────────────────────────────────────────
function generateSyntheticPPG(bpm = SYNTHETIC_BPM, fps = SYNTHETIC_FPS, duration = DURATION_SEC) {
  const totalSamples = fps * duration;
  const beatFreq = bpm / 60;
  const samplesPerBeat = Math.round(fps / beatFreq);
  const signal = [];

  for (let i = 0; i < totalSamples; i++) {
    const beatPhase = (i % samplesPerBeat) / samplesPerBeat;
    const pulse = Math.exp(-((beatPhase - 0.15) ** 2) / 0.008) * 0.9;
    const dicrotic = Math.exp(-((beatPhase - 0.35) ** 2) / 0.015) * 0.3;
    const noise = (Math.random() - 0.5) * 0.03;
    const baseline = 0.05;
    const value = baseline + pulse + dicrotic + noise;
    signal.push(value * 200 + 20);
  }

  return signal;
}

// ─── Grafica del waveform (receives color as prop) ────────────────────────────
function TutorialWaveform({ data = [], width = CHART_WIDTH, height = CHART_HEIGHT, color = '#3B82F6' }) {
  if (data.length < 2) {
    return (
      <View style={{ width, height, backgroundColor: 'transparent', overflow: 'hidden' }}>
        <Svg width={width} height={height}>
          <Line x1={0} y1={height / 2} x2={width} y2={height / 2}
            stroke="#475569" strokeWidth="1.5" opacity="0.3" />
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
    <View style={{ width, height, backgroundColor: 'transparent', overflow: 'hidden' }}>
      <Svg width={width} height={height}>
        <Polyline points={points} fill="none" stroke={color} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TutorialScreen({ navigation }) {
  const { colors } = useTheme();
  const { calibration, userProfile } = useHealthStore();
  const [phase, setPhase] = useState('idle');
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

  // ─── Generar senal sintetica al montar ─────────────────────────────────────
  useEffect(() => {
    synthSignalRef.current = generateSyntheticPPG();
    return () => {
      clearInterval(intervalRef.current);
      resetKalman();
    };
  }, []);

  // ─── Animacion pulso (blue heart 💙) ───────────────────────────────────────
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

        const val = synthSignalRef.current[idx] || 0;
        rawRef.current.push(val);
        setRawValues([...rawRef.current]);

        if (idx % 3 === 0) {
          setLiveWaveform(rawRef.current.slice(-80));
        }

        if (idx % 100 === 0 && idx > 60) {
          const elapsed = idx / SYNTHETIC_FPS;
          const fps = elapsed > 0 ? Math.round(idx / elapsed) : SYNTHETIC_FPS;
          const partial = processPPGSignal(rawRef.current, fps);
          if (partial.ready && partial.bpm > 0) {
            setLiveBPM(partial.bpm);
            setLiveQuality(partial.quality);
          }
        }

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

  const finishSimulation = useCallback(() => {
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
  }, [calibration, userProfile]);

  const startSimulation = useCallback(() => {
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
  }, []);

  const resetToIdle = useCallback(() => {
    setPhase('idle');
    setRawValues([]);
    setLiveWaveform([]);
    setLiveBPM(0);
    setLiveQuality(0);
    setProgress(0);
    setTimer(DURATION_SEC);
    setResult(null);
  }, []);

  // Theme-aware quality color
  const qualityColor = liveQuality > 0.6
    ? colors.success
    : liveQuality > 0.3
      ? colors.warning
      : colors.textMuted;

  // ─── Pantalla de resultados simulados ───────────────────────────────────────
  if (phase === 'results' && result) {
    const bpmClass = classifyBPM(result.bpm);
    const bpClass = result.bp ? classifyBP(result.bp.systolic, result.bp.diastolic) : null;
    const styles = createStyles(colors);

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>{'✅ Simulacion completada'}</Text>
            <Text style={styles.resultsSub}>
              Datos generados artificialmente — no es una medicion real
            </Text>
          </View>

          {/* BPM */}
          <View style={[styles.resultCard, { borderColor: bpmClass.color + '44' }]}>
            <Text style={styles.cardLabel}>FRECUENCIA CARDIACA</Text>
            <Text style={[styles.bigValue, { color: bpmClass.color }]}>{result.bpm}</Text>
            <Text style={styles.bigUnit}>{'BPM (objetivo: '}{SYNTHETIC_BPM}{')'}</Text>
            <View style={[styles.badge, { backgroundColor: bpmClass.color + '22' }]}>
              <Text style={[styles.badgeText, { color: bpmClass.color }]}>{bpmClass.label}</Text>
            </View>
          </View>

          {/* PA */}
          {result.bp && bpClass && (
            <View style={[styles.resultCard, { borderColor: bpClass.color + '44' }]}>
              <Text style={styles.cardLabel}>PRESION ARTERIAL ESTIMADA</Text>
              <Text style={[styles.bigValue, { color: bpClass.color, fontSize: 48 }]}>
                {result.bp.systolic}/{result.bp.diastolic}
              </Text>
              <Text style={styles.bigUnit}>mmHg</Text>
            </View>
          )}

          {/* Metricas de calidad */}
          <View style={styles.metricsCard}>
            <Text style={styles.cardLabel}>METRICAS DE CALIDAD</Text>
            <View style={styles.metricsGrid}>
              {[
                { label: 'Calidad', value: (result.quality * 100).toFixed(0) + '%', color: colors.success },
                { label: 'Confianza', value: (result.confidence * 100).toFixed(0) + '%', color: colors.success },
                { label: 'SNR', value: result.snr ? result.snr.toFixed(1) + ' dB' : 'N/A', color: colors.success },
                { label: 'SDNN', value: result.sdnn ? Math.round(result.sdnn) + ' ms' : '0 ms', color: colors.textMuted },
                { label: 'FFT', value: result.bpmFFT + ' BPM', color: colors.textMuted },
                { label: 'Picos', value: result.bpmPeaks + ' BPM', color: colors.textMuted },
              ].map((m, i) => (
                <View key={i} style={styles.metricItem}>
                  <Text style={[styles.metricVal, { color: m.color }]}>{m.value}</Text>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={startSimulation}>
              <Text style={styles.primaryBtnText}>Repetir simulacion</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('Main')}>
              <Text style={styles.secondaryBtnText}>Probar con camara real</Text>
            </TouchableOpacity>
          </View>

          <LegalDisclaimer compact />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Estado idle (antes de empezar) ──────────────────────────────────────────
  if (phase === 'idle') {
    const styles = createStyles(colors);

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.heroSection}>
            <Text style={styles.heroIcon}>{'🎮'}</Text>
            <Text style={styles.heroTitle}>Modo Tutorial</Text>
            <Text style={styles.heroSub}>
              Aprende como funciona VitalPulse sin usar la camara real
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{'Que vas a ver?'}</Text>
            {[
              '📊 Senal PPG sintetica generada en tiempo real',
              '📈 Deteccion de BPM con FFT + picos',
              '📈 Estimacion de presion arterial',
              '🎯 Metricas de calidad y SNR',
              '⏱️ Simulacion completa de 15 segundos',
            ].map((text, i) => (
              <Text key={i} style={styles.infoItem}>{text}</Text>
            ))}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Como medir realmente</Text>
            <Text style={styles.infoText}>
              En una medicion real, coloca tu dedo indice sobre la camara trasera,
              cubriendo tambien el flash. Manten el movil quieto durante 60 segundos.
            </Text>
          </View>

          <TouchableOpacity style={styles.startBtn} onPress={startSimulation}>
            <Text style={styles.startBtnText}>{'Iniciar Simulacion'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.realBtn} onPress={() => navigation.navigate('Main')}>
            <Text style={styles.realBtnText}>{'Ir a medicion real'}</Text>
          </TouchableOpacity>

          <LegalDisclaimer />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Estado simulating ───────────────────────────────────────────────────────
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.simSafe}>
      <View style={styles.simContainer}>
        {/* Header */}
        <View style={styles.simHeader}>
          <Text style={styles.simTitle}>{'🔬 Simulando...'}</Text>
          <TouchableOpacity onPress={resetToIdle} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>{'✕'}</Text>
          </TouchableOpacity>
        </View>

        {/* Blue heart animation (💙 instead of red) */}
        <View style={styles.heartContainer}>
          <Animated.Text style={[styles.heartIcon, { transform: [{ scale: pulseAnim }] }]}>
            {'💙'}
          </Animated.Text>
          <Text style={styles.heartBPM}>{liveBPM > 0 ? liveBPM : '---'}</Text>
          <Text style={styles.heartLabel}>
            {liveBPM > 0 ? 'BPM detectado' : 'Generando senal...'}
          </Text>
        </View>

        {/* Timer */}
        <View style={styles.timerRow}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.timerText}>{timer}s</Text>
        </View>

        {/* Waveform sintetico */}
        <View style={styles.waveformCard}>
          <Text style={styles.waveformLabel}>SENAL PPG SINTETICA</Text>
          <TutorialWaveform data={liveWaveform} color={qualityColor} />
        </View>

        {/* Calidad */}
        <View style={styles.qualityRow}>
          <View style={[styles.qualityDot, { backgroundColor: qualityColor }]} />
          <Text style={[styles.qualityText, { color: qualityColor }]}>
            {liveQuality > 0.6
              ? 'Senal buena'
              : liveQuality > 0.3
                ? 'Senal regular'
                : 'Generando...'}
          </Text>
        </View>

        <Text style={styles.framesText}>{rawValues.length} frames generados</Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Dynamic styles factory ─────────────────────────────────────────────────────
function createStyles(colors) {
  return StyleSheet.create({
    // ── Shared ──
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 20, paddingBottom: 40 },

    // ── Hero section (idle) ──
    heroSection: { alignItems: 'center', marginBottom: 28, marginTop: 20 },
    heroIcon: { fontSize: 64, marginBottom: 16 },
    heroTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    heroSub: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },

    // ── Info cards (idle) ──
    infoCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    infoTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 12,
    },
    infoItem: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 24,
    },
    infoText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 22,
    },

    // ── Buttons (idle) ──
    startBtn: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      padding: 18,
      alignItems: 'center',
      marginBottom: 12,
    },
    startBtnText: {
      color: colors.textOnPrimary,
      fontSize: 18,
      fontWeight: '700',
    },
    realBtn: {
      backgroundColor: 'transparent',
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    realBtnText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '600',
    },

    // ── Simulation safe (dark camera viewfinder) ──
    simSafe: { flex: 1, backgroundColor: SIM_BG },
    simContainer: { flex: 1, padding: 20 },
    simHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    simTitle: { color: colors.warning, fontSize: 18, fontWeight: '700' },
    closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    closeBtnText: { color: colors.textMuted, fontSize: 22, fontWeight: '600' },

    // ── Heart animation ──
    heartContainer: { alignItems: 'center', marginBottom: 20 },
    heartIcon: { fontSize: 64, marginBottom: 8 },
    heartBPM: {
      color: colors.textOnPrimary,
      fontSize: 56,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    heartLabel: { color: colors.textMuted, fontSize: 13, marginTop: 2 },

    // ── Progress ──
    timerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    progressBar: {
      flex: 1,
      height: 6,
      backgroundColor: SIM_CARD_BG,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: colors.primaryLight, borderRadius: 3 },
    timerText: {
      color: colors.textOnPrimary,
      fontSize: 20,
      fontWeight: '700',
      width: 36,
      textAlign: 'right',
    },

    // ── Waveform card ──
    waveformCard: {
      backgroundColor: SIM_CARD_BG,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: SIM_BORDER,
    },
    waveformLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
      marginBottom: 8,
    },

    // ── Quality indicator ──
    qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    qualityDot: { width: 8, height: 8, borderRadius: 4 },
    qualityText: { fontSize: 13, fontWeight: '600' },
    framesText: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },

    // ── Results header ──
    resultsHeader: { marginBottom: 24 },
    resultsTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    resultsSub: { color: colors.warning, fontSize: 13, marginTop: 4 },

    // ── Result cards (white, elevated) ──
    resultCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: 20,
      padding: 24,
      marginBottom: 16,
      borderWidth: 1,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    cardLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 16,
    },
    bigValue: {
      fontSize: 72,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      lineHeight: 76,
    },
    bigUnit: { color: colors.textSecondary, fontSize: 13, marginTop: 6, marginBottom: 12 },
    badge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 10 },
    badgeText: { fontSize: 14, fontWeight: '700' },

    // ── Metrics grid ──
    metricsCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    metricItem: { width: '31%', alignItems: 'center', marginBottom: 12 },
    metricVal: { fontSize: 20, fontWeight: '700' },
    metricLabel: { color: colors.textMuted, fontSize: 11, marginTop: 4 },

    // ── Action buttons (results) ──
    actionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
    primaryBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 14,
      padding: 16,
      alignItems: 'center',
    },
    primaryBtnText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '700' },
    secondaryBtn: {
      flex: 1,
      backgroundColor: 'transparent',
      borderRadius: 14,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    secondaryBtnText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  });
}
