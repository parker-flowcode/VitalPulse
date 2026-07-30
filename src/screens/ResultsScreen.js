/**
 * ResultsScreen.js — VitalPulse v9.0
 *
 * Glassmorphism compact design with premium sky-blue aesthetic.
 * Compact <900px total scrollable height.
 * Responsive: adapts to narrow screens (<360dp).
 */

import React, { useEffect, useMemo } from 'react';
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
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { classifyBPM, classifyBP } from '../utils/bpEstimator';
import {
  translateSignalQuality,
  translateConfidence,
  translateHRV,
  translateStability,
  translateSaturated,
  validateMeasurement,
} from '../utils/uxTranslations';
import BottomWarningAdWrapper from '../components/BottomWarningAdWrapper';
import { shareMeasurementSummary } from '../services/exportService';
import { showInterstitialAd } from '../services/ads';
import { SPACING, RADIUS, SHADOWS } from '../theme/designTokens';

export default function ResultsScreen({ navigation, route }) {
  const { colors, resolvedTheme } = useTheme();

  // ─── Responsive: dimensions and insets ─────────────────────────────────
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // ─── Responsive: computed values ──────────────────────────────────────
  const isNarrow = screenWidth < 360;
  const bpmFontSize = isNarrow ? 40 : 48;
  const bpFontSize = isNarrow ? 30 : 36;
  const gridPadH = isNarrow ? 14 : 16;
  const gridPadV = isNarrow ? 10 : 12;
  const alertPadV = isNarrow ? 6 : 8;
  const alertPadH = isNarrow ? 10 : 12;
  const hrvValFontSize = isNarrow ? 17 : 20;

  // ─── Quality grid: always 2 rows x 3 columns ──────────────────────────
  const gridPadding = gridPadH;
  const gridGap = 6;
  const qualityCellWidth = Math.floor(
    (screenWidth - 2 * gridPadding - 2 * gridGap) / 3,
  );

  // ─── Dynamic styles ───────────────────────────────────────────────────
  const styles = useMemo(() => createStyles(colors, resolvedTheme), [colors, resolvedTheme]);

  // ─── Interstitial ad after each measurement ───────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      showInterstitialAd();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // ─── Empty / error state ──────────────────────────────────────────────
  if (!route?.params?.measurement) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgCard }]}>
        <StatusBar barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bgCard} />
        <View style={styles.center}>
          <Icon name="alert" size={36} color={colors.warning} style={{ marginBottom: 14 }} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            No hay datos de medición disponibles.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('HomeMain')}
          >
            <Text style={[styles.primaryBtnText, { color: colors.textOnPrimary }]}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Extract measurement data ─────────────────────────────────────────
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

  // ─── UX translations ──────────────────────────────────────────────────
  const qualityUX = translateSignalQuality(quality);
  const confidenceUX = translateConfidence(confidence);
  const hrvUX = translateHRV(sdnn, rrIntervals?.length);
  const stabilityUX = translateStability(stability);
  const saturatedAlert = translateSaturated(saturated);

  // ─── Validations ──────────────────────────────────────────────────────
  const issues = validateMeasurement(measurement);
  const hasCriticalIssue = issues.some((i) => i.type === 'error');
  const hasWarning = issues.some((i) => i.type === 'warning');
  const showAdvancedHRV =
    !hasCriticalIssue &&
    (rrIntervals?.length || 0) >= 10 &&
    (quality || 0) >= 0.3;

  // ─── Classifications ──────────────────────────────────────────────────
  const bpmClass = classifyBPM(bpm);
  const bpClass = bp ? classifyBP(bp.systolic, bp.diastolic) : null;

  // ─── Map issue type to icon name ──────────────────────────────────────
  const getIssueIconName = (type) => {
    if (type === 'error') return 'alert-circle';
    if (type === 'warning') return 'alert-outline';
    return 'information';
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgCard }]}>
      <StatusBar barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bgCard} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom + 40, 40) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Alerts / Issues ───────────────────────────────────── */}
          {issues.map((issue, i) => {
            const alertBg =
              issue.type === 'error'
                ? colors.dangerLight
                : issue.type === 'warning'
                  ? colors.warningLight
                  : colors.primarySubtle;
            const alertBorderColor =
              issue.type === 'error'
                ? colors.danger
                : issue.type === 'warning'
                  ? colors.warning
                  : colors.info;
            return (
              <View
                key={i}
                style={[
                  styles.alertCard,
                  {
                    backgroundColor: alertBg,
                    borderLeftColor: alertBorderColor,
                    paddingVertical: alertPadV,
                    paddingHorizontal: alertPadH,
                  },
                ]}
              >
                <View style={styles.alertRow}>
                  <Icon name={getIssueIconName(issue.type)} size={14} color={alertBorderColor} />
                  <View style={styles.alertTextWrap}>
                    <Text style={[styles.alertTitle, { color: colors.textPrimary }]}>{issue.title}</Text>
                    <Text style={[styles.alertMessage, { color: colors.textSecondary }]}>{issue.message}</Text>
                  </View>
                </View>
              </View>
            );
          })}

          {/* ─── BPM Card ──────────────────────────────────────────── */}
          <View
            style={[
              styles.glassCard,
              styles.glassBpmCard,
              SHADOWS.elevated,
            ]}
          >
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>FRECUENCIA CARDÍACA</Text>
            <Text
              style={[
                styles.bpmValue,
                { fontSize: bpmFontSize, lineHeight: 52 },
                { color: bpmClass.color },
              ]}
            >
              {bpm || '—'}
            </Text>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.badgePill,
                  { backgroundColor: bpmClass.color + '20' },
                ]}
              >
                <Text style={[styles.badgePillText, { color: bpmClass.color }]}>
                  {bpmClass.label}
                </Text>
              </View>
            </View>
          </View>

          {/* ─── BP Card ───────────────────────────────────────────── */}
          {bp && bpClass && (
            <View
              style={[
                styles.glassCard,
                styles.glassBpCard,
                SHADOWS.elevated,
              ]}
            >
              <Text style={[styles.cardLabel, { color: colors.textMuted }]}>PRESION ARTERIAL</Text>
              {!bp.isCalibrated && (
                <View style={[styles.calibrationBadge, { backgroundColor: colors.warningLight }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="lightning-bolt" size={10} color={colors.warning} />
                    <Text style={[styles.calibrationBadgeText, { color: colors.warning, marginLeft: 4 }]}>
                      Sin calibración — valores orientativos
                    </Text>
                  </View>
                </View>
              )}
              {bp.isCalibrated && (
                <View style={[styles.calibrationBadge, { backgroundColor: colors.successLight }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check-circle" size={10} color={colors.success} />
                    <Text style={[styles.calibrationBadgeText, { color: colors.success, marginLeft: 4 }]}>
                      Calibrado ({bp.calibrationPoints ?? 0})
                    </Text>
                  </View>
                </View>
              )}
              <Text
                style={[
                  styles.bpValue,
                  { fontSize: bpFontSize, lineHeight: 40 },
                  { color: bpClass.color },
                ]}
              >
                {bp.systolic}/{bp.diastolic}
              </Text>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.badgePill,
                    { backgroundColor: bpClass.color + '20' },
                  ]}
                >
                  <Text style={[styles.badgePillText, { color: bpClass.color }]}>
                    {bpClass.label}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ─── Quality Grid ──────────────────────────────────────── */}
          <View style={[styles.glassCard, styles.qualityCard]}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>CALIDAD DE LA MEDICIÓN</Text>
            <View style={[styles.qualityGrid, { gap: gridGap }]}>
              {/* Signal */}
              <View style={[styles.qualityCell, { width: qualityCellWidth }]}>
                <Icon name="signal-cellular-3" size={16} color={qualityUX.color || colors.textPrimary} />
                <Text style={[styles.qualityCellValue, { color: qualityUX.color || colors.textPrimary }]} numberOfLines={2}>
                  {qualityUX.label}
                </Text>
                <Text style={[styles.qualityCellLabel, { color: colors.textMuted }]}>Senal</Text>
              </View>
              {/* Confidence */}
              <View style={[styles.qualityCell, { width: qualityCellWidth }]}>
                <Icon name="target" size={16} color={confidenceUX.color || colors.textPrimary} />
                <Text style={[styles.qualityCellValue, { color: confidenceUX.color || colors.textPrimary }]} numberOfLines={2}>
                  {confidenceUX.label}
                </Text>
                <Text style={[styles.qualityCellLabel, { color: colors.textMuted }]}>Confianza</Text>
              </View>
              {/* Stability */}
              <View style={[styles.qualityCell, { width: qualityCellWidth }]}>
                <Icon name="scale-balance" size={16} color={stabilityUX.color || colors.textPrimary} />
                <Text style={[styles.qualityCellValue, { color: stabilityUX.color || colors.textPrimary }]} numberOfLines={2}>
                  {stabilityUX.label}
                </Text>
                <Text style={[styles.qualityCellLabel, { color: colors.textMuted }]}>Estabilidad</Text>
              </View>
              {/* Frames */}
              <View style={[styles.qualityCell, { width: qualityCellWidth }]}>
                <Icon name="chart-bar" size={16} color={colors.textPrimary} />
                <Text style={[styles.qualityCellValue, { color: colors.textPrimary }]} numberOfLines={2}>
                  {measurement.signalLength || 0}
                </Text>
                <Text style={[styles.qualityCellLabel, { color: colors.textMuted }]}>Frames</Text>
              </View>
              {/* Beats */}
              <View style={[styles.qualityCell, { width: qualityCellWidth }]}>
                <Icon name="heart" size={16} color={colors.textPrimary} />
                <Text style={[styles.qualityCellValue, { color: colors.textPrimary }]} numberOfLines={2}>
                  {rrIntervals?.length || 0}
                </Text>
                <Text style={[styles.qualityCellLabel, { color: colors.textMuted }]}>Latidos</Text>
              </View>
              {/* Sensor */}
              <View style={[styles.qualityCell, { width: qualityCellWidth }]}>
                <Icon
                  name={saturatedAlert ? 'lightbulb-on' : 'check-circle'}
                  size={16}
                  color={saturatedAlert ? saturatedAlert.color : colors.success}
                />
                <Text
                  style={[
                    styles.qualityCellValue,
                    { color: saturatedAlert ? saturatedAlert.color : colors.success },
                  ]}
                  numberOfLines={2}
                >
                  {saturatedAlert ? 'Saturada' : 'Normal'}
                </Text>
                <Text style={[styles.qualityCellLabel, { color: colors.textMuted }]}>Sensor</Text>
              </View>
            </View>
            {hasWarning && !hasCriticalIssue && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
                <Icon name="lightbulb-on" size={10} color={colors.warning} />
                <Text style={[styles.qualityHint, { color: colors.warning, marginTop: 0, marginLeft: 4 }]}>
                  Resultados aproximados. Recoloca el dedo y vuelve a medir.
                </Text>
              </View>
            )}
          </View>

          {/* ─── HRV Card ──────────────────────────────────────────── */}
          {showAdvancedHRV ? (
            <View style={[styles.glassCard, styles.hrvCard]}>
              <Text style={[styles.cardLabel, { color: colors.textMuted }]}>VARIABILIDAD CARDÍACA (HRV)</Text>
              <View style={styles.hrvHeader}>
                <Icon name="heart-pulse" size={20} color={hrvUX.color} />
                <Text style={[styles.hrvTitle, { color: hrvUX.color }]}>{hrvUX.label}</Text>
              </View>
              <Text style={[styles.hrvDescription, { color: colors.textSecondary }]}>
                {hrvUX.description}
              </Text>
              {hrvUX.showValues && (
                <View style={[styles.hrvMetricsRow, { backgroundColor: colors.bgSecondary }]}>
                  <View style={styles.hrvMetricBlock}>
                    <Text
                      style={[
                        styles.hrvMetricBlockValue,
                        { fontSize: hrvValFontSize, lineHeight: hrvValFontSize * 1.2 },
                        { color: hrvUX.color },
                      ]}
                    >
                      {hrvUX.sdnnMs ?? '—'}
                    </Text>
                    <Text style={[styles.hrvMetricBlockUnit, { color: colors.textMuted }]}>ms</Text>
                    <Text style={[styles.hrvMetricBlockLabel, { color: colors.textMuted }]}>SDNN</Text>
                  </View>
                  <View style={[styles.hrvMetricDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.hrvMetricBlock}>
                    <Text
                      style={[
                        styles.hrvMetricBlockValue,
                        { fontSize: hrvValFontSize, lineHeight: hrvValFontSize * 1.2 },
                        { color: hrvUX.color },
                      ]}
                    >
                      {hrvUX.latidos ?? '—'}
                    </Text>
                    <Text style={[styles.hrvMetricBlockUnit, { color: colors.textMuted }]}>latidos</Text>
                    <Text style={[styles.hrvMetricBlockLabel, { color: colors.textMuted }]}>Registrados</Text>
                  </View>
                  <View style={[styles.hrvMetricDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.hrvMetricBlock}>
                    <Text
                      style={[
                        styles.hrvMetricBlockValue,
                        { fontSize: hrvValFontSize, lineHeight: hrvValFontSize * 1.2 },
                        { color: hrvUX.color },
                      ]}
                    >
                      {hrvUX.score ?? '—'}
                      <Text style={[styles.hrvMetricBlockScoreMax, { color: colors.textMuted }]}>/4</Text>
                    </Text>
                    <Text style={[styles.hrvMetricBlockLabel, { color: colors.textMuted }]}>Puntuacion</Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.glassCard, styles.hrvCard]}>
              <Text style={[styles.cardLabel, { color: colors.textMuted }]}>VARIABILIDAD CARDÍACA (HRV)</Text>
              <View style={styles.hrvEmptyState}>
                <Icon name="timer-outline" size={28} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                <Text style={[styles.hrvEmptyTitle, { color: colors.textSecondary }]}>Datos insuficientes</Text>
                <Text style={[styles.hrvEmptyText, { color: colors.textMuted }]}>
                  {hasCriticalIssue
                    ? 'La medición fue demasiado corta. Manten el dedo quieto sobre la camara durante 60 segundos completos.'
                    : 'Se necesitan mas latidos para analizar la variabilidad cardíaca.'}
                </Text>
              </View>
            </View>
          )}

          {/* ─── Actions: Share & Calibrate ─────────────────────────── */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.shareBtn, { backgroundColor: colors.primarySubtle }]}
            onPress={() => shareMeasurementSummary(measurement)}
            activeOpacity={0.7}
          >
            <Icon name="share-variant" size={14} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Compartir resultado</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.calibrateBtn, { backgroundColor: colors.bgCard, borderColor: colors.primary }]}
            onPress={() => navigation.navigate('Calibration', { measurement })}
            activeOpacity={0.7}
          >
            <Icon name="ruler" size={14} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Calibrar con tensiometro</Text>
          </TouchableOpacity>

          {/* ─── Bottom Buttons Row ────────────────────────────────── */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => navigation.push('Measure')}
              activeOpacity={0.8}
            >
              <Text style={[styles.primaryBtnText, { color: colors.textOnPrimary }]}>Nueva medición</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: colors.bgCard, borderColor: colors.primary }]}
              onPress={() => navigation.navigate('HomeMain')}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Inicio</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomWarningAdWrapper />
    </SafeAreaView>
  );
}

// ─── Styles factory ────────────────────────────────────────────────────────────
const createStyles = (colors, resolvedTheme) =>
  StyleSheet.create({
    // ─── Containers ─────────────────────────────────────────────────
    safe: {
      flex: 1,
      backgroundColor: colors.bgCard,
    },
    scroll: {
      padding: 16,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },

    // ─── Empty / Error ──────────────────────────────────────────────
    errorText: {
      fontSize: 15,
      color: colors.textSecondary,
      marginBottom: 20,
      textAlign: 'center',
      lineHeight: 22,
    },

    // ─── Glassmorphism card base ────────────────────────────────────
    glassCard: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },

    // ─── BPM Card ───────────────────────────────────────────────────
    glassBpmCard: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    bpmValue: {
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      marginBottom: 0,
    },

    // ─── BP Card ────────────────────────────────────────────────────
    glassBpCard: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    bpValue: {
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },

    // ─── Card label ─────────────────────────────────────────────────
    cardLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 8,
    },

    // ─── Badge row + pill ───────────────────────────────────────────
    badgeRow: {
      flexDirection: 'row',
      marginTop: 8,
    },
    badgePill: {
      borderRadius: RADIUS.full,
      paddingHorizontal: 14,
      paddingVertical: 4,
    },
    badgePillText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.3,
    },

    // ─── Calibration banner ─────────────────────────────────────────
    calibrationBadge: {
      borderRadius: RADIUS.sm,
      paddingVertical: 6,
      paddingHorizontal: 10,
      marginBottom: 10,
      width: '100%',
    },
    calibrationBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },

    // ─── Quality Card ───────────────────────────────────────────────
    qualityCard: {
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    qualityGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    qualityCell: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 4,
      backgroundColor: colors.bgSecondary,
      borderRadius: RADIUS.sm,
    },
    qualityCellValue: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginTop: 2,
    },
    qualityCellLabel: {
      fontSize: 8,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: 1,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      textAlign: 'center',
    },
    qualityHint: {
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 14,
    },

    // ─── HRV Card ───────────────────────────────────────────────────
    hrvCard: {
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    hrvHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    hrvTitle: {
      fontSize: 15,
      fontWeight: '700',
    },
    hrvDescription: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
      marginBottom: 10,
    },
    hrvMetricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 0,
      backgroundColor: colors.bgSecondary,
      borderRadius: RADIUS.sm,
      paddingVertical: 10,
      paddingHorizontal: 6,
    },
    hrvMetricBlock: {
      flex: 1,
      alignItems: 'center',
      minWidth: 70,
    },
    hrvMetricBlockValue: {
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    hrvMetricBlockScoreMax: {
      fontSize: 12,
      fontWeight: '400',
      color: colors.textMuted,
    },
    hrvMetricBlockUnit: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 0,
      fontWeight: '500',
      textTransform: 'lowercase',
    },
    hrvMetricBlockLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    hrvMetricDivider: {
      width: 1,
      height: 30,
      backgroundColor: colors.border,
    },
    hrvEmptyState: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    hrvEmptyTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    hrvEmptyText: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 16,
      paddingHorizontal: 6,
    },

    // ─── Alerts ─────────────────────────────────────────────────────
    alertCard: {
      borderRadius: RADIUS.sm,
      marginBottom: 8,
      borderLeftWidth: 3,
    },
    alertRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
    },
    alertTextWrap: {
      flex: 1,
    },
    alertTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    alertMessage: {
      fontSize: 11,
      lineHeight: 16,
      color: colors.textSecondary,
    },

    // ─── Action buttons ─────────────────────────────────────────────
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: RADIUS.md,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginBottom: 8,
      gap: 6,
    },
    actionBtnText: {
      fontSize: 13,
      fontWeight: '600',
    },
    shareBtn: {},
    calibrateBtn: {
      borderWidth: 1,
    },

    // ─── Navigation buttons row ─────────────────────────────────────
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    primaryBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: RADIUS.md,
      paddingVertical: 12,
      alignItems: 'center',
    },
    primaryBtnText: {
      color: colors.textOnPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    secondaryBtn: {
      flex: 1,
      borderRadius: RADIUS.md,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
    },
    secondaryBtnText: {
      fontSize: 13,
      fontWeight: '600',
    },
  });
