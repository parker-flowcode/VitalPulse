/**
 * AnalyticsScreen.js — VitalPulse v9.5
 *
 * Pantalla de analisis premium con metricas coloreadas por tipo,
 * graficas con etiquetas de unidad, modal popup para detalle de tarjetas
 * y distribucion de PA con colores clinicos.
 */
import React, { useMemo, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Modal,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryScatter,
  VictoryTooltip,
  VictoryVoronoiContainer,
  VictoryArea,
} from 'victory-native';
import { Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import useHealthStore from '../store/healthstore';
import { classifyBPM, classifyBP } from '../utils/bpEstimator';
import BottomWarningAdWrapper from '../components/BottomWarningAdWrapper';
import { SPACING, RADIUS, SHADOWS } from '../theme/designTokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 210;

// ─── Card color palette (one distinct color per metric) ─────────────────
const CARD_COLORS = {
  bpm:   '#10B981', // success green
  bp:    '#EF4444', // danger red
  hrv:   '#6366F1', // info indigo
  total: '#38BDF8', // primary sky blue
};

// ─── Modal config per metric card ────────────────────────────────────────
const MODAL_CONFIG = {
  bpm:   { title: 'Frecuencia Cardiaca',      icon: 'heart',         color: CARD_COLORS.bpm },
  bp:    { title: 'Presion Arterial',          icon: 'water',         color: CARD_COLORS.bp },
  hrv:   { title: 'Variabilidad Cardiaca (HRV)', icon: 'heart-pulse', color: CARD_COLORS.hrv },
  total: { title: 'Total Mediciones',          icon: 'clipboard-text',color: CARD_COLORS.total },
};

// ─── Axis style factory ─────────────────────────────────────────────────
function createAxisStyle(colors) {
  return {
    axis: { stroke: colors.border, strokeWidth: 1 },
    axisLabel: { padding: 30, fontSize: 10, fill: colors.textMuted },
    tickLabels: {
      fill: colors.textMuted,
      fontSize: 9,
      fontFamily: 'System',
      padding: 3,
    },
    grid: {
      stroke: 'transparent',
      strokeWidth: 0,
    },
  };
}

function createDependentAxisStyle(axisStyle) {
  return {
    ...axisStyle,
    tickLabels: { ...axisStyle.tickLabels, fontSize: 8, padding: 2 },
    grid: {
      stroke: 'transparent',
      strokeWidth: 0,
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

function formatFullDate(timestamp) {
  if (!timestamp) return '';
  try {
    const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
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

// ─── Expanded detail sections per card ──────────────────────────────────
function BpmExpanded({ stats, cardColors, c }) {
  const classList = Object.entries(stats.bpmClassCounts);

  return (
    <View style={styles.expandedBody}>
      {/* Min / Max / Last row */}
      <View style={styles.expandedRow}>
        <View style={styles.expandedStat}>
          <Text style={[styles.expandedStatVal, { color: cardColors.bpm }]}>
            {stats.minBpm}
          </Text>
          <Text style={[styles.expandedStatLbl, { color: c.textMuted }]}>
            Minimo
          </Text>
        </View>
        <View style={styles.expandedStat}>
          <Text style={[styles.expandedStatVal, { color: cardColors.bpm }]}>
            {stats.maxBpm}
          </Text>
          <Text style={[styles.expandedStatLbl, { color: c.textMuted }]}>
            Maximo
          </Text>
        </View>
        <View style={styles.expandedStat}>
          <Text style={[styles.expandedStatVal, { color: cardColors.bpm }]}>
            {stats.lastBpm}
          </Text>
          <Text style={[styles.expandedStatLbl, { color: c.textMuted }]}>
            Ultimo
          </Text>
        </View>
      </View>

      {/* Latest classification badge */}
      {stats.lastBpmClass && (
        <View style={[styles.expandedBadge, { backgroundColor: cardColors.bpm + '15' }]}>
          <View style={[styles.expandedDot, { backgroundColor: stats.lastBpmClass.color || cardColors.bpm }]} />
          <Text style={[styles.expandedBadgeText, { color: stats.lastBpmClass.color || cardColors.bpm }]}>
            Ultimo: {stats.lastBpmClass.label}
          </Text>
        </View>
      )}

      {/* Classification breakdown */}
      {classList.length > 0 && (
        <View style={styles.expandedSection}>
          <Text style={[styles.expandedSectionTitle, { color: c.textSecondary }]}>
            Clasificaciones
          </Text>
          {classList.map(([lbl, cnt]) => (
            <View key={lbl} style={styles.expandedClassRow}>
              <Text style={[styles.expandedClassLabel, { color: c.textSecondary }]}>
                {lbl}
              </Text>
              <Text style={[styles.expandedClassCount, { color: c.textPrimary }]}>
                {cnt} {cnt === 1 ? 'vez' : 'veces'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function BpExpanded({ stats, cardColors, c }) {
  if (!stats.bpDetail) {
    return (
      <View style={styles.expandedBody}>
        <Text style={[styles.expandedEmpty, { color: c.textMuted }]}>
          No hay mediciones de presion arterial registradas.
        </Text>
      </View>
    );
  }

  const detail = stats.bpDetail;
  const clsColor = detail.classColor || cardColors.bp;

  return (
    <View style={styles.expandedBody}>
      {/* Systolic / Diastolic / Classification row */}
      <View style={styles.expandedRow}>
        <View style={styles.expandedStat}>
          <Text style={[styles.expandedStatVal, { color: cardColors.bp }]}>
            {detail.sys}
          </Text>
          <Text style={[styles.expandedStatLbl, { color: c.textMuted }]}>
            Sistolica
          </Text>
        </View>
        <View style={styles.expandedStat}>
          <Text style={[styles.expandedStatVal, { color: cardColors.bp }]}>
            {detail.dia}
          </Text>
          <Text style={[styles.expandedStatLbl, { color: c.textMuted }]}>
            Diastolica
          </Text>
        </View>
        <View style={styles.expandedStat}>
          <Text style={[styles.expandedStatVal, { color: clsColor, fontSize: 13 }]}>
            {detail.classification}
          </Text>
          <Text style={[styles.expandedStatLbl, { color: c.textMuted }]}>
            Clasificacion
          </Text>
        </View>
      </View>

      {/* Description badge */}
      <View style={[styles.expandedBadge, { backgroundColor: clsColor + '15' }]}>
        <Text style={[styles.expandedDesc, { color: c.textSecondary }]}>
          {getBpDescription(detail.classification)}
        </Text>
      </View>

      {/* Date */}
      <Text style={[styles.expandedDate, { color: c.textMuted }]}>
        Registrado el {formatFullDate(detail.timestamp)}
      </Text>
    </View>
  );
}

function HrvExpanded({ stats, cardColors, c }) {
  const sdnn = stats.avgSdnn;
  const interpretation = getHrvInterpretation(sdnn);
  const interpColor = sdnn < 30 ? '#EF4444' : sdnn < 60 ? '#F59E0B' : '#10B981';

  return (
    <View style={styles.expandedBody}>
      {/* Interpretation badge */}
      <View style={[styles.expandedBadge, { backgroundColor: interpColor + '15' }]}>
        <View style={[styles.expandedDot, { backgroundColor: interpColor }]} />
        <Text style={[styles.expandedBadgeText, { color: interpColor }]}>
          {interpretation}
        </Text>
      </View>

      {/* SDNN explanation */}
      <View style={styles.expandedSection}>
        <Text style={[styles.expandedSectionTitle, { color: c.textSecondary }]}>
          Que es SDNN?
        </Text>
        <Text style={[styles.expandedDesc, { color: c.textMuted }]}>
          El SDNN mide la variabilidad del ritmo cardiaco. Valores altos indican buena
          recuperacion y salud cardiovascular.
        </Text>
      </View>
    </View>
  );
}

function TotalExpanded({ stats, cardColors, c }) {
  return (
    <View style={styles.expandedBody}>
      {/* Total count */}
      <View style={styles.expandedRow}>
        <View style={[styles.expandedStat, { flex: 1 }]}>
          <Text style={[styles.expandedStatVal, { color: cardColors.total, fontSize: 28 }]}>
            {stats.total}
          </Text>
          <Text style={[styles.expandedStatLbl, { color: c.textMuted }]}>
            Total registros
          </Text>
        </View>
      </View>

      {/* Date range */}
      <Text style={[styles.expandedDate, { color: c.textMuted }]}>
        Rango: {stats.dateRange}
      </Text>

      {/* Tip */}
      <Text style={[styles.expandedTip, { color: c.textSecondary }]}>
        {stats.total > 0
          ? stats.total === 1
            ? 'Realiza mas mediciones para obtener tendencias.'
            : 'Mantener un registro regular ayuda a identificar patrones en tu salud cardiovascular.'
          : 'Comienza a registrar mediciones para ver tu historial.'}
      </Text>
    </View>
  );
}

// ─── Metric Card ────────────────────────────────────────────────────────
function MetricCard({
  label, value, unit, color, icon, c, onPress,
}) {
  // When icon is explicitly null, hide both the accent bar and the icon.
  // When icon is a string, show both.
  const showAccent = icon !== null;
  const showIcon = icon !== null;

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
      {/* Top accent bar (hidden when icon is null) */}
      {showAccent && (
        <View style={[styles.metricAccent, { backgroundColor: color || c.primary }]} />
      )}

      <View style={styles.metricBody}>
        <View style={styles.metricHeader}>
          {/* Icon circle (hidden when icon is null) */}
          {showIcon && (
            <View
              style={[
                styles.metricIconWrap,
                { backgroundColor: color ? color + '18' : c.primarySubtle },
              ]}
            >
              <Icon name={icon} size={15} color={color || c.primary} />
            </View>
          )}
        </View>

        <View style={styles.metricData}>
          <Text
            style={[styles.metricValue, { color: color || c.textPrimary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {value}
          </Text>
          {unit !== null && unit !== undefined && (
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
  const [modalCard, setModalCard] = useState(null);

  // Open modal for the given card key
  const openModal = useCallback((cardKey) => {
    setModalCard(cardKey);
  }, []);

  // Close the detail modal
  const closeModal = useCallback(() => {
    setModalCard(null);
  }, []);

  // ─── Data processing ─────────────────────────────────────────────────
  const filteredHistory = useMemo(
    () => filterByPeriod(history, selectedFilter),
    [history, selectedFilter]
  );

  const chronological = useMemo(
    () => [...filteredHistory].slice(-40).reverse(),
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
  const bpmChartData = useMemo(() => {
    const raw = chronological
      .filter((h) => h.bpm && h.bpm > 0)
      .map((item) => ({
        x: new Date(item.timestamp).getTime(),
        y: item.bpm,
        ts: item.timestamp,
      }));
    return raw.reverse();
  }, [chronological]);

  const bpmTickValues = useMemo(
    () => buildDateTickValues(bpmChartData, 5),
    [bpmChartData]
  );

  // ─── BP Chart Data ───────────────────────────────────────────────────
  const bpChartData = useMemo(() => {
    const valid = chronological.filter(
      (h) => h.bp?.systolic && h.bp?.diastolic
    );
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
  const hrvChartData = useMemo(() => {
    const raw = chronological
      .filter((h) => h.sdnn && h.sdnn > 0)
      .map((item) => ({
        x: new Date(item.timestamp).getTime(),
        y: Math.round(item.sdnn * 10) / 10,
        ts: item.timestamp,
      }));
    return raw.reverse();
  }, [chronological]);

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

    const lastBpmItem = [...filteredHistory].reverse().find((h) => h.bpm && h.bpm > 0);
    const lastBpm = lastBpmItem ? lastBpmItem.bpm : 0;
    const lastBpmClass = classifyBPM(lastBpm);

    return { avgBpm, lastBpStr, avgSdnn, total: filteredHistory.length, lastBpm, lastBpmClass };
  }, [filteredHistory]);

  // ─── Extra stats for expanded cards ──────────────────────────────────
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
        classColor: cls.color,
        timestamp: lastBpItem.timestamp,
      };
    }

    const timestamps = filteredHistory.map((h) => h.timestamp).filter(Boolean).sort();
    const dateRange = timestamps.length > 1
      ? formatDate(timestamps[0]) + ' — ' + formatDate(timestamps[timestamps.length - 1])
      : timestamps.length === 1
      ? formatDate(timestamps[0])
      : 'Sin datos';

    return {
      minBpm, maxBpm, bpmClassCounts, bpDetail, dateRange,
      lastBpm: summaryMetrics.lastBpm,
      lastBpmClass: summaryMetrics.lastBpmClass,
      avgSdnn: summaryMetrics.avgSdnn,
      total: summaryMetrics.total,
    };
  }, [filteredHistory, summaryMetrics]);

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
            <Icon name="chart-bar" size={32} color={colors.primary} />
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

  // ─── Chart line colors ───────────────────────────────────────────────
  const bpmLineColor = colors.chartBPM || CARD_COLORS.bpm;
  const sysLineColor = colors.chartSystolic || '#3B82F6';
  const diaLineColor = colors.chartDiastolic || '#93C5FD';
  const hrvLineColor = colors.chartHRV || CARD_COLORS.hrv;

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

        {/* ── Summary Grid (2x2) with modal expansion ───────────────── */}
        <View style={styles.summaryGrid}>
          {/* Promedio BPM — success green */}
          <MetricCard
            label="Promedio BPM"
            value={summaryMetrics.avgBpm}
            unit="BPM"
            color={CARD_COLORS.bpm}
            icon="heart"
            c={colors}
            onPress={() => openModal('bpm')}
          />

          {/* Ultima PA — danger red, water drop icon */}
          <MetricCard
            label="Ultima PA"
            value={summaryMetrics.lastBpStr}
            unit="mmHg"
            color={CARD_COLORS.bp}
            icon="water"
            c={colors}
            onPress={() => openModal('bp')}
          />

          {/* HRV Promedio — info indigo */}
          <MetricCard
            label="HRV Promedio"
            value={
              summaryMetrics.avgSdnn > 0
                ? summaryMetrics.avgSdnn.toFixed(1)
                : '--'
            }
            unit="ms"
            color={CARD_COLORS.hrv}
            icon="heart-pulse"
            c={colors}
            onPress={() => openModal('hrv')}
          />

          {/* Total Mediciones — primary sky blue */}
          <MetricCard
            label="Total Mediciones"
            value={summaryMetrics.total}
            color={CARD_COLORS.total}
            icon="clipboard-text"
            c={colors}
            onPress={() => openModal('total')}
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
              padding={{ top: 10, bottom: 38, left: 50, right: 14 }}
              scale={{ x: 'time' }}
              containerComponent={
                <VictoryVoronoiContainer
                  voronoiDimension="x"
                  radius={40}
                  labels={({ datum }) => formatDate(datum.ts) + ': ' + datum.y + ' BPM'}
                  labelComponent={
                    <VictoryTooltip
                      constrainToVisibleArea
                      style={{ fill: 'white', fontSize: 12, fontWeight: '500' }}
                      flyoutStyle={{ fill: '#1E293B', stroke: CARD_COLORS.bpm, strokeWidth: 1.5 }}
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
                label="BPM"
                style={depAxisStyle}
                tickFormat={(t) => Math.round(t)}
              />
              <Defs>
                <LinearGradient id="bpmGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={bpmLineColor} stopOpacity={0.3} />
                  <Stop offset="100%" stopColor={bpmLineColor} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <VictoryArea
                data={bpmChartData}
                style={{
                  data: {
                    fill: 'url(#bpmGradient)',
                    opacity: 0.15,
                  },
                }}
                interpolation="natural"
              />
              <VictoryLine
                data={bpmChartData}
                style={{
                  data: {
                    stroke: bpmLineColor,
                    strokeWidth: 2.5,
                  },
                }}
                interpolation="natural"
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
              padding={{ top: 10, bottom: 38, left: 56, right: 14 }}
              scale={{ x: 'time' }}
              containerComponent={
                <VictoryVoronoiContainer
                  voronoiDimension="x"
                  radius={40}
                  labels={({ datum }) => formatDate(datum.ts) + ': ' + datum.y + ' mmHg'}
                  labelComponent={
                    <VictoryTooltip
                      constrainToVisibleArea
                      style={{ fill: 'white', fontSize: 12, fontWeight: '500' }}
                      flyoutStyle={{ fill: '#1E293B', stroke: '#3B82F6', strokeWidth: 1.5 }}
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
                label="mmHg"
                style={depAxisStyle}
                tickFormat={(t) => Math.round(t)}
              />
              <Defs>
                <LinearGradient id="sysGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={sysLineColor} stopOpacity={0.3} />
                  <Stop offset="100%" stopColor={sysLineColor} stopOpacity={0} />
                </LinearGradient>
                <LinearGradient id="diaGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={diaLineColor} stopOpacity={0.3} />
                  <Stop offset="100%" stopColor={diaLineColor} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {/* Systolic */}
              <VictoryArea
                data={bpChartData.sys}
                style={{
                  data: {
                    fill: 'url(#sysGradient)',
                    opacity: 0.15,
                  },
                }}
                interpolation="natural"
              />
              <VictoryLine
                data={bpChartData.sys}
                style={{
                  data: {
                    stroke: sysLineColor,
                    strokeWidth: 2.5,
                  },
                }}
                interpolation="natural"
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
              {/* Diastolic */}
              <VictoryArea
                data={bpChartData.dia}
                style={{
                  data: {
                    fill: 'url(#diaGradient)',
                    opacity: 0.15,
                  },
                }}
                interpolation="natural"
              />
              <VictoryLine
                data={bpChartData.dia}
                style={{
                  data: {
                    stroke: diaLineColor,
                    strokeWidth: 2,
                  },
                }}
                interpolation="natural"
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
                  voronoiDimension="x"
                  radius={40}
                  labels={({ datum }) => formatDate(datum.ts) + ': ' + datum.y + ' ms'}
                  labelComponent={
                    <VictoryTooltip
                      constrainToVisibleArea
                      style={{ fill: 'white', fontSize: 12, fontWeight: '500' }}
                      flyoutStyle={{ fill: '#1E293B', stroke: CARD_COLORS.hrv, strokeWidth: 1.5 }}
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
                label="ms"
                style={depAxisStyle}
                tickFormat={(t) => Math.round(t)}
              />
              <Defs>
                <LinearGradient id="hrvGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={hrvLineColor} stopOpacity={0.3} />
                  <Stop offset="100%" stopColor={hrvLineColor} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <VictoryArea
                data={hrvChartData}
                style={{
                  data: {
                    fill: 'url(#hrvGradient)',
                    opacity: 0.15,
                  },
                }}
                interpolation="natural"
              />
              <VictoryLine
                data={hrvChartData}
                style={{
                  data: {
                    stroke: hrvLineColor,
                    strokeWidth: 2.5,
                  },
                }}
                interpolation="natural"
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
                          summaryMetrics.lastBpmClass.color || colors.textSecondary,
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
          <BottomWarningAdWrapper />
        </View>
      </ScrollView>

      {/* ── Metric Detail Modal ────────────────────────────────────────── */}
      {modalCard && MODAL_CONFIG[modalCard] && (
        <Modal
          visible={modalCard !== null}
          transparent
          animationType="fade"
          onRequestClose={closeModal}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalCard,
                SHADOWS.card,
                {
                  backgroundColor: colors.bg,
                  borderColor: colors.borderLight,
                },
              ]}
            >
              {/* Top accent bar */}
              <View
                style={[
                  styles.modalAccent,
                  { backgroundColor: MODAL_CONFIG[modalCard].color },
                ]}
              />

              {/* Close button */}
              <TouchableOpacity
                onPress={closeModal}
                style={styles.modalClose}
              >
                <Icon
                  name="close"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {/* Header */}
              <View style={styles.modalHeader}>
                <View
                  style={[
                    styles.modalIconWrap,
                    { backgroundColor: MODAL_CONFIG[modalCard].color + '18' },
                  ]}
                >
                  <Icon
                    name={MODAL_CONFIG[modalCard].icon}
                    size={20}
                    color={MODAL_CONFIG[modalCard].color}
                  />
                </View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {MODAL_CONFIG[modalCard].title}
                </Text>
              </View>

              {/* Body */}
              <View style={styles.modalContent}>
                {modalCard === 'bpm' && (
                  <BpmExpanded stats={extraStats} cardColors={CARD_COLORS} c={colors} />
                )}
                {modalCard === 'bp' && (
                  <BpExpanded stats={extraStats} cardColors={CARD_COLORS} c={colors} />
                )}
                {modalCard === 'hrv' && (
                  <HrvExpanded stats={extraStats} cardColors={CARD_COLORS} c={colors} />
                )}
                {modalCard === 'total' && (
                  <TotalExpanded stats={extraStats} cardColors={CARD_COLORS} c={colors} />
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
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
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
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

  /* ── Expanded detail area (used inside Modal) ────────────────────────── */
  expandedBody: {
    gap: 10,
  },
  expandedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  expandedStat: {
    flex: 1,
    alignItems: 'center',
  },
  expandedStatVal: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  expandedStatLbl: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  expandedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  expandedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  expandedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  expandedDesc: {
    fontSize: 12,
    fontWeight: '400',
    flex: 1,
    lineHeight: 17,
  },
  expandedSection: {
    paddingTop: 2,
    gap: 6,
  },
  expandedSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expandedClassRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  expandedClassLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  expandedClassCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  expandedDate: {
    fontSize: 11,
    fontWeight: '500',
  },
  expandedTip: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    fontStyle: 'italic',
  },
  expandedEmpty: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    paddingVertical: 6,
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

  /* ── Modal ───────────────────────────────────────────────────────────── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalAccent: {
    height: 4,
  },
  modalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  modalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
  },

  /* ── Footer ──────────────────────────────────────────────────────────── */
  footerSection: {
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
  },
});
