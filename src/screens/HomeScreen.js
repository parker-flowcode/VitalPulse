import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SHADOWS } from '../theme/designTokens';
import useHealthStore from '../store/healthstore';
import LegalDisclaimer from '../components/LegalDisclaimer';
import BannerAd from '../components/BannerAd';
import { classifyBPM, classifyBP } from '../utils/bpEstimator';
import { getCurrentPlan, getRemainingMeasurements, isPro } from '../services/subscriptions';
import { showRewardedAd, useExtraMeasurement, getExtraMeasurements } from '../services/ads';

export default function HomeScreen({ navigation }) {
  const { history } = useHealthStore();

  const last = history[0] || null;
  const plan = getCurrentPlan();

  const todayCount = history.filter((h) => {
    try {
      return new Date(h.timestamp).toDateString() === new Date().toDateString();
    } catch {
      return false;
    }
  }).length;

  const remaining = getRemainingMeasurements(todayCount);
  const extraMeasurements = getExtraMeasurements();

  const avgBPM =
    history.length > 0
      ? Math.round(history.reduce((a, b) => a + (b.bpm || 0), 0) / history.length)
      : 0;

  const handleStartMeasurement = async () => {
    if (remaining > 0 || isPro()) {
      navigation.navigate('Measure');
      return;
    }

    if (extraMeasurements > 0) {
      useExtraMeasurement();
      navigation.navigate('Measure');
      return;
    }

    Alert.alert(
      'Mediciones agotadas',
      `Has alcanzado el limite de ${plan.maxMeasurementsPerDay} mediciones gratuitas por dia.\n\nPuedes ver un anuncio para obtener 1 medicion extra o actualizar a Pro.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ver anuncio (+1 gratis)',
          onPress: async () => {
            const rewarded = await showRewardedAd();
            if (rewarded) {
              Alert.alert(
                'Recompensa obtenida',
                'Gracias por ver el anuncio. Tienes 1 medicion extra disponible.',
                [{ text: 'Medir ahora', onPress: () => navigation.navigate('Measure') }]
              );
            }
          },
        },
        { text: 'VitalPulse Pro', onPress: () => navigation.navigate('Upgrade') },
      ]
    );
  };

  const handleWatchAd = async () => {
    const rewarded = await showRewardedAd();
    if (rewarded) {
      Alert.alert(
        'Recompensa obtenida',
        'Tienes 1 medicion extra disponible.',
        [{ text: 'Medir ahora', onPress: () => navigation.navigate('Measure') }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ───── Header ───── */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>Monitor cardiovascular personal</Text>
        </View>

        {/* ───── Mediciones restantes (pill) ───── */}
        {!isPro() && history.length > 0 && (
          <View style={styles.remainingPill}>
            <View style={styles.remainingDot} />
            <Text style={styles.remainingText}>
              {remaining} de {plan.maxMeasurementsPerDay} restantes
              {extraMeasurements > 0 ? `  +${extraMeasurements} extra` : ''}
            </Text>
          </View>
        )}

        {/* ───── Boton de medicion principal ───── */}
        <TouchableOpacity
          style={[
            styles.measureCard,
            remaining === 0 && extraMeasurements === 0 && !isPro() && styles.measureCardDisabled,
          ]}
          onPress={handleStartMeasurement}
          activeOpacity={0.85}
        >
          <View style={styles.measureCardAccent} />
          <View style={styles.measureCardContent}>
            <Text style={styles.measureIcon}>❤️</Text>
            <Text style={styles.measureCardTitle}>Iniciar Medicion</Text>
            <Text style={styles.measureCardSub}>~60 segundos · Camara trasera</Text>
          </View>
        </TouchableOpacity>

        {/* ───── Botones cuando se alcanza el limite ───── */}
        {!isPro() && remaining === 0 && extraMeasurements === 0 && history.length > 0 && (
          <View style={styles.limitRow}>
            <TouchableOpacity
              style={styles.watchAdBtn}
              onPress={handleWatchAd}
              activeOpacity={0.8}
            >
              <Text style={styles.watchAdBtnText}>Ver anuncio</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.proBtn}
              onPress={() => navigation.navigate('Upgrade')}
              activeOpacity={0.8}
            >
              <Text style={styles.proBtnText}>VitalPulse Pro</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ───── Ultima medicion ───── */}
        {last ? (
          <View style={styles.lastCard}>
            <View style={styles.lastCardHeader}>
              <Text style={styles.lastCardLabel}>Ultima medicion</Text>
              <Text style={styles.lastCardDate}>
                {new Date(last.timestamp).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={[styles.metricValue, { color: classifyBPM(last.bpm).color }]}>
                  {last.bpm}
                </Text>
                <Text style={styles.metricUnit}>BPM</Text>
                <View style={[styles.badge, { backgroundColor: classifyBPM(last.bpm).color + '18' }]}>
                  <Text style={[styles.badgeText, { color: classifyBPM(last.bpm).color }]}>
                    {classifyBPM(last.bpm).label}
                  </Text>
                </View>
              </View>
              {last.bp && (
                <View style={styles.metricDivider} />
              )}
              {last.bp && (
                <View style={styles.metric}>
                  <Text
                    style={[
                      styles.metricValue,
                      {
                        color: classifyBP(last.bp.systolic, last.bp.diastolic).color,
                        fontSize: 32,
                      },
                    ]}
                  >
                    {last.bp.systolic}/{last.bp.diastolic}
                  </Text>
                  <Text style={styles.metricUnit}>mmHg</Text>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: classifyBP(last.bp.systolic, last.bp.diastolic).color + '18' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: classifyBP(last.bp.systolic, last.bp.diastolic).color },
                      ]}
                    >
                      {classifyBP(last.bp.systolic, last.bp.diastolic).label}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>❤️</Text>
            <Text style={styles.emptyTitle}>Sin mediciones</Text>
            <Text style={styles.emptySub}>
              Realiza tu primera medicion para comenzar a monitorear tu salud cardiovascular.
            </Text>
          </View>
        )}

        {/* ───── Stats rapidas ───── */}
        {history.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{history.length}</Text>
              <Text style={styles.statLabel}>Mediciones</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{avgBPM}</Text>
              <Text style={styles.statLabel}>BPM medio</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{todayCount}</Text>
              <Text style={styles.statLabel}>Hoy</Text>
            </View>
          </View>
        )}

        {/* ───── Boton tutorial ───── */}
        <TouchableOpacity
          style={styles.tutorialBtn}
          onPress={() => navigation.navigate('Tutorial')}
          activeOpacity={0.7}
        >
          <Text style={styles.tutorialBtnIcon}>🎮</Text>
          <Text style={styles.tutorialBtnText}>Modo Tutorial (sin camara)</Text>
        </TouchableOpacity>

        {/* ───── Banner publicitario ───── */}
        <BannerAd />

        {/* ───── Disclaimer legal ───── */}
        <LegalDisclaimer />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },

  // ── Header ──
  header: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 12,
  },
  logoImage: {
    width: 48,
    height: 48,
    marginBottom: 10,
  },
  subtitle: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // ── Remaining pill ──
  remainingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: COLORS.primarySubtle,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 16,
  },
  remainingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: 8,
  },
  remainingText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },

  // ── CTA Measurement Card ──
  measureCard: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    ...SHADOWS.card,
  },
  measureCardDisabled: {
    opacity: 0.5,
  },
  measureCardAccent: {
    width: 4,
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  measureCardContent: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  measureIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  measureCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  measureCardSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 6,
  },

  // ── Limit reached buttons ──
  limitRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  watchAdBtn: {
    flex: 1,
    backgroundColor: COLORS.warningLight,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
  },
  watchAdBtnText: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '600',
  },
  proBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  proBtnText: {
    color: COLORS.textOnPrimary,
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Last measurement card ──
  lastCard: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.card,
  },
  lastCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  lastCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  lastCardDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
    marginHorizontal: 8,
  },
  metricValue: {
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  metricUnit: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Empty state ──
  emptyCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // ── Stats row ──
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.bgElevated,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Tutorial button ──
  tutorialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
    gap: 8,
  },
  tutorialBtnIcon: {
    fontSize: 16,
  },
  tutorialBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
