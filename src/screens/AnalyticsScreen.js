/**
 * AnalyticsScreen.js — VitalPulse v5.0
 *
 * Pantalla de analisis premium con graficas de tendencias basadas en fechas,
 * cuadricula de resumen profesional, distribucion de PA y temas dinamicos.
 * Todos los graficos usan la paleta sky blue (#38BDF8).
 * VictoryAxis tickFormat utiliza fechas, NO numeros de indice.
 */
import React, { useMemo, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions, Alert, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryScatter,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from 'victory-native';
import { useTheme } from '../theme/ThemeContext';
import useHealthStore from '../store/healthstore';
import LegalDisclaimer from '../components/LegalDisclaimer';
import { classifyBPM, classifyBP } from '../utils/bpEstimator';
import BannerAd from '../components/BannerAd';
import { SPACING, RADIUS, SHADOWS } from '../theme/designTokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 210;
const SKY_BLUE = '#38BDF8';
const SKY_BLUE_LIGHT = '#7DD3FC';
const SKY_BLUE_DARK = '#0EA5E9';
const HRV_GREEN = '#10B981';
const HRV_GREEN_LIGHT = '#34D399';

// ─── Axis style factory ─────────────────────────────────────────────────
function createAxisStyle(colors) {
  return {
    axis: { stroke: colors.border, strokeWidth: 1 },
    axisLabel: { padding: 30 },
    tickLabels: {
      fill: colors.textMuted,
      fontSize: 10,
      fontFamily: 'System',
      padding: 4,
    },
    grid: {
      stroke: colors.chartGrid || colors.borderLight,
      strokeWidth: 1,
    },
  };
}

function createDependentAxisStyle(axisStyle) {
  return {
    ...axisStyle,
    tickLabels: { ...axisStyle.tickLabels, fontSize: 9, padding: 4 },
    grid: {
      stroke: axisStyle.grid.stroke,
      strokeWidth: 1,
    },
  };
}

// ─── Ticks — show every Nth data point to avoid crowding ────────────────
function buildDateTickValues(data, maxTicks = 5) {
  if (!data || data.length === 0) return [];
  if (data.length <= maxTicks) return data.map((d) => d.x);
  const step = Math.max(1, Math.floor((data.length - 1) / (maxTicks - 1)));
  const values = [];
  for (let i = 0; i < data.length; i += step) {
    values.push(data[i].x);
  }
  // Always include the last point
  if (values.length > 0 && values[values.length - 1] !== data[data.length - 1].x) {
    values.push(data[data.length - 1].x);
  }
  return values;
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  try {
    const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return '';
  }
}

function getBpDescription(label) {
  const map = {
    'Optima': 'Presion arterial optima. Mantenga este nivel.',
    'Normal': 'Presion arterial normal. Continue con habitos saludables.',
    'Normal-Alta': 'Presion ligeramente elevada. Monitoree regularmente.',
    'HTA Grado 1': 'Hipertension grado 1. Consulte a su medico.',
    'HTA Grado 2': 'Hipertension grado 2. Requiere atencion medica.',
    'HTA Grado 3': 'Hipertension grado 3. Busque atencion medica urgente.',
  };
  return map[label] || '';
}

function getHrvInterpretation(sdnn) {
  if (sdnn <= 0) return 'Sin datos';
  if (sdnn < 30) return 'Baja variabilidad — posible estres o fatiga';
  if (sdnn < 60) return 'Variabilidad moderada — estado regular';
  return 'Alta variabilidad — buena recuperacion';
}

// ─── Period filter helpers ──────────────────────────────────────────────
const FILTER_OPTIONS = ['Semana', 'Mes', '3 meses', 'Todo'];

function filterByPeriod(history, period) {
  if (period === 'Todo') return history;
  const now = Date.now();
  const msInPeriod = {
    Semana: 7 * 24 * 60 * 60 * 1000,
    Mes: 30 * 24 * 60 * 60 * 1000,
    '3 meses': 90 * 24 * 60 * 60 * 1000,
  };
  const cutoff = now - (msInPeriod[period] || 0);
  return history.filter((h) => new Date(h.timestamp).getTime() >= cutoff);
}

// ─── Metric Card ────────────────────────────────────────────────────────
function MetricCard({ label, value, unit, color, icon, c, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.metricCard,
        SHADOWS.card,
        {
          backgroundColor: c.bg,
          borderColor: c.borderLight,
        },
      ]}
    >
      {/* Sky blue top accent */}
      <View style={[styles.metricAccent, { backgroundColor: color || c.primary }]} />

      <View style={styles.metricBody}>
        <View style={styles.metricHeader}>
          <View
            style={[
              styles.metricIconWrap,
              { backgroundColor: color ? color + '18' : c.primarySubtle },
            ]}
          >
            <Text style={[styles.metricIcon, { color: color || c.primary }]}>
              {icon || '📊'}
            </Text>
          </View>
        </View>
        <View style={styles.metricData}>
          <Text
            style={[styles.metricValue, { color: color || c.textPrimary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {value}
          </Text>
          {unit && (
            <Text style={[styles.metricUnit, { color: c.textMuted }]}>
              {unit}
            </Text>
          )}
        </View>
        <Text style={[styles.metricLabel, { color: c.textSecondary }]}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Chart Card wrapper ────────────────────────────────────────────────
function ChartCard({ title, subtitle, colors, children }) {
  return (
    <View
      style={[
        styles.chartCard,
        SHADOWS.card,
        { backgroundColor: colors.bg, borderColor: colors.borderLight },
      ]}
    >
      <View
        style={[
          styles.chartCardAccent,
          { backgroundColor: colors.primary },
        ]}
      />
      <View style={styles.chartCardBody}>
        <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.chartSub, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        )}
        {children}
      </View>
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const { history } = useHealthStore();
  const [selectedFilter, setSelectedFilter] = useState('Todo');

  // Filter by selected period
  const filteredHistory = useMemo(
    () => filterByPeriod(history, selectedFilter),
    [history, selectedFilter]
  );

  // Sort measurements chronologically (oldest first for trend charts)
  const chronological = useMemo(
    () => [...filteredHistory].reverse().slice(-40),
    [filteredHistory]
  );

  const hasBpData = useMemo(
    () => chronological.some((h) => h.bp?.systolic && h.bp?.diastolic),
    [chronological]
  );

  const hasHrvData = useMemo(
    () => chronological.filter((h) => h.sdnn && h.sdnn > 0).length >= 5,
    [chronological]
  );

  // ─── Axis styles (memoized) ──────────────────────────────────────────
  const axisStyle = useMemo(() => createAxisStyle(colors), [colors]);
  const depAxisStyle = useMemo(
    () => createDependentAxisStyle(axisStyle),
    [axisStyle]
  );

  // ─── Date tick formatter ─────────────────────────────────────────────
  const dateTickFormat = useCallback((x) => formatDate(x), []);

  // ─── BPM Chart Data ──────────────────────────────────────────────────
  const bpmChartData = useMemo(
    () => {
      const raw = chronological
        .filter((h) => h.bpm && h.bpm > 0)
        .map((item) => ({
          x: new Date(item.timestamp).getTime(),
          y: item.bpm,
          ts: item.timestamp,
        }));
      // Return oldest-first for timeline
      return raw.reverse();
    },
    [chronological]
  );

  const bpmTickValues = useMemo(
    () => buildDateTickValues(bpmChartData, 5),
    [bpmChartData]
  );

  // ─── BP Chart Data ───────────────────────────────────────────────────
  const bpChartData = useMemo(() => {
    const valid = chronological.filter(
      (h) => h.bp?.systolic && h.bp?.diastolic
    );
    // Oldest first for proper timeline
    const raw = {
      sys: valid.map((item) => ({
        x: new Date(item.timestamp).getTime(),
        y: item.bp.systolic,
        ts: item.timestamp,
      })),
      dia: valid.map((item) => ({
        x: new Date(item.timestamp).getTime(),
        y: item.bp.diastolic,
        ts: item.timestamp,
      })),
    };
    raw.sys.reverse();
    raw.dia.reverse();
    return raw;
  }, [chronological]);

  const bpTickValues = useMemo(
    () => buildDateTickValues(bpChartData.sys, 5),
    [bpChartData.sys]
  );

  // ─── HRV Chart Data ──────────────────────────────────────────────────
  const hrvChartData = useMemo(
    () => {
      const raw = chronological
        .filter((h) => h.sdnn && h.sdnn > 0)
        .map((item) => ({
          x: new Date(item.timestamp).getTime(),
          y: Math.round(item.sdnn * 10) / 10,
          ts: item.timestamp,
        }));
      return raw.reverse();
    },
    [chronological]
  );

  const hrvTickValues = useMemo(
    () => buildDateTickValues(hrvChartData, 5),
    [hrvChartData]
  );

  // ─── Summary Metrics ─────────────────────────────────────────────────
  const summaryMetrics = useMemo(() => {
    const bpms = filteredHistory.map((h) => h.bpm || 0).filter((b) => b > 0);
    const avgBpm =
      bpms.length > 0
        ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length)
        : 0;

    const lastBpItem = [...filteredHistory].reverse().find((h) => h.bp?.systolic);
    const lastBpStr = lastBpItem
      ? lastBpItem.bp.systolic + '/' + lastBpItem.bp.diastolic
      : '--/--';

    const sdnnVals = filteredHistory
      .map((h) => h.sdnn || 0)
      .filter((v) => v > 0);
    const avgSdnn =
      sdnnVals.length > 0
        ? Math.round(
            (sdnnVals.reduce((a, b) => a + b, 0) / sdnnVals.length) * 10
          ) / 10
        : 0;

    // Latest BPM classification
    const lastBpmItem = [...filteredHistory].reverse().find((h) => h.bpm && h.bpm > 0);
    const lastBpm = lastBpmItem ? lastBpmItem.bpm : 0;
    const lastBpmClass = classifyBPM(lastBpm);

    return { avgBpm, lastBpStr, avgSdnn, total: filteredHistory.length, lastBpm, lastBpmClass };
  }, [filteredHistory]);

  // ─── Extra stats for metric card alerts ──────────────────────────────
  const extraStats = useMemo(() => {
    const bpms = filteredHistory.map((h) => h.bpm || 0).filter((b) => b > 0);
    const minBpm = bpms.length > 0 ? Math.min(...bpms) : 0;
    const maxBpm = bpms.length > 0 ? Math.max(...bpms) : 0;

    const bpmClassCounts = {};
    filteredHistory.filter((h) => h.bpm && h.bpm > 0).forEach((h) => {
      const cls = classifyBPM(h.bpm);
      const label = cls?.label || 'Desconocido';
      bpmClassCounts[label] = (bpmClassCounts[label] || 0) + 1;
    });

    const lastBpItem = [...filteredHistory].reverse().find((h) => h.bp?.systolic);
    let bpDetail = null;
    if (lastBpItem) {
      const cls = classifyBP(lastBpItem.bp.systolic, lastBpItem.bp.diastolic);
      bpDetail = {
        sys: lastBpItem.bp.systolic,
        dia: lastBpItem.bp.diastolic,
        classification: cls.label,
        timestamp: lastBpItem.timestamp,
      };
    }

    const timestamps = filteredHistory.map((h) => h.timestamp).filter(Boolean).sort();
    const dateRange = timestamps.length > 1
      ? formatDate(timestamps[0]) + ' — ' + formatDate(timestamps[timestamps.length - 1])
      : timestamps.length === 1
      ? formatDate(timestamps[0])
      : 'Sin datos';

    return { minBpm, maxBpm, bpmClassCounts, bpDetail, dateRange };
  }, [filteredHistory]);

  // ─── BP Distribution ─────────────────────────────────────────────────
  const bpDistribution = useMemo(() => {
    const categoryOrder = [
      'Optima',
      'Normal',
      'Normal-Alta',
      'HTA Grado 1',
      'HTA Grado 2',
      'HTA Grado 3',
    ];
    const categoryColors = {
      'Optima':       '#10B981',
      'Normal':       '#38BDF8',
      'Normal-Alta':  '#F59E0B',
      'HTA Grado 1':  '#F97316',
      'HTA Grado 2':  '#EF4444',
      'HTA Grado 3':  '#DC2626',
    };
    const counts = {};

    filteredHistory
      .filter((h) => h.bp?.systolic && h.bp?.diastolic)
      .forEach((h) => {
        const cls = classifyBP(h.bp.systolic, h.bp.diastolic);
        const label = cls.label;
        if (!counts[label]) counts[label] = 0;
        counts[label]++;
      });

    const items = categoryOrder
      .filter((label) => counts[label] && counts[label] > 0)
      .map((label) => ({
        label,
        count: counts[label],
        color: categoryColors[label] || colors.textMuted,
      }));

    const maxCount = Math.max(...items.map((l) => l.count), 1);
    return { items, max: maxCount };
  }, [filteredHistory]);

  // ─── Empty state ────────────────────────────────────────────────────
  if (history.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Analisis
          </Text>
        </View>
        <View style={styles.empty}>
          <View
            style={[
              styles.emptyIconWrap,
              { backgroundColor: colors.primarySubtle },
            ]}
          >
            <Text style={styles.emptyIcon}>📊</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Sin datos disponibles
          </Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Realiza al menos una medicion para ver tus graficas y estadisticas.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const showBpmChart = bpmChartData.length > 1;
  const showBpChart = bpChartData.sys.length > 1;
  const showHrvChart = hrvChartData.length > 1;

  // ─── Theme-based sky blue palette ───────────────────────────────────
  const bpmLineColor = colors.chartBPM || SKY_BLUE;
  const sysLineColor = colors.chartSystolic || SKY_BLUE;
  const diaLineColor = colors.chartDiastolic || SKY_BLUE_LIGHT;
  const hrvLineColor = colors.chartHRV || HRV_GREEN;

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Analisis
            </Text>
            <Text style={[styles.headerMeta, { color: colors.textMuted }]}>
              {filteredHistory.length} de {history.length} {history.length === 1 ? 'medicion' : 'mediciones'}
            </Text>
          </View>
        </View>

        {/* ── Period Filter Tabs ──────────────────────────────────────── */}
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => setSelectedFilter(opt)}
              style={[
                styles.filterPill,
                {
                  backgroundColor:
                    selectedFilter === opt ? colors.primary : colors.bgCard,
                  borderColor:
                    selectedFilter === opt ? colors.primary : colors.borderLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  {
                    color:
                      selectedFilter === opt ? '#FFFFFF' : colors.textSecondary,
                  },
                ]}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Summary Grid (2x2) ────────────────────────────────────── */}
        <View style={styles.summaryGrid}>
          <MetricCard
            label="Promedio BPM"
            value={summaryMetrics.avgBpm}
            unit="BPM"
            color={bpmLineColor}
            icon="❤️"
            c={colors}
            onPress={() => {
              const classList = Object.entries(extraStats.bpmClassCounts)
                .map(([lbl, cnt]) => '  • ' + lbl + ': ' + cnt)
                .join('\n');
              Alert.alert(
                'Promedio BPM',
                'Promedio: ' + summaryMetrics.avgBpm + ' BPM\n' +
                'Minimo: ' + extraStats.minBpm + ' BPM | Maximo: ' + extraStats.maxBpm + ' BPM\n' +
                'Ultima: ' + summaryMetrics.lastBpm + ' BPM (' + (summaryMetrics.lastBpmClass?.label || '--') + ')\n\n' +
                'Clasificaciones:\n' + classList
              );
            }}
          />
          <MetricCard
            label="Ultima PA"
            value={summaryMetrics.lastBpStr}
            unit="mmHg"
            color={sysLineColor}
            icon="🩸"
            c={colors}
            onPress={() => {
              if (!extraStats.bpDetail) {
                Alert.alert('Ultima PA', 'No hay mediciones de presion arterial registradas.');
                return;
              }
              Alert.alert(
                'Ultima PA',
                'Lectura: ' + extraStats.bpDetail.sys + '/' + extraStats.bpDetail.dia + ' mmHg\n' +
                'Clasificacion: ' + extraStats.bpDetail.classification + '\n' +
                getBpDescription(extraStats.bpDetail.classification) + '\n\n' +
                'Fecha: ' + formatDate(extraStats.bpDetail.timestamp)
              );
            }}
          />
          <MetricCard
            label="HRV Promedio"
            value={
              summaryMetrics.avgSdnn > 0
                ? summaryMetrics.avgSdnn.toFixed(1)
                : '--'
            }
            unit="ms"
            color={hrvLineColor}
            icon="📊"
            c={colors}
            onPress={() => {
              Alert.alert(
                'HRV Promedio',
                'SDNN Promedio: ' + (summaryMetrics.avgSdnn > 0 ? summaryMetrics.avgSdnn.toFixed(1) : '--') + ' ms\n' +
                'Interpretacion: ' + getHrvInterpretation(summaryMetrics.avgSdnn) + '\n\n' +
                'El SDNN mide la variabilidad del ritmo cardiaco.\nValores altos indican buena recuperacion y salud cardiovascular.'
              );
            }}
          />
          <MetricCard
            label="Total Mediciones"
            value={summaryMetrics.total}
            color={colors.textPrimary}
            icon="📋"
            c={colors}
            onPress={() => {
              Alert.alert(
                'Total Mediciones',
                'Total: ' + summaryMetrics.total + ' mediciones\n' +
                'Rango de fechas: ' + extraStats.dateRange + '\n\n' +
                (summaryMetrics.total > 0
                  ? summaryMetrics.total === 1
                    ? 'Realiza mas mediciones para obtener tendencias.'
                    : 'Mantener un registro regular ayuda a identificar patrones en tu salud cardiovascular.'
                  : 'Comienza a registrar mediciones para ver tu historial.')
              );
            }}
          />
        </View>

        {/* ── BPM Trend Chart ──────────────────────────────────────── */}
        {showBpmChart && (
          <ChartCard
            title="Frecuencia Cardiaca"
            subtitle={
              'Tendencia de las ultimas ' +
              bpmChartData.length +
              ' mediciones'
            }
            colors={colors}
          >
            <VictoryChart
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              padding={{ top: 10, bottom: 38, left: 44, right: 14 }}
              scale={{ x: 'time' }}
              containerComponent={
                <VictoryVoronoiContainer
                  labels={({ datum }) => formatDate(datum.ts) + ': ' + datum.y + ' BPM'}
                  labelComponent={
                    <VictoryTooltip
                      style={{ fill: 'white', fontSize: 12, fontWeight: '500' }}
                      flyoutStyle={{ fill: '#1E293B', stroke: SKY_BLUE, strokeWidth: 1.5 }}
                      pointerLength={8}
                      cornerRadius={6}
                    />
                  }
                />
              }
            >
              <VictoryAxis
                style={axisStyle}
                tickFormat={dateTickFormat}
                tickValues={bpmTickValues}
                fixLabelOverlap
              />
              <VictoryAxis
                dependentAxis
                style={depAxisStyle}
                tickFormat={(t) => Math.round(t)}
              />
              <VictoryLine
                data={bpmChartData}
                style={{
                  data: {
                    stroke: bpmLineColor,
                    strokeWidth: 2.5,
                  },
                }}
                interpolation="monotoneX"
              />
              <VictoryScatter
                data={bpmChartData}
                size={3.5}
                style={{
                  data: {
                    fill: bpmLineColor,
                  },
                }}
              />
            </VictoryChart>
          </ChartCard>
        )}

        {/* ── BP Trend Chart ───────────────────────────────────────── */}
        {showBpChart && (
          <ChartCard
            title="Presion Arterial"
            subtitle="Sistolica (azul) / Diastolica (celeste)"
            colors={colors}
          >
            <VictoryChart
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              padding={{ top: 10, bottom: 38, left: 44, right: 14 }}
              scale={{ x: 'time' }}
              containerComponent={
                <VictoryVoronoiContainer
                  labels={({ datum }) => formatDate(datum.ts) + ': ' + datum.y + ' mmHg'}
                  labelComponent={
                    <VictoryTooltip
                      style={{ fill: 'white', fontSize: 12, fontWeight: '500' }}
                      flyoutStyle={{ fill: '#1E293B', stroke: SKY_BLUE, strokeWidth: 1.5 }}
                      pointerLength={8}
                      cornerRadius={6}
                    />
                  }
                />
              }
            >
              <VictoryAxis
                style={axisStyle}
                tickFormat={dateTickFormat}
                tickValues={bpTickValues}
                fixLabelOverlap
              />
              <VictoryAxis
                dependentAxis
                style={depAxisStyle}
                tickFormat={(t) => Math.round(t)}
              />
              {/* Systolic — sky blue */}
              <VictoryLine
                data={bpChartData.sys}
                style={{
                  data: {
                    stroke: sysLineColor,
                    strokeWidth: 2.5,
                  },
                }}
                interpolation="monotoneX"
              />
              <VictoryScatter
                data={bpChartData.sys}
                size={3}
                style={{
                  data: {
                    fill: sysLineColor,
                  },
                }}
              />
              {/* Diastolic — lighter blue */}
              <VictoryLine
                data={bpChartData.dia}
                style={{
                  data: {
                    stroke: diaLineColor,
                    strokeWidth: 2,
                  },
                }}
                interpolation="monotoneX"
              />
              <VictoryScatter
                data={bpChartData.dia}
                size={2.5}
                style={{
                  data: {
                    fill: diaLineColor,
                  },
                }}
              />
            </VictoryChart>

            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: sysLineColor }]}
                />
                <Text
                  style={[styles.legendText, { color: colors.textSecondary }]}
                >
                  Sistolica
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: diaLineColor }]}
                />
                <Text
                  style={[styles.legendText, { color: colors.textSecondary }]}
                >
                  Diastolica
                </Text>
              </View>
            </View>
          </ChartCard>
        )}

        {/* ── HRV Trend Chart ──────────────────────────────────────── */}
        {showHrvChart && hasHrvData && (
          <ChartCard
            title="Variabilidad Cardiaca (SDNN)"
            subtitle={
              'Tendencia de las ultimas ' +
              hrvChartData.length +
              ' mediciones'
            }
            colors={colors}
          >
            <VictoryChart
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              padding={{ top: 10, bottom: 38, left: 44, right: 14 }}
              scale={{ x: 'time' }}
              containerComponent={
                <VictoryVoronoiContainer
                  labels={({ datum }) => formatDate(datum.ts) + ': ' + datum.y + ' ms'}
                  labelComponent={
                    <VictoryTooltip
                      style={{ fill: 'white', fontSize: 12, fontWeight: '500' }}
                      flyoutStyle={{ fill: '#1E293B', stroke: HRV_GREEN, strokeWidth: 1.5 }}
                      pointerLength={8}
                      cornerRadius={6}
                    />
                  }
                />
              }
            >
              <VictoryAxis
                style={axisStyle}
                tickFormat={dateTickFormat}
                tickValues={hrvTickValues}
                fixLabelOverlap
              />
              <VictoryAxis
                dependentAxis
                style={depAxisStyle}
                tickFormat={(t) => Math.round(t)}
              />
              <VictoryLine
                data={hrvChartData}
                style={{
                  data: {
                    stroke: hrvLineColor,
                    strokeWidth: 2.5,
                  },
                }}
                interpolation="monotoneX"
              />
              <VictoryScatter
                data={hrvChartData}
                size={3.5}
                style={{
                  data: {
                    fill: hrvLineColor,
                  },
                }}
              />
            </VictoryChart>
          </ChartCard>
        )}

        {/* ── BP Classification Distribution ────────────────────────── */}
        {bpDistribution.items.length > 0 && (
          <ChartCard
            title="Distribucion de PA"
            subtitle="Clasificacion de mediciones de presion arterial"
            colors={colors}
          >
            <View style={styles.distContainer}>
              {bpDistribution.items.map((item) => {
                const pct = (item.count / bpDistribution.max) * 100;
                return (
                  <View key={item.label} style={styles.distRow}>
                    <Text
                      style={[
                        styles.distLabel,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    <View style={styles.distBarRow}>
                      <View
                        style={[
                          styles.distBarTrack,
                          { backgroundColor: colors.bgCard },
                        ]}
                      >
                        <View
                          style={[
                            styles.distBarFill,
                            {
                              width: Math.max(pct, 3) + '%',
                              backgroundColor: item.color,
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.distCount,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {item.count}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Summary row */}
            <View
              style={[
                styles.distSummary,
                { borderTopColor: colors.border },
              ]}
            >
              <Text
                style={[styles.distSummaryText, { color: colors.textMuted }]}
              >
                Basado en{' '}
                {bpDistribution.items.reduce(
                  (sum, i) => sum + i.count,
                  0
                )}{' '}
                mediciones con PA
              </Text>
            </View>
          </ChartCard>
        )}

        {/* ── Current status card ───────────────────────────────────── */}
        <ChartCard
          title="Estado Actual"
          subtitle="Ultima clasificacion registrada"
          colors={colors}
        >
          <View style={styles.statusGrid}>
            {/* BPM status */}
            <View style={styles.statusItem}>
              <Text
                style={[
                  styles.statusValue,
                  {
                    color:
                      summaryMetrics.lastBpmClass?.color || colors.textPrimary,
                  },
                ]}
              >
                {summaryMetrics.lastBpm} BPM
              </Text>
              {summaryMetrics.lastBpmClass && (
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: summaryMetrics.lastBpmClass.color
                        ? summaryMetrics.lastBpmClass.color + '18'
                        : colors.bgCard,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          summaryMetrics.lastBpmClass.color || colors.textMuted,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusLabel,
                      {
                        color:
                          summaryMetrics.lastBpmClass.color ||
                          colors.textSecondary,
                      },
                    ]}
                  >
                    {summaryMetrics.lastBpmClass.label}
                  </Text>
                </View>
              )}
            </View>

            {/* BP status */}
            {summaryMetrics.lastBpStr !== '--/--' && (
              <View style={styles.statusItem}>
                <Text
                  style={[
                    styles.statusValue,
                    { color: colors.textPrimary },
                  ]}
                >
                  {summaryMetrics.lastBpStr} mmHg
                </Text>
                {(() => {
                  const lastBpItem = [...filteredHistory]
                    .reverse()
                    .find((h) => h.bp?.systolic);
                  if (lastBpItem) {
                    const cls = classifyBP(
                      lastBpItem.bp.systolic,
                      lastBpItem.bp.diastolic
                    );
                    return (
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: cls.color
                              ? cls.color + '18'
                              : colors.bgCard,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: cls.color || colors.textMuted },
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusLabel,
                            { color: cls.color || colors.textSecondary },
                          ]}
                        >
                          {cls.label}
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })()}
              </View>
            )}
          </View>
        </ChartCard>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <View style={styles.footerSection}>
          <LegalDisclaimer />
          <BannerAd compact />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Static layout styles (no color references) ───────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },

  /* ── Header ──────────────────────────────────────────────────────────── */
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  headerMeta: {
    fontSize: 13,
    fontWeight: '400',
  },
  scroll: {
    paddingBottom: 40,
  },

  /* ── Filter Tabs ─────────────────────────────────────────────────────── */
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* ── Empty state ─────────────────────────────────────────────────────── */
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  /* ── Summary Grid ────────────────────────────────────────────────────── */
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
    borderWidth: 1,
    overflow: 'hidden',
  },
  metricAccent: {
    height: 3,
  },
  metricBody: {
    padding: 14,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricIcon: {
    fontSize: 15,
  },
  metricData: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricUnit: {
    fontSize: 12,
    fontWeight: '500',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },

  /* ── Chart Card ──────────────────────────────────────────────────────── */
  chartCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  chartCardAccent: {
    height: 3,
  },
  chartCardBody: {
    padding: 16,
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  chartSub: {
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 10,
  },

  /* ── Legend ──────────────────────────────────────────────────────────── */
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
    paddingTop: 8,
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

  /* ── Distribution ────────────────────────────────────────────────────── */
  distContainer: {
    marginTop: 6,
  },
  distRow: {
    marginBottom: 10,
  },
  distLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  distBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distBarTrack: {
    flex: 1,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  distBarFill: {
    height: 24,
    borderRadius: 12,
  },
  distCount: {
    width: 30,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  distSummary: {
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
    alignItems: 'center',
  },
  distSummaryText: {
    fontSize: 11,
    fontWeight: '500',
  },

  /* ── Status Card ─────────────────────────────────────────────────────── */
  statusGrid: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  statusItem: {
    flex: 1,
  },
  statusValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Footer ──────────────────────────────────────────────────────────── */
  footerSection: {
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
  },
});
