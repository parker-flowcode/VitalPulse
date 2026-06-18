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
import useHealthStore from '../store/healthstore';
import LegalDisclaimer from '../components/LegalDisclaimer';
import { classifyBPM } from '../utils/bpEstimator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;

export default function AnalyticsScreen() {
  const { history } = useHealthStore();

  // BUG FIX: datos ordenados cronológicamente (el historial está invertido)
  const chronological = useMemo(
    () => [...history].reverse().slice(-30),
    [history]
  );

  const bpmChartData = useMemo(
    () => chronological.map((item, i) => ({ x: i + 1, y: item.bpm || 0 })),
    [chronological]
  );

  const bpChartDataSys = useMemo(
    () =>
      chronological
        .filter((h) => h.bp?.systolic)
        .map((item, i) => ({ x: i + 1, y: item.bp.systolic })),
    [chronological]
  );

  const bpChartDataDia = useMemo(
    () =>
      chronological
        .filter((h) => h.bp?.diastolic)
        .map((item, i) => ({ x: i + 1, y: item.bp.diastolic })),
    [chronological]
  );

  const stats = useMemo(() => {
    if (history.length === 0) return null;
    const bpms = history.map((h) => h.bpm || 0).filter((b) => b > 0);
    if (bpms.length === 0) return null;
    return {
      avg: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
      max: Math.max(...bpms),
      min: Math.min(...bpms),
    };
  }, [history]);

  const axisStyle = {
    axis: { stroke: '#2A4A47' },
    tickLabels: { fill: '#4A6A67', fontSize: 10 },
    grid: { stroke: '#1A7F6E22', strokeWidth: 1 },
  };

  if (history.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Análisis</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📈</Text>
          <Text style={styles.emptyText}>Sin datos suficientes</Text>
          <Text style={styles.emptySub}>
            Realiza al menos una medición para ver tus gráficas
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Análisis</Text>

        {/* Stats resumen */}
        {stats && (
          <View style={styles.statsRow}>
            {[
              { label: 'Promedio', value: stats.avg },
              { label: 'Máximo', value: stats.max },
              { label: 'Mínimo', value: stats.min },
            ].map((s) => (
              <View key={s.label} style={styles.statBox}>
                <Text style={[styles.statValue, { color: classifyBPM(s.value).color }]}>
                  {s.value}
                </Text>
                <Text style={styles.statUnit}>BPM</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Gráfica BPM */}
        {bpmChartData.length > 1 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Frecuencia cardíaca</Text>
            <Text style={styles.chartSub}>
              Últimas {bpmChartData.length} mediciones
            </Text>
            <VictoryChart
              width={CHART_WIDTH}
              height={200}
              padding={{ top: 10, bottom: 40, left: 48, right: 16 }}
            >
              <VictoryAxis style={axisStyle} />
              <VictoryAxis dependentAxis style={axisStyle} />
              <VictoryLine
                data={bpmChartData}
                style={{ data: { stroke: '#2BBFA4', strokeWidth: 2 } }}
                interpolation="monotoneX"
              />
              <VictoryScatter
                data={bpmChartData}
                size={3}
                style={{ data: { fill: '#2BBFA4' } }}
              />
            </VictoryChart>
          </View>
        )}

        {/* Gráfica PA */}
        {bpChartDataSys.length > 1 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Presión arterial estimada</Text>
            <Text style={styles.chartSub}>
              Sistólica (verde) · Diastólica (coral)
            </Text>
            <VictoryChart
              width={CHART_WIDTH}
              height={200}
              padding={{ top: 10, bottom: 40, left: 48, right: 16 }}
            >
              <VictoryAxis style={axisStyle} />
              <VictoryAxis dependentAxis style={axisStyle} />
              <VictoryLine
                data={bpChartDataSys}
                style={{ data: { stroke: '#2BBFA4', strokeWidth: 2 } }}
                interpolation="monotoneX"
              />
              <VictoryLine
                data={bpChartDataDia}
                style={{ data: { stroke: '#F25C54', strokeWidth: 2 } }}
                interpolation="monotoneX"
              />
            </VictoryChart>
          </View>
        )}

        <LegalDisclaimer />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D1918' },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 16 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 16 },
  empty: {
    flex: 1, justifyContent: 'center',
    alignItems: 'center', padding: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptySub: {
    color: '#4A6A67', fontSize: 14,
    textAlign: 'center', marginTop: 8,
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1, backgroundColor: '#132220',
    borderRadius: 12, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#1A7F6E22',
  },
  statValue: { fontSize: 26, fontWeight: '700' },
  statUnit: { color: '#4A6A67', fontSize: 11 },
  statLabel: { color: '#4A6A67', fontSize: 11, marginTop: 2 },
  chartCard: {
    backgroundColor: '#132220', borderRadius: 16,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#1A7F6E22',
  },
  chartTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  chartSub: { color: '#4A6A67', fontSize: 12, marginTop: 2, marginBottom: 4 },
});
