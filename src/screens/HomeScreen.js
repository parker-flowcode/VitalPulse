import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useHealthStore from '../store/healthstore';
import LegalDisclaimer from '../components/LegalDisclaimer';
import BannerAd from '../components/BannerAd';
import { classifyBPM, classifyBP } from '../utils/bpEstimator';
import { getCurrentPlan, getRemainingMeasurements, isPro } from '../services/subscriptions';

export default function HomeScreen({ navigation }) {
  const { history, loadAll } = useHealthStore();

  useEffect(() => {
    loadAll();
  }, []);

  const last = history[0] || null;
  const plan = getCurrentPlan();

  // Conteo de mediciones de hoy
  const todayCount = history.filter((h) => {
    try {
      return new Date(h.timestamp).toDateString() === new Date().toDateString();
    } catch {
      return false;
    }
  }).length;

  const remaining = getRemainingMeasurements(todayCount);

  // BPM promedio
  const avgBPM =
    history.length > 0
      ? Math.round(history.reduce((a, b) => a + (b.bpm || 0), 0) / history.length)
      : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0D1918" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>💚 VitalPulse</Text>
          <Text style={styles.subtitle}>Monitor cardiovascular personal</Text>
        </View>

        {/* Botón principal */}
        {/* Mediciones restantes hoy */}
        {!isPro() && history.length > 0 && (
          <View style={styles.remainingBar}>
            <Text style={styles.remainingText}>
              📊 {remaining} de {plan.maxMeasurementsPerDay} mediciones gratuitas hoy
            </Text>
            <View style={styles.remainingBarBg}>
              <View style={[styles.remainingBarFill, {
                width: `${((plan.maxMeasurementsPerDay - remaining) / plan.maxMeasurementsPerDay) * 100}%`,
                backgroundColor: remaining <= 1 ? '#F25C54' : '#2BBFA4',
              }]} />
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.measureButton, remaining === 0 && styles.measureButtonDisabled]}
          onPress={() => {
            if (remaining === 0) {
              Alert.alert(
                'Límite diario alcanzado',
                `Has alcanzado el límite de ${plan.maxMeasurementsPerDay} mediciones gratuitas por día.\n\nActualiza a VitalPulse Pro para mediciones ilimitadas.`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Ver Pro', onPress: () => navigation.navigate('Upgrade') },
                ]
              );
              return;
            }
            navigation.navigate('Measure');
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.measureIcon}>❤️</Text>
          <Text style={styles.measureButtonText}>Iniciar Medición</Text>
          <Text style={styles.measureButtonSub}>~60 segundos · Cámara trasera</Text>
        </TouchableOpacity>

        {/* Última medición */}
        {last ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Última medición</Text>
            <Text style={styles.cardDate}>
              {new Date(last.timestamp).toLocaleString('es-ES', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={[styles.metricValue, { color: classifyBPM(last.bpm).color }]}>
                  {last.bpm}
                </Text>
                <Text style={styles.metricLabel}>BPM</Text>
                <Text style={[styles.metricTag, { color: classifyBPM(last.bpm).color }]}>
                  {classifyBPM(last.bpm).label}
                </Text>
              </View>
              {last.bp && (
                <View style={styles.metric}>
                  <Text
                    style={[
                      styles.metricValue,
                      {
                        color: classifyBP(last.bp.systolic, last.bp.diastolic).color,
                        fontSize: 28,
                      },
                    ]}
                  >
                    {last.bp.systolic}/{last.bp.diastolic}
                  </Text>
                  <Text style={styles.metricLabel}>mmHg</Text>
                  <Text
                    style={[
                      styles.metricTag,
                      { color: classifyBP(last.bp.systolic, last.bp.diastolic).color },
                    ]}
                  >
                    {classifyBP(last.bp.systolic, last.bp.diastolic).label}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>Aún no tienes mediciones</Text>
            <Text style={styles.emptySubtext}>
              Realiza tu primera medición para ver tus datos aquí
            </Text>
          </View>
        )}

        {/* Stats rápidas */}
        {history.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{history.length}</Text>
              <Text style={styles.statLabel}>Mediciones</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{avgBPM}</Text>
              <Text style={styles.statLabel}>BPM medio</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{todayCount}</Text>
              <Text style={styles.statLabel}>Hoy</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.tutorialBtn}
          onPress={() => navigation.navigate('Tutorial')}
          activeOpacity={0.85}
        >
          <Text style={styles.tutorialBtnText}>🎮 Modo Tutorial (sin cámara)</Text>
        </TouchableOpacity>

        <LegalDisclaimer />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D1918' },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 28, marginTop: 8 },
  logo: { color: '#2BBFA4', fontSize: 26, fontWeight: '700', letterSpacing: 0.5 },
  subtitle: { color: '#4A6A67', fontSize: 14, marginTop: 4 },
  measureButton: {
    backgroundColor: '#1A7F6E',
    borderRadius: 20, padding: 28,
    alignItems: 'center', marginBottom: 24,
    shadowColor: '#2BBFA4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  measureButtonDisabled: {
    opacity: 0.5,
  },
  measureIcon: { fontSize: 48, marginBottom: 10 },
  measureButtonText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  measureButtonSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 6 },
  card: {
    backgroundColor: '#132220', borderRadius: 16,
    padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#1A7F6E33',
  },
  cardTitle: {
    color: '#4A6A67', fontSize: 13, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  cardDate: { color: '#2BBFA4', fontSize: 12, marginTop: 4, marginBottom: 16 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  metric: { alignItems: 'center' },
  metricValue: {
    fontSize: 42, fontWeight: '700', color: '#2BBFA4',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: { color: '#4A6A67', fontSize: 12, marginTop: 2 },
  metricTag: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  emptyCard: {
    backgroundColor: '#132220', borderRadius: 16,
    padding: 32, alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: '#1A7F6E22',
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptySubtext: {
    color: '#4A6A67', fontSize: 13,
    textAlign: 'center', marginTop: 8,
  },
  tutorialBtn: {
    backgroundColor: '#132220',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1A7F6E44',
  },
  tutorialBtnText: {
    color: '#8BBAB5',
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 16, gap: 10,
  },
  statBox: {
    flex: 1, backgroundColor: '#132220',
    borderRadius: 12, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#1A7F6E22',
  },
  statValue: { color: '#2BBFA4', fontSize: 24, fontWeight: '700' },
  statLabel: { color: '#4A6A67', fontSize: 11, marginTop: 4 },

  // Barra de mediciones restantes
  remainingBar: {
    backgroundColor: '#132220', borderRadius: 12, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#1A7F6E22',
  },
  remainingText: { color: '#8BBAB5', fontSize: 12, marginBottom: 6 },
  remainingBarBg: {
    height: 4, backgroundColor: '#0D1918', borderRadius: 2,
    overflow: 'hidden',
  },
  remainingBarFill: {
    height: '100%', borderRadius: 2,
  },
});
