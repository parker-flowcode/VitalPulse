/**
 * HomeScreen.js — VitalPulse v5.0
 *
 * Premium minimalist redesign using theme system.
 * No logo, clean cards, always-visible measurement pill, blue accents.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import useHealthStore from '../store/healthstore';
import LegalDisclaimer from '../components/LegalDisclaimer';
import BannerAd from '../components/BannerAd';
import ProFeaturesModal from '../components/ProFeaturesModal';
import { classifyBPM, classifyBP } from '../utils/bpEstimator';
import { getCurrentPlan, getRemainingMeasurements, isPro } from '../services/subscriptions';
import { showRewardedAd, useExtraMeasurement, getExtraMeasurements } from '../services/ads';

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const { history } = useHealthStore();
  const [showProModal, setShowProModal] = useState(false);

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

  const atLimit = remaining === 0 && extraMeasurements === 0 && !isPro();

  const handleStartMeasurement = useCallback(async () => {
    if (remaining > 0 || isPro()) {
      navigation.navigate('Measure');
      return;
    }
    if (extraMeasurements > 0) {
      useExtraMeasurement();
      navigation.navigate('Measure');
      return;
    }
    setShowProModal(true);
  }, [remaining, extraMeasurements, navigation]);

  const handleWatchAd = useCallback(async (fromModal = false) => {
    const rewarded = await showRewardedAd();
    if (rewarded) {
      Alert.alert(
        'Recompensa obtenida',
        'Gracias por ver el anuncio. Tienes 1 medicion extra disponible.',
        [
          {
            text: 'Medir ahora',
            onPress: () => navigation.navigate('Measure'),
          },
        ]
      );
    }
    if (fromModal) {
      setShowProModal(false);
    }
  }, [navigation]);

  const handleUpgrade = useCallback(() => {
    setShowProModal(false);
    navigation.navigate('Upgrade');
  }, [navigation]);

  const handleCloseProModal = useCallback(() => {
    setShowProModal(false);
  }, []);

  // ─── Derived styles ────────────────────────────────────────────────────────────
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ───── Header: clean minimal, no logo ───── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>VitalPulse</Text>
          <Text style={styles.headerSub}>Monitor cardiovascular personal</Text>
        </View>

        {/* ───── Mediciones disponibles pill (always visible unless Pro) ───── */}
        {!isPro() && (
          <View style={styles.remainingPill}>
            <Text style={styles.remainingText}>
              {'📊 '}{remaining}{' de '}{plan.maxMeasurementsPerDay}{' disponibles hoy'}
            </Text>
          </View>
        )}

        {/* ───── CTA button: clean white card, blue left border ───── */}
        <TouchableOpacity
          style={styles.measureCard}
          onPress={handleStartMeasurement}
          activeOpacity={0.85}
        >
          <View style={styles.measureAccent} />
          <View style={styles.measureContent}>
            <Text style={styles.measureIcon}>{'💙'}</Text>
            <Text style={styles.measureTitle}>Iniciar Medicion</Text>
            <Text style={styles.measureSub}>~60 seg · Camara trasera</Text>
          </View>
        </TouchableOpacity>

        {/* ───── Limit reached: two action buttons side by side ───── */}
        {atLimit && (
          <View style={styles.limitRow}>
            <TouchableOpacity
              style={styles.watchAdBtn}
              onPress={() => handleWatchAd(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.watchAdBtnText}>{'🎬 Ver anuncio (+1)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.proBtn}
              onPress={handleUpgrade}
              activeOpacity={0.8}
            >
              <Text style={styles.proBtnText}>{'💎 VitalPulse Pro'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ───── Last measurement card ───── */}
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
              {last.bp && <View style={styles.metricDivider} />}
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
                      {
                        backgroundColor:
                          classifyBP(last.bp.systolic, last.bp.diastolic).color + '18',
                      },
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
          /* ───── Empty state: clean minimal, no logo ───── */
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin mediciones</Text>
            <Text style={styles.emptySub}>
              Realiza tu primera medicion para comenzar a monitorear tu salud
              cardiovascular.
            </Text>
            <TouchableOpacity
              style={styles.emptyCta}
              onPress={handleStartMeasurement}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyCtaText}>Comenzar medicion</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ───── Stats row: 3 compact stats ───── */}
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

        {/* ───── Tutorial button: subtle text link ───── */}
        <TouchableOpacity
          style={styles.tutorialBtn}
          onPress={() => navigation.navigate('Tutorial')}
          activeOpacity={0.7}
        >
          <Text style={styles.tutorialBtnText}>
            {'🎮 '}Modo Tutorial (sin camara)
          </Text>
        </TouchableOpacity>

        {/* ───── Disclaimer first, then BannerAd ───── */}
        <LegalDisclaimer />
        <BannerAd />
      </ScrollView>

      {/* ───── Pro Features Modal ───── */}
      <ProFeaturesModal
        visible={showProModal}
        onClose={handleCloseProModal}
        onWatchAd={() => handleWatchAd(true)}
        onUpgrade={handleUpgrade}
      />
    </SafeAreaView>
  );
}

// ─── Dynamic styles factory ─────────────────────────────────────────────────────
function createStyles(colors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      padding: 20,
      paddingBottom: 40,
    },

    // ── Header ──
    header: {
      alignItems: 'center',
      marginBottom: 24,
      marginTop: 16,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    headerSub: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.primary,
      letterSpacing: 0.2,
    },

    // ── Remaining pill (always shown unless Pro) ──
    remainingPill: {
      alignSelf: 'center',
      backgroundColor: colors.primarySubtle,
      paddingVertical: 7,
      paddingHorizontal: 18,
      borderRadius: 20,
      marginBottom: 18,
    },
    remainingText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '600',
    },

    // ── CTA Measurement Card ──
    measureCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: 16,
      marginBottom: 12,
      flexDirection: 'row',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    measureAccent: {
      width: 4,
      backgroundColor: colors.primary,
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
    },
    measureContent: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 20,
    },
    measureIcon: {
      fontSize: 32,
      marginBottom: 8,
      color: colors.primary,
    },
    measureTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    measureSub: {
      fontSize: 13,
      color: colors.textMuted,
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
      backgroundColor: colors.warningLight,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.warning + '30',
    },
    watchAdBtnText: {
      color: '#92400E',
      fontSize: 13,
      fontWeight: '600',
    },
    proBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
    },
    proBtnText: {
      color: colors.textOnPrimary,
      fontSize: 13,
      fontWeight: '700',
    },

    // ── Last measurement card ──
    lastCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
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
      color: colors.textMuted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    lastCardDate: {
      fontSize: 12,
      color: colors.textSecondary,
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
      backgroundColor: colors.border,
      marginHorizontal: 8,
    },
    metricValue: {
      fontSize: 40,
      fontWeight: '700',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    metricUnit: {
      fontSize: 12,
      color: colors.textMuted,
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
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: 32,
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    emptySub: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 18,
    },
    emptyCta: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    emptyCtaText: {
      color: colors.textOnPrimary,
      fontSize: 14,
      fontWeight: '600',
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
      backgroundColor: colors.bgElevated,
      borderRadius: 14,
      padding: 14,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.primary,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // ── Tutorial button (subtle text link) ──
    tutorialBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      marginBottom: 12,
    },
    tutorialBtnText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '500',
    },
  });
}
