/**
 * ResultsScreen.js — VitalPulse v5.0
 *
 * Pantalla de resultados con diseño minimalista premium blanco.
 * Jerarquía UX: Alertas -> FC -> PA -> Calidad -> HRV -> Acciones.
 */
import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { classifyBPM, classifyBP } from '../utils/bpEstimator';
import {
  translateSignalQuality,
  translateConfidence,
  translateHRV,
  translateStability,
  translateSaturated,
  validateMeasurement,
} from '../utils/uxTranslations';
import LegalDisclaimer from '../components/LegalDisclaimer';
import { shareMeasurementSummary } from '../services/exportService';
import { showInterstitialAd } from '../services/ads';
import { COLORS, SHADOWS, RADIUS } from '../theme/designTokens';

export default function ResultsScreen({ navigation, route }) {
  // Mostrar anuncio intersticial después de cada medición
  useEffect(() => {
    const timer = setTimeout(() => {
      showInterstitialAd();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!route?.params?.measurement) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgCard} />
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>No hay datos de medición disponibles.</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('HomeMain')}
          >
            <Text style={styles.primaryBtnText}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { measurement } = route.params;
  const { bpm, bp, quality, confidence, rrIntervals, sdnn, saturated, stability } = measurement;

  // Traducciones UX
  const qualityUX = translateSignalQuality(quality);
  const confidenceUX = translateConfidence(confidence);
  const hrvUX = translateHRV(sdnn, rrIntervals?.length);
  const stabilityUX = translateStability(stability);
  const saturatedAlert = translateSaturated(saturated);

  // Validaciones
  const issues = validateMeasurement(measurement);
  const hasCriticalIssue = issues.some(i => i.type === 'error');
  const hasWarning = issues.some(i => i.type === 'warning');
  const showAdvancedHRV =
    !hasCriticalIssue && (rrIntervals?.length || 0) >= 10 && (quality || 0) >= 0.3;

  // Clasificaciones
  const bpmClass = classifyBPM(bpm);
  const bpClass = bp ? classifyBP(bp.systolic, bp.diastolic) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgCard} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Nivel 0: Alertas y validaciones ───────────────────────────── */}
          {issues.map((issue, i) => {
            const alertStyle =
              issue.type === 'error'
                ? styles.alertError
                : issue.type === 'warning'
                  ? styles.alertWarning
                  : styles.alertInfo;
            const alertBorderStyle =
              issue.type === 'error'
                ? styles.alertBorderError
                : issue.type === 'warning'
                  ? styles.alertBorderWarning
                  : styles.alertBorderInfo;
            return (
              <View key={i} style={[styles.alertCard, alertStyle, alertBorderStyle]}>
                <View style={styles.alertRow}>
                  <Text style={styles.alertIcon}>{issue.icon}</Text>
                  <View style={styles.alertTextWrap}>
                    <Text style={styles.alertTitle}>{issue.title}</Text>
                    <Text style={styles.alertMessage}>{issue.message}</Text>
                  </View>
                </View>
              </View>
            );
          })}

          {/* ─── Nivel 1: Resultado principal — FC ────────────────────────── */}
          <View style={styles.resultCard}>
            <Text style={styles.cardLabel}>Frecuencia cardíaca</Text>
            <Text style={[styles.bpmValue, { color: bpmClass.color }]}>
              {bpm || '—'}
            </Text>
            <Text style={styles.cardUnit}>pulsaciones por minuto</Text>
            <View
              style={[
                styles.badgePill,
                { backgroundColor: bpmClass.color + '18' },
              ]}
            >
              <Text style={[styles.badgePillText, { color: bpmClass.color }]}>
                {bpmClass.label}
              </Text>
            </View>
            <Text style={styles.rangeText}>Rango normal en reposo: 60–100 BPM</Text>
          </View>

          {/* ─── Nivel 1: Resultado principal — PA ────────────────────────── */}
          {bp && bpClass && (
            <View style={styles.resultCard}>
              <Text style={styles.cardLabel}>Presión arterial estimada</Text>
              {!bp.isCalibrated && (
                <View style={styles.calibrationWarning}>
                  <Text style={styles.calibrationWarningText}>
                    ⚡ Sin calibración — valores orientativos
                  </Text>
                </View>
              )}
              {bp.isCalibrated && (
                <View style={styles.calibrationOk}>
                  <Text style={styles.calibrationOkText}>
                    ✅ Calibrado con {bp.calibrationPoints ?? 0} punto
                    {(bp.calibrationPoints ?? 0) > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
              <Text style={[styles.bpValue, { color: bpClass.color }]}>
                {bp.systolic}/{bp.diastolic}
              </Text>
              <Text style={styles.cardUnit}>mmHg (sistólica / diastólica)</Text>
              <View
                style={[
                  styles.badgePill,
                  { backgroundColor: bpClass.color + '18' },
                ]}
              >
                <Text style={[styles.badgePillText, { color: bpClass.color }]}>
                  {bpClass.label}
                </Text>
              </View>
              <Text style={styles.rangeText}>Óptima: menor a 120/80 mmHg</Text>
            </View>
          )}

          {/* ─── Nivel 2: Calidad de la medición — Grid 3x2 ──────────────── */}
          <View style={styles.qualityCard}>
            <Text style={styles.cardLabel}>Calidad de la medición</Text>

            <View style={styles.qualityGrid}>
              {/* Señal */}
              <View style={styles.qualityCell}>
                <Text style={styles.qualityCellIcon}>
                  {qualityUX.icon || '📶'}
                </Text>
                <Text
                  style={[styles.qualityCellValue, { color: qualityUX.color }]}
                  numberOfLines={1}
                >
                  {qualityUX.label}
                </Text>
                <Text style={styles.qualityCellLabel}>Señal</Text>
              </View>

              {/* Confianza */}
              <View style={styles.qualityCell}>
                <Text style={styles.qualityCellIcon}>🎯</Text>
                <Text
                  style={[styles.qualityCellValue, { color: confidenceUX.color }]}
                  numberOfLines={1}
                >
                  {confidenceUX.label}
                </Text>
                <Text style={styles.qualityCellLabel}>Confianza</Text>
              </View>

              {/* Estabilidad */}
              <View style={styles.qualityCell}>
                <Text style={styles.qualityCellIcon}>⚖️</Text>
                <Text
                  style={[styles.qualityCellValue, { color: stabilityUX.color }]}
                  numberOfLines={1}
                >
                  {stabilityUX.label}
                </Text>
                <Text style={styles.qualityCellLabel}>Estabilidad</Text>
              </View>

              {/* Frames */}
              <View style={styles.qualityCell}>
                <Text style={styles.qualityCellIcon}>📊</Text>
                <Text style={styles.qualityCellValue}>
                  {measurement.signalLength || 0}
                </Text>
                <Text style={styles.qualityCellLabel}>Frames</Text>
              </View>

              {/* Latidos */}
              <View style={styles.qualityCell}>
                <Text style={styles.qualityCellIcon}>❤️</Text>
                <Text style={styles.qualityCellValue}>
                  {rrIntervals?.length || 0}
                </Text>
                <Text style={styles.qualityCellLabel}>Latidos</Text>
              </View>

              {/* Sensor */}
              <View style={styles.qualityCell}>
                <Text style={styles.qualityCellIcon}>
                  {saturatedAlert ? '💡' : '✅'}
                </Text>
                <Text
                  style={[
                    styles.qualityCellValue,
                    {
                      color: saturatedAlert
                        ? saturatedAlert.color
                        : COLORS.success,
                      fontSize: 13,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {saturatedAlert ? 'Saturada' : 'Normal'}
                </Text>
                <Text style={styles.qualityCellLabel}>Sensor</Text>
              </View>
            </View>

            {hasWarning && !hasCriticalIssue && (
              <Text style={styles.qualityHint}>
                💡 Los resultados son aproximados. Para mejor precisión, recoloca
                el dedo y vuelve a medir.
              </Text>
            )}
          </View>

          {/* ─── Nivel 3: HRV avanzado ────────────────────────────────────── */}
          {showAdvancedHRV ? (
            <View style={styles.hrvCard}>
              <Text style={styles.cardLabel}>Variabilidad cardíaca (HRV)</Text>
              <View style={styles.hrvHeader}>
                <Text style={styles.hrvIcon}>{hrvUX.icon}</Text>
                <Text style={[styles.hrvTitle, { color: hrvUX.color }]}>
                  {hrvUX.label}
                </Text>
              </View>
              <Text style={styles.hrvDescription}>{hrvUX.description}</Text>
              {hrvUX.showValues && (
                <View style={styles.hrvMetricsRow}>
                  <View style={styles.hrvMetricBlock}>
                    <Text
                      style={[
                        styles.hrvMetricBlockValue,
                        { color: hrvUX.color },
                      ]}
                    >
                      {hrvUX.sdnnMs ?? '—'}
                    </Text>
                    <Text style={styles.hrvMetricBlockUnit}>ms</Text>
                    <Text style={styles.hrvMetricBlockLabel}>SDNN</Text>
                  </View>
                  <View style={styles.hrvMetricDivider} />
                  <View style={styles.hrvMetricBlock}>
                    <Text
                      style={[
                        styles.hrvMetricBlockValue,
                        { color: hrvUX.color },
                      ]}
                    >
                      {hrvUX.latidos ?? '—'}
                    </Text>
                    <Text style={styles.hrvMetricBlockUnit}>latidos</Text>
                    <Text style={styles.hrvMetricBlockLabel}>Registrados</Text>
                  </View>
                  <View style={styles.hrvMetricDivider} />
                  <View style={styles.hrvMetricBlock}>
                    <Text
                      style={[
                        styles.hrvMetricBlockValue,
                        { color: hrvUX.color, fontSize: 20 },
                      ]}
                    >
                      {hrvUX.score ?? '—'}
                      <Text style={styles.hrvMetricBlockScoreMax}>/4</Text>
                    </Text>
                    <Text style={styles.hrvMetricBlockLabel}>Puntuación</Text>
                  </View>
                </View>
              )}
              <Text style={styles.rangeText}>
                HRV normal: 50–100 ms · Mayor HRV = mejor salud cardiovascular
              </Text>
            </View>
          ) : (
            <View style={styles.hrvCard}>
              <Text style={styles.cardLabel}>Variabilidad cardíaca (HRV)</Text>
              <View style={styles.hrvEmptyState}>
                <Text style={styles.hrvEmptyIcon}>⏱️</Text>
                <Text style={styles.hrvEmptyTitle}>Datos insuficientes</Text>
                <Text style={styles.hrvEmptyText}>
                  {hasCriticalIssue
                    ? 'La medición fue demasiado corta. Mantén el dedo quieto sobre la cámara durante 60 segundos completos para obtener datos de HRV.'
                    : 'Se necesitan más latidos para analizar la variabilidad cardíaca. Continúa midiendo regularmente.'}
                </Text>
              </View>
            </View>
          )}

          {/* ─── Acciones ─────────────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => shareMeasurementSummary(measurement)}
          >
            <Text style={styles.shareBtnIcon}>📤</Text>
            <Text style={styles.shareBtnText}>Compartir resultado</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.calibrateBtn}
            onPress={() => navigation.navigate('Calibration', { measurement })}
          >
            <Text style={styles.calibrateBtnIcon}>📏</Text>
            <Text style={styles.calibrateBtnText}>
              Tengo un tensiómetro — calibrar para mayor precisión
            </Text>
          </TouchableOpacity>

          {/* Disclaimer legal */}
          <LegalDisclaimer />

          {/* Navegación principal */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('Measure')}
            >
              <Text style={styles.primaryBtnText}>Nueva medición</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('HomeMain')}
            >
              <Text style={styles.secondaryBtnText}>Inicio</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ─── Contenedores principales ──────────────────────────────────────────
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  // ─── Estado vacío / error ──────────────────────────────────────────────
  errorIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },

  // ─── Alertas / Issues ──────────────────────────────────────────────────
  alertCard: {
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  alertError: {
    backgroundColor: COLORS.dangerLight,
  },
  alertWarning: {
    backgroundColor: COLORS.warningLight,
  },
  alertInfo: {
    backgroundColor: COLORS.primarySubtle,
  },
  alertBorderError: {
    borderLeftColor: COLORS.danger,
  },
  alertBorderWarning: {
    borderLeftColor: COLORS.warning,
  },
  alertBorderInfo: {
    borderLeftColor: COLORS.info,
  },
  alertRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  alertIcon: {
    fontSize: 18,
    marginTop: 1,
  },
  alertTextWrap: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },

  // ─── Tarjetas de resultado ─────────────────────────────────────────────
  resultCard: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.xl,
    paddingVertical: 28,
    paddingHorizontal: 24,
    marginBottom: 16,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  cardUnit: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  rangeText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },

  // ─── BPM — valor grande ────────────────────────────────────────────────
  bpmValue: {
    fontSize: 72,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 80,
  },

  // ─── PA — valor grande ─────────────────────────────────────────────────
  bpValue: {
    fontSize: 48,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 54,
  },

  // ─── Badge tipo pill ───────────────────────────────────────────────────
  badgePill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 20,
    paddingVertical: 6,
    marginBottom: 10,
  },
  badgePillText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ─── Calibración ───────────────────────────────────────────────────────
  calibrationWarning: {
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    width: '100%',
  },
  calibrationWarningText: {
    color: COLORS.warning,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  calibrationOk: {
    backgroundColor: COLORS.successLight,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    width: '100%',
  },
  calibrationOkText: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ─── Calidad de la medición ────────────────────────────────────────────
  qualityCard: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 16,
    ...SHADOWS.card,
  },
  qualityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  qualityCell: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 8,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qualityCellIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  qualityCellValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  qualityCellLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  qualityHint: {
    color: COLORS.warning,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 18,
  },

  // ─── HRV ───────────────────────────────────────────────────────────────
  hrvCard: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 16,
    ...SHADOWS.card,
  },
  hrvHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  hrvIcon: {
    fontSize: 24,
  },
  hrvTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  hrvDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  hrvMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  hrvMetricBlock: {
    flex: 1,
    alignItems: 'center',
  },
  hrvMetricBlockValue: {
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hrvMetricBlockScoreMax: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.textMuted,
  },
  hrvMetricBlockUnit: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
    fontWeight: '500',
    textTransform: 'lowercase',
  },
  hrvMetricBlockLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hrvMetricDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
  hrvEmptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  hrvEmptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  hrvEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  hrvEmptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },

  // ─── Botones de acción ─────────────────────────────────────────────────
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySubtle,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  shareBtnIcon: {
    fontSize: 16,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  calibrateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 8,
  },
  calibrateBtnIcon: {
    fontSize: 16,
  },
  calibrateBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
  },

  // ─── Navegación ────────────────────────────────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
