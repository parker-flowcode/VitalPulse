/**
 * AnalyticsScreen.js — VitalPulse v5.0
 *
 * Pantalla de análisis con gráficos de tendencias, distribución de PA,
 * cuadrícula de resumen y soporte de tema dinámico.
 */
import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryScatter,
} from 'victory-native';
import { useTheme } from '../theme/ThemeContext';
import useHealthStore from '../store/healthstore';
import LegalDisclaimer from '../components/LegalDisclaimer';
import { classifyBPM, classifyBP } from '../utils/bpEstimator';
import BannerAd from '../components/BannerAd';
import { SPACING, RADIUS, SHADOWS } from '../theme/designTokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 200;

function MetricCard({ label, value, unit, color, icon, c }) {
  return (
    <View style={[styles.metricCard, SHADOWS.card, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={styles.metricTop}>
        <Text style={styles.metricIcon}>{icon}</Text>
        <Text style={[styles.metricValue, { color: color || c.textPrimary }]}>
          {value}
        </Text>
        {unit && <Text style={[styles.metricUnit, { color: c.textMuted }]}>{unit}</Text>}
      </View>
      <Text style={[styles.metricLabel, { color: c.textSecondary }]}>{label}</Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const { history } = useHealthStore();

  const chronological = useMemo(
    () => [...history].reverse().slice(-30),
    [history]
  );

  const hasBpData = useMemo(
    () => chronological.some((h) => h.bp?.systolic && h.bp?.diastolic),
    [chronological]
  );

  const hasHrvData = useMemo(
    () => chronological.filter((h) => h.sdnn && h.sdnn > 0).length >= 5,
    [chronological]
  );

  // ─── BPM Chart Data ──────────────────────────────────────────────────
  const bpmChartData = useMemo(
    () =>
      chronological
        .filter((h) => h.bpm && h.bpm > 0)
        .map((item, i) => ({
          x: i + 1,
          y: item.bpm,
          timestamp: item.timestamp,
        })),
    [chronological]
  );

  const bpmTickLookup = useMemo(() => {
    const map = {};
    bpmChartData.forEach((d) => {
      map[d.x] = d.timestamp;
    });
    return map;
  }, [bpmChartData]);

  const bpmTickFormat = useMemo(
    () => (x) => {
      const ts = bpmTickLookup[x];
      if (!ts) return '';
      try {
        return new Date(ts).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
        });
      } catch {
        return '';
      }
    },
    [bpmTickLookup]
  );

  // ─── BP Chart Data ───────────────────────────────────────────────────
  const bpChartData = useMemo(() => {
    const valid = chronological.filter(
      (h) => h.bp?.systolic && h.bp?.diastolic
    );
    return {
      sys: valid.map((item, i) => ({
        x: i + 1,
        y: item.bp.systolic,
        timestamp: item.timestamp,
      })),
      dia: valid.map((item, i) => ({
        x: i + 1,
        y: item.bp.diastolic,
        timestamp: item.timestamp,
      })),
    };
  }, [chronological]);

  const bpTickLookup = useMemo(() => {
    const map = {};
    bpChartData.sys.forEach((d) => {
      map[d.x] = d.timestamp;
    });
    return map;
  }, [bpChartData]);

  const bpTickFormat = useMemo(
    () => (x) => {
      const ts = bpTickLookup[x];
      if (!ts) return '';
      try {
        return new Date(ts).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
        });
      } catch {
        return '';
      }
    },
    [bpTickLookup]
  );

  // ─── HRV Chart Data ──────────────────────────────────────────────────
  const hrvChartData = useMemo(
    () =>
      chronological
        .filter((h) => h.sdnn && h.sdnn > 0)
        .map((item, i) => ({
          x: i + 1,
          y: Math.round(item.sdnn * 10) / 10,
          timestamp: item.timestamp,
        })),
    [chronological]
  );

  const hrvTickLookup = useMemo(() => {
    const map = {};
    hrvChartData.forEach((d) => {
      map[d.x] = d.timestamp;
    });
    return map;
  }, [hrvChartData]);

  const hrvTickFormat = useMemo(
    () => (x) => {
      const ts = hrvTickLookup[x];
      if (!ts) return '';
      try {
        return new Date(ts).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
        });
      } catch {
        return '';
      }
    },
    [hrvTickLookup]
  );

  // ─── Summary Strip ───────────────────────────────────────────────────
  const summaryMetrics = useMemo(() => {
    const bpms = history.map((h) => h.bpm || 0).filter((b) => b > 0);
    const avgBpm =
      bpms.length > 0
        ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length)
        : 0;

    const lastBpItem = [...history].reverse().find((h) => h.bp?.systolic);
    const lastBpStr = lastBpItem
      ? lastBpItem.bp.systolic + '/' + lastBpItem.bp.diastolic
      : '--';

    const sdnnVals = history
      .map((h) => h.sdnn || 0)
      .filter((v) => v > 0);
    const avgSdnn =
      sdnnVals.length > 0
        ? Math.round(
            sdnnVals.reduce((a, b) => a + b, 0) / sdnnVals.length * 10
          ) / 10
        : 0;

    return { avgBpm, lastBpStr, avgSdnn, total: history.length };
  }, [history]);

  // ─── BP Distribution ─────────────────────────────────────────────────
  const bpDistribution = useMemo(() => {
    const categoryColors = {
      'Optima': colors.success,
      'Normal': colors.primary,
      'Normal-Alta': colors.warning,
      'HTA Grado 1': colors.danger,
      'HTA Grado 2': colors.danger,
      'HTA Grado 3': colors.danger,
    };
    const counts = {};
    const activeLabels = [];

    history
      .filter((h) => h.bp?.systolic && h.bp?.diastolic)
      .forEach((h) => {
        const cls = classifyBP(h.bp.systolic, h.bp.diastolic);
        const label = cls.label;
        if (!counts[label]) counts[label] = 0;
        counts[label]++;
      });

    Object.entries(categoryColors).forEach(([label, color]) => {
      if (counts[label] && counts[label] > 0) {
        activeLabels.push({ label, count: counts[label], color });
      }
    });

    const maxCount = Math.max(...activeLabels.map((l) => l.count), 1);
    return { items: activeLabels, max: maxCount };
  }, [history, colors]);

  // ─── Axis base style ─────────────────────────────────────────────────
  const axisStyle = useMemo(() => ({
    axis: { stroke: colors.border, strokeWidth: 1 },
    axisLabel: { padding: 30 },
    tickLabels: {
      fill: colors.textMuted,
      fontSize: 10,
      fontFamily: 'System',
    },
    grid: {
      stroke: colors.chartGrid,
      strokeWidth: 1,
    },
  }), [colors]);

  const dependentAxisStyle = useMemo(() => ({
    ...axisStyle,
    tickLabels: { ...axisStyle.tickLabels, fontSize: 9 },
    grid: {
      stroke: colors.chartGrid,
      strokeWidth: 1,
    },
  }), [axisStyle]);

  // ─── Render ─────────────────────────────────────────────────────────
  if (history.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View style={[styles.header]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Análisis</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin datos disponibles</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Realiza al menos una medición para ver tus gráficas y estadísticas
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const showBpmChart = bpmChartData.length > 1;
  const showBpChart = bpChartData.sys.length > 1;
  const showHrvChart = hrvChartData.length > 1;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Análisis</Text>
        </View>

        {/* ── Summary Strip (2x2 Grid) ──────────────────────────────── */}
        <View style={styles.summaryGrid}>
          <MetricCard
            label="Promedio BPM"
            value={summaryMetrics.avgBpm}
            unit="BPM"
            color={colors.chartBPM}
            icon="💓"
            c={colors}
          />
          <MetricCard
            label="Última PA"
            value={summaryMetrics.lastBpStr}
            unit="mmHg"
            color={colors.chartSystolic}
            icon="🩸"
            c={colors}
          />
          <MetricCard
            label="HRV Promedio"
            value={
              summaryMetrics.avgSdnn > 0
                ? summaryMetrics.avgSdnn.toFixed(1)
                : '--'
            }
            unit="ms"
            color={colors.chartHRV}
            icon="📊"
            c={colors}
          />
          <MetricCard
            label="Total Mediciones"
            value={summaryMetrics.total}
            color={colors.textPrimary}
            icon="📋"
            c={colors}
          />
        </View>

        {/* ── BPM Trend Chart ───────────────────────────────────────── */}
        {showBpmChart && (
          <View style={[styles.chartCard, SHADOWS.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>Frecuencia Cardíaca</Text>
            <Text style={[styles.chartSub, { color: colors.textMuted }]}>
              Últimas {bpmChartData.length} mediciones
            </Text>
            <VictoryChart
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              padding={{ top: 10, bottom: 36, left: 44, right: 12 }}
            >
              <VictoryAxis
                style={axisStyle}
                tickFormat={bpmTickFormat}
                fixLabelOverlap
              />
              <VictoryAxis
                dependentAxis
                style={dependentAxisStyle}
                tickFormat={(t) => Math.round(t)}
              />
              <VictoryLine
                data={bpmChartData}
                style={{
                  data: {
                    stroke: colors.chartBPM,
                    strokeWidth: 2,
                  },
                }}
                interpolation="monotoneX"
              />
              <VictoryScatter
                data={bpmChartData}
                size={3}
                style={{
                  data: {
                    fill: colors.chartBPM,
                  },
                }}
              />
            </VictoryChart>
          </View>
        )}

        {/* ── BP Trend Chart ────────────────────────────────────────── */}
        {showBpChart && (
          <View style={[styles.chartCard, SHADOWS.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>Presión Arterial</Text>
            <Text style={[styles.chartSub, { color: colors.textMuted }]}>
              Sistólica (azul) · Diastólica (celeste)
            </Text>
            <VictoryChart
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              padding={{ top: 10, bottom: 36, left: 44, right: 12 }}
            >
              <VictoryAxis
                style={axisStyle}
                tickFormat={bpTickFormat}
                fixLabelOverlap
              />
              <VictoryAxis
                dependentAxis
                style={dependentAxisStyle}
                tickFormat={(t) => Math.round(t)}
              />
              <VictoryLine
                data={bpChartData.sys}
                style={{
                  data: {
                    stroke: colors.chartSystolic,
                    strokeWidth: 2,
                  },
                }}
                interpolation="monotoneX"
              />
              <VictoryLine
                data={bpChartData.dia}
                style={{
                  data: {
                    stroke: colors.chartDiastolic,
                    strokeWidth: 2,
                  },
                }}
                interpolation="monotoneX"
              />
            </VictoryChart>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.chartSystolic },
                  ]}
                />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Sistólica</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.chartDiastolic },
                  ]}
                />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Diastólica</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── HRV Trend Chart ───────────────────────────────────────── */}
        {showHrvChart && hasHrvData && (
          <View style={[styles.chartCard, SHADOWS.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>
              Variabilidad Cardíaca (SDNN)
            </Text>
            <Text style={[styles.chartSub, { color: colors.textMuted }]}>
              Últimas {hrvChartData.length} mediciones
            </Text>
            <VictoryChart
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              padding={{ top: 10, bottom: 36, left: 44, right: 12 }}
            >
              <VictoryAxis
                style={axisStyle}
                tickFormat={hrvTickFormat}
                fixLabelOverlap
              />
              <VictoryAxis
                dependentAxis
                style={dependentAxisStyle}
                tickFormat={(t) => Math.round(t)}
              />
              <VictoryLine
                data={hrvChartData}
                style={{
                  data: {
                    stroke: colors.chartHRV,
                    strokeWidth: 2,
                  },
                }}
                interpolation="monotoneX"
              />
              <VictoryScatter
                data={hrvChartData}
                size={3}
                style={{
                  data: {
                    fill: colors.chartHRV,
                  },
                }}
              />
            </VictoryChart>
          </View>
        )}

        {/* ── BP Distribution ───────────────────────────────────────── */}
        {bpDistribution.items.length > 0 && (
          <View style={[styles.chartCard, SHADOWS.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>Distribución de PA</Text>
            <Text style={[styles.chartSub, { color: colors.textMuted }]}>
              Clasificación de mediciones de presión arterial
            </Text>
            <View style={styles.distContainer}>
              {bpDistribution.items.map((item) => {
                const pct = (item.count / bpDistribution.max) * 100;
                return (
                  <View key={item.label} style={styles.distRow}>
                    <Text style={[styles.distLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                    <View style={[styles.distBarTrack, { backgroundColor: colors.bgCard }]}>
                      <View
                        style={[
                          styles.distBarFill,
                          {
                            width: Math.max(pct, 4) + '%',
                            backgroundColor: item.color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.distCount, { color: colors.textPrimary }]}>{item.count}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Footer ────────────────────────────────────────────────── */}
        <View style={styles.footerSection}>
          <LegalDisclaimer />
          <BannerAd compact />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Static layout styles (no color references) ───────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  scroll: {
    paddingBottom: 40,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  metricCard: {
    width: (SCREEN_WIDTH - 50) / 2,
    borderRadius: RADIUS.md,
    padding: 14,
    borderWidth: 1,
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
    gap: 6,
  },
  metricIcon: {
    fontSize: 16,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  metricUnit: {
    fontSize: 12,
    fontWeight: '500',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  chartCard: {
    borderRadius: RADIUS.lg,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  chartSub: {
    fontSize: 12,
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  distContainer: {
    marginTop: 8,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  distLabel: {
    width: 96,
    fontSize: 12,
    fontWeight: '600',
  },
  distBarTrack: {
    flex: 1,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  distBarFill: {
    height: 20,
    borderRadius: 10,
  },
  distCount: {
    width: 28,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  footerSection: {
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
  },
});
