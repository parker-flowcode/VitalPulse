/**
 * ResultsScreen.js — VitalPulse v5.0
 *
 * Pantalla de resultados con diseño minimalista premium blanco.
 * Jerarquía UX: Alertas -> FC -> PA -> Calidad -> HRV -> Acciones.
 *
 * Responsive: se adapta a pantallas estrechas (<360dp) como Samsung S22.
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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  // ─── Responsive: dimensiones de pantalla y área segura ──────────────
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // ─── Responsive: valores calculados ─────────────────────────────────
  const isNarrow = screenWidth < 360;
  const bpmFontSize = isNarrow ? 56 : 72;
  const bpFontSize = isNarrow ? 40 : 48;
  const cardPadH = isNarrow ? 16 : 24;
  const cardPadV = isNarrow ? 20 : 28;
  const alertPadV = isNarrow ? 10 : 14;
  const alertPadH = isNarrow ? 12 : 16;
  const hrvValFontSize = isNarrow ? 20 : 24;

  // ─── Responsive: cuadrícula de calidad (2 o 3 columnas) ────────────
  const gridColumns = isNarrow ? 2 : 3;
  const gridPadding = 20;
  const gridGap = 8;
  const qualityCellWidth = Math.floor(
    (screenWidth - 2 * gridPadding - 2 * gridGap) / gridColumns,
  );

  // ─── Anuncio intersticial después de cada medición ──────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      showInterstitialAd();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // ─── Estado vacío / error ───────────────────────────────────────────
  if (!route?.params?.measurement) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgCard} />
        <View style={styles.center}>
          <Text style={styles.errorIcon}>{'⚠️'}</Text>
          <Text style={styles.errorText}>
            No hay datos de medición disponibles.
          </Text>
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

  // ─── Extraer datos de la medición ───────────────────────────────────
  const { measurement } = route.params;
  const {
    bpm,
    bp,
    quality,
    confidence,
    rrIntervals,
    sdnn,
    saturated,
    stability,
  } = measurement;

  // ─── Traducciones UX ────────────────────────────────────────────────
  const qualityUX = translateSignalQuality(quality);
  const confidenceUX = translateConfidence(confidence);
  const hrvUX = translateHRV(sdnn, rrIntervals?.length);
  const stabilityUX = translateStability(stability);
  const saturatedAlert = translateSaturated(saturated);

  // ─── Validaciones ───────────────────────────────────────────────────
  const issues = validateMeasurement(measurement);
  const hasCriticalIssue = issues.some((i) => i.type === 'error');
  const hasWarning = issues.some((i) => i.type === 'warning');
  const showAdvancedHRV =
    !hasCriticalIssue &&
    (rrIntervals?.length || 0) >= 10 &&
    (quality || 0) >= 0.3;

  // ─── Clasificaciones ────────────────────────────────────────────────
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
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 80 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Nivel 0: Alertas y validaciones ───────────────────── */}
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
              <View
                key={i}
                style={[
                  styles.alertCard,
                  alertStyle,
                  alertBorderStyle,
                  {
                    paddingVertical: alertPadV,
                    paddingHorizontal: alertPadH,
                  },
                ]}
              >
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

          {/* ─── Nivel 1: Resultado principal — FC ────────────────── */}
          <View
            style={[
              styles.resultCard,
              {
                paddingVertical: cardPadV,
                paddingHorizontal: cardPadH,
              },
            ]}
          >
            <Text style={styles.cardLabel}>Frecuencia cardíaca</Text>
            <Text
              style={[
                styles.bpmValue,
                { fontSize: bpmFontSize, lineHeight: bpmFontSize * 1.1 },
                { color: bpmClass.color },
              ]}
            >
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
            <Text style={styles.rangeText}>
              Rango normal en reposo: 60–100 BPM
            </Text>
          </View>

          {/* ─── Nivel 1: Resultado principal — PA ────────────────── */}
          {bp && bpClass && (
            <View
              style={[
                styles.resultCard,
                {
                  paddingVertical: cardPadV,
                  paddingHorizontal: cardPadH,
                },
              ]}
            >
              <Text style={styles.cardLabel}>
                Presión arterial estimada
              </Text>
              {!bp.isCalibrated && (
                <View style={styles.calibrationWarning}>
                  <Text style={styles.calibrationWarningText}>
                    {'⚡'} Sin calibración — valores orientativos
                  </Text>
                </View>
              )}
              {bp.isCalibrated && (
                <View style={styles.calibrationOk}>
                  <Text style={styles.calibrationOkText}>
                    {'✅'} Calibrado con {bp.calibrationPoints ?? 0} punto
                    {(bp.calibrationPoints ?? 0) > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
              <Text
                style={[
                  styles.bpValue,
                  { fontSize: bpFontSize, lineHeight: bpFontSize * 1.1 },
                  { color: bpClass.color },
                ]}
              >
                {bp.systolic}/{bp.diastolic}
              </Text>
              <Text style={styles.cardUnit}>
                mmHg (sistólica / diastólica)
              </Text>
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
              <Text style={styles.rangeText}>
                Óptima: menor a 120/80 mmHg
              </Text>
            </View>
          )}

          {/* ─── Nivel 2: Calidad de la medición — Grid dinámico ──── */}
          <View style={styles.qualityCard}>
            <Text style={styles.cardLabel}>
              Calidad de la medición
            </Text>

            <View
              style={[
                styles.qualityGrid,
                {
                  gap: gridGap,
                },
              ]}
            >
              {/* Señal */}
              <View
                style={[styles.qualityCell, { width: qualityCellWidth }]}
              >
                <Text style={styles.qualityCellIcon}>
                  {qualityUX.icon || '📶'}
                </Text>
                <Text
                  style={[
                    styles.qualityCellValue,
                    { color: qualityUX.color },
                  ]}
                  numberOfLines={2}
                >
                  {qualityUX.label}
                </Text>
                <Text style={styles.qualityCellLabel}>Señal</Text>
              </View>

              {/* Confianza */}
              <View
                style={[styles.qualityCell, { width: qualityCellWidth }]}
              >
                <Text style={styles.qualityCellIcon}>{'🎯'}</Text>
                <Text
                  style={[
                    styles.qualityCellValue,
                    { color: confidenceUX.color },
                  ]}
                  numberOfLines={2}
                >
                  {confidenceUX.label}
                </Text>
                <Text style={styles.qualityCellLabel}>Confianza</Text>
              </View>

              {/* Estabilidad */}
              <View
                style={[styles.qualityCell, { width: qualityCellWidth }]}
              >
                <Text style={styles.qualityCellIcon}>
                  {'⚖️'}
                </Text>
                <Text
                  style={[
                    styles.qualityCellValue,
                    { color: stabilityUX.color },
                  ]}
                  numberOfLines={2}
                >
                  {stabilityUX.label}
                </Text>
                <Text style={styles.qualityCellLabel}>Estabilidad</Text>
              </View>

              {/* Frames */}
              <View
                style={[styles.qualityCell, { width: qualityCellWidth }]}
              >
                <Text style={styles.qualityCellIcon}>
                  {'📊'}
                </Text>
                <Text
                  style={styles.qualityCellValue}
                  numberOfLines={2}
                >
                  {measurement.signalLength || 0}
                </Text>
                <Text style={styles.qualityCellLabel}>Frames</Text>
              </View>

              {/* Latidos */}
              <View
                style={[styles.qualityCell, { width: qualityCellWidth }]}
              >
                <Text style={styles.qualityCellIcon}>
                  {'❤️'}
                </Text>
                <Text
                  style={styles.qualityCellValue}
                  numberOfLines={2}
                >
                  {rrIntervals?.length || 0}
                </Text>
                <Text style={styles.qualityCellLabel}>Latidos</Text>
              </View>

              {/* Sensor */}
              <View
                style={[styles.qualityCell, { width: qualityCellWidth }]}
              >
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
                    },
                  ]}
                  numberOfLines={2}
                >
                  {saturatedAlert ? 'Saturada' : 'Normal'}
                </Text>
                <Text style={styles.qualityCellLabel}>Sensor</Text>
              </View>
            </View>

            {hasWarning && !hasCriticalIssue && (
              <Text style={styles.qualityHint}>
                {'💡'} Los resultados son aproximados. Para mejor
                precisión, recoloca el dedo y vuelve a medir.
              </Text>
            )}
          </View>

          {/* ─── Nivel 3: HRV avanzado ────────────────────────────── */}
          {showAdvancedHRV ? (
            <View style={styles.hrvCard}>
              <Text style={styles.cardLabel}>
                Variabilidad cardíaca (HRV)
              </Text>
              <View style={styles.hrvHeader}>
                <Text style={styles.hrvIcon}>{hrvUX.icon}</Text>
                <Text style={[styles.hrvTitle, { color: hrvUX.color }]}>
                  {hrvUX.label}
                </Text>
              </View>
              <Text style={styles.hrvDescription}>
                {hrvUX.description}
              </Text>
              {hrvUX.showValues && (
                <View style={styles.hrvMetricsRow}>
                  <View style={styles.hrvMetricBlock}>
                    <Text
                      style={[
                        styles.hrvMetricBlockValue,
                        {
                          fontSize: hrvValFontSize,
                          lineHeight: hrvValFontSize * 1.15,
                        },
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
                        {
                          fontSize: hrvValFontSize,
                          lineHeight: hrvValFontSize * 1.15,
                        },
                        { color: hrvUX.color },
                      ]}
                    >
                      {hrvUX.latidos ?? '—'}
                    </Text>
                    <Text style={styles.hrvMetricBlockUnit}>latidos</Text>
                    <Text style={styles.hrvMetricBlockLabel}>
                      Registrados
                    </Text>
                  </View>
                  <View style={styles.hrvMetricDivider} />
                  <View style={styles.hrvMetricBlock}>
                    <Text
                      style={[
                        styles.hrvMetricBlockValue,
                        {
                          fontSize: hrvValFontSize,
                          lineHeight: hrvValFontSize * 1.15,
                        },
                        { color: hrvUX.color },
                      ]}
                    >
                      {hrvUX.score ?? '—'}
                      <Text style={styles.hrvMetricBlockScoreMax}>
                        /4
                      </Text>
                    </Text>
                    <Text style={styles.hrvMetricBlockLabel}>
                      Puntuación
                    </Text>
                  </View>
                </View>
              )}
              <Text style={styles.rangeText}>
                HRV normal: 50–100 ms {'·'} Mayor HRV = mejor salud
                cardiovascular
              </Text>
            </View>
          ) : (
            <View style={styles.hrvCard}>
              <Text style={styles.cardLabel}>
                Variabilidad cardíaca (HRV)
              </Text>
              <View style={styles.hrvEmptyState}>
                <Text style={styles.hrvEmptyIcon}>
                  {'⏱️'}
                </Text>
                <Text style={styles.hrvEmptyTitle}>
                  Datos insuficientes
                </Text>
                <Text style={styles.hrvEmptyText}>
                  {hasCriticalIssue
                    ? 'La medición fue demasiado corta. Mantén el dedo quieto sobre la cámara durante 60 segundos completos para obtener datos de HRV.'
                    : 'Se necesitan más latidos para analizar la variabilidad cardíaca. Continúa midiendo regularmente.'}
                </Text>
              </View>
            </View>
          )}

          {/* ─── Acciones ──────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => shareMeasurementSummary(measurement)}
          >
            <Text style={styles.shareBtnIcon}>{'📤'}</Text>
            <Text style={styles.shareBtnText}>
              Compartir resultado
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.calibrateBtn}
            onPress={() =>
              navigation.navigate('Calibration', { measurement })
            }
          >
            <Text style={styles.calibrateBtnIcon}>{'📏'}</Text>
            <Text style={styles.calibrateBtnText}>
              Tengo un tensiómetro — calibrar para mayor
              precisión
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
              <Text style={styles.primaryBtnText}>
                Nueva medición
              </Text>
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

// ─── Estilos (los valores dinámicos se aplican inline en el JSX) ─────
const styles = StyleSheet.create({
  // ─── Contenedores principales ──────────────────────────────────────
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
  },
  scroll: {
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  // ─── Estado vacío / error ──────────────────────────────────────────
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

  // ─── Alertas / Issues ──────────────────────────────────────────────
  alertCard: {
    borderRadius: RADIUS.md,
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

  // ─── Tarjetas de resultado ─────────────────────────────────────────
  resultCard: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.xl,
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

  // ─── BPM — valor grande (fontSize dinámico inline) ─────────────────
  bpmValue: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  // ─── PA — valor grande (fontSize dinámico inline) ──────────────────
  bpValue: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  // ─── Badge tipo pill ───────────────────────────────────────────────
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

  // ─── Calibración ───────────────────────────────────────────────────
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

  // ─── Calidad de la medición ────────────────────────────────────────
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
    marginTop: 4,
  },
  qualityCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qualityCellIcon: {
    fontSize: 18,
    marginBottom: 4,
    textAlign: 'center',
  },
  qualityCellValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  qualityCellLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  qualityHint: {
    color: COLORS.warning,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 18,
  },

  // ─── HRV ───────────────────────────────────────────────────────────
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
    minWidth: 80,
  },
  hrvMetricBlockValue: {
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

  // ─── Botones de acción ─────────────────────────────────────────────
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
    flexShrink: 1,
  },

  // ─── Navegación ────────────────────────────────────────────────────
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
