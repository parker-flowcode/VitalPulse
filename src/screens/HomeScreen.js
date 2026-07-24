/**
 * HomeScreen.js — VitalPulse v5.0 Premium Redesign
 *
 * Pantalla principal con logo, tarjetas premium, clasificaciones claras
 * y diseño oscuro optimizado para monitoreo cardiovascular.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  Image,
  Platform,
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
  const { colors, resolvedTheme } = useTheme();
  const { history } = useHealthStore();
  const [showProModal, setShowProModal] = useState(false);
  const [logoError, setLogoError] = useState(false);

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

  const isDark = resolvedTheme === 'dark';

  // ─── Derived styles ────────────────────────────────────────────────────────────
  const styles = createStyles(colors, isDark);

  // ─── Render ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ───── Hero Section: Logo + Branding ───── */}
        <View style={styles.heroSection}>
          {/* Logo: 60x60, centered, no background */}
          <View style={styles.logoWrapper}>
            {!logoError ? (
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logo}
                resizeMode="contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <View style={styles.logoFallback}>
                <Text style={styles.logoFallbackText}>VP</Text>
              </View>
            )}
          </View>
          {/* Title: sky blue gradient-like with textShadow */}
          <Text style={styles.title}>VitalPulse</Text>
          {/* Subtitle in muted gray */}
          <Text style={styles.subtitle}>Monitor cardiovascular personal</Text>
        </View>

        {/* ───── Remaining pill — always visible ───── */}
        <View style={styles.remainingPill}>
          <Text style={styles.remainingText}>
            {'📊 '}
            {isPro() ? 'Ilimitadas' : `${remaining} de ${plan.maxMeasurementsPerDay}`}
            {' disponibles hoy'}
          </Text>
        </View>

        {/* ───── CTA: Premium measurement card ───── */}
        <TouchableOpacity
          style={styles.measureCard}
          onPress={handleStartMeasurement}
          activeOpacity={0.85}
        >
          {/* Sky blue left accent — thicker for premium feel */}
          <View style={styles.measureAccent} />
          <View style={styles.measureContent}>
            {/* Heart icon */}
            <View style={styles.measureIconContainer}>
              <Text style={styles.measureIcon}>{'💙'}</Text>
            </View>
            <Text style={styles.measureTitle}>Iniciar Medicion</Text>
            <Text style={styles.measureSub}>~60 seg · Camara trasera</Text>
          </View>
          {/* Subtle chevron */}
          <View style={styles.measureChevron}>
            <Text style={styles.chevronText}>{'›'}</Text>
          </View>
        </TouchableOpacity>

        {/* ───── Limit reached: two action buttons ───── */}
        {atLimit && (
          <View style={styles.limitRow}>
            <TouchableOpacity
              style={styles.watchAdBtn}
              onPress={() => handleWatchAd(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.watchAdEmoji}>{'🎬'}</Text>
              <Text style={styles.watchAdBtnText}>Ver anuncio (+1)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.proBtn}
              onPress={handleUpgrade}
              activeOpacity={0.8}
            >
              <Text style={styles.proBtnEmoji}>{'💎'}</Text>
              <Text style={styles.proBtnText}>VitalPulse Pro</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ───── Last measurement card ───── */}
        {last ? (
          <View style={styles.lastCard}>
            {/* Card header */}
            <View style={styles.lastCardHeader}>
              <View style={styles.lastCardLabelRow}>
                <View style={styles.lastCardDot} />
                <Text style={styles.lastCardLabel}>Ultima medicion</Text>
              </View>
              <Text style={styles.lastCardDate}>
                {new Date(last.timestamp).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            {/* Metrics row: BPM | BP */}
            <View style={styles.metricsRow}>
              {/* ── BPM ── */}
              <View style={styles.metric}>
                <Text style={styles.metricUnitLabel}>Frecuencia Cardiaca</Text>
                <Text style={[styles.metricValue, { color: classifyBPM(last.bpm).color }]}>
                  {last.bpm}
                </Text>
                <Text style={styles.metricUnit}>BPM</Text>
                <View
                  style={[
                    styles.classificationBadge,
                    { backgroundColor: classifyBPM(last.bpm).color + (isDark ? '25' : '15') },
                  ]}
                >
                  <View
                    style={[styles.classificationDot, { backgroundColor: classifyBPM(last.bpm).color }]}
                  />
                  <Text style={[styles.classificationText, { color: classifyBPM(last.bpm).color }]}>
                    {classifyBPM(last.bpm).label}
                  </Text>
                </View>
              </View>

              {/* Divider */}
              {last.bp && <View style={styles.metricDivider} />}

              {/* ── BP ── */}
              {last.bp && (
                <View style={styles.metric}>
                  <Text style={styles.metricUnitLabel}>Presion Arterial</Text>
                  <Text
                    style={[
                      styles.metricValue,
                      styles.bpValue,
                      { color: classifyBP(last.bp.systolic, last.bp.diastolic).color },
                    ]}
                  >
                    {last.bp.systolic}/{last.bp.diastolic}
                  </Text>
                  <Text style={styles.metricUnit}>mmHg</Text>
                  <View
                    style={[
                      styles.classificationBadge,
                      {
                        backgroundColor:
                          classifyBP(last.bp.systolic, last.bp.diastolic).color + (isDark ? '25' : '15'),
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.classificationDot,
                        {
                          backgroundColor: classifyBP(last.bp.systolic, last.bp.diastolic).color,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.classificationText,
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
          /* ───── Empty state ───── */
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrapper}>
              <Text style={styles.emptyIcon}>{'❤️'}</Text>
            </View>
            <Text style={styles.emptyTitle}>Sin mediciones</Text>
            <Text style={styles.emptySub}>
              Realiza tu primera medicion para comenzar a monitorear tu salud
              cardiovascular.
            </Text>
            <TouchableOpacity
              style={styles.emptyCta}
              onPress={handleStartMeasurement}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyCtaText}>Comenzar medicion</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ───── Stats row: 3 compact cards ───── */}
        {history.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconRow}>
                <Text style={styles.statIcon}>{'📋'}</Text>
              </View>
              <Text style={styles.statValue}>{history.length}</Text>
              <Text style={styles.statLabel}>Mediciones</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconRow}>
                <Text style={styles.statIcon}>{'💓'}</Text>
              </View>
              <Text style={styles.statValue}>{avgBPM}</Text>
              <Text style={styles.statLabel}>BPM medio</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconRow}>
                <Text style={styles.statIcon}>{'📅'}</Text>
              </View>
              <Text style={styles.statValue}>{todayCount}</Text>
              <Text style={styles.statLabel}>Hoy</Text>
            </View>
          </View>
        )}

        {/* ───── Tutorial button ───── */}
        <TouchableOpacity
          style={styles.tutorialBtn}
          onPress={() => navigation.navigate('Tutorial')}
          activeOpacity={0.7}
        >
          <View style={styles.tutorialIconWrapper}>
            <Text style={styles.tutorialIcon}>{'🎮'}</Text>
          </View>
          <Text style={styles.tutorialBtnText}>Modo Tutorial (sin camara)</Text>
          <Text style={styles.tutorialChevron}>{'›'}</Text>
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
function createStyles(colors, isDark) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      padding: 20,
      paddingBottom: 40,
    },

    // ── Hero Section ──
    heroSection: {
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 20,
    },
    logoWrapper: {
      width: 72,
      height: 72,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      // Premium subtle glow
      ...Platform.select({
        ios: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    logo: {
      width: 60,
      height: 60,
      borderRadius: 16,
    },
    logoFallback: {
      width: 60,
      height: 60,
      borderRadius: 16,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoFallbackText: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.primary,
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      color: '#38BDF8',
      letterSpacing: -0.5,
      marginBottom: 6,
      // Text shadow for premium feel
      ...Platform.select({
        ios: {
          textShadowColor: 'rgba(56, 189, 248, 0.3)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 8,
        },
        android: {
          textShadowColor: 'rgba(56, 189, 248, 0.3)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 8,
        },
      }),
    },
    subtitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textMuted,
      letterSpacing: 0.4,
    },

    // ── Remaining pill ──
    remainingPill: {
      alignSelf: 'center',
      backgroundColor: colors.primarySubtle,
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderRadius: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.primary + (isDark ? '20' : '15'),
    },
    remainingText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.2,
    },

    // ── CTA Measurement Card ──
    measureCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: 20,
      marginBottom: 14,
      flexDirection: 'row',
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 14,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    measureAccent: {
      width: 6,
      backgroundColor: '#38BDF8',
      borderTopLeftRadius: 20,
      borderBottomLeftRadius: 20,
    },
    measureContent: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 26,
      paddingHorizontal: 16,
    },
    measureIconContainer: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary + (isDark ? '15' : '10'),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    measureIcon: {
      fontSize: 28,
    },
    measureTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    measureSub: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '500',
    },
    measureChevron: {
      justifyContent: 'center',
      paddingRight: 16,
    },
    chevronText: {
      fontSize: 24,
      color: colors.textMuted,
      fontWeight: '300',
    },

    // ── Limit reached buttons ──
    limitRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 18,
    },
    watchAdBtn: {
      flex: 1,
      backgroundColor: isDark ? '#422006' : colors.warningLight,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.warning + '30',
      flexDirection: 'row',
      gap: 6,
    },
    watchAdEmoji: {
      fontSize: 16,
    },
    watchAdBtnText: {
      color: isDark ? '#FDE68A' : '#92400E',
      fontSize: 13,
      fontWeight: '700',
    },
    proBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    proBtnEmoji: {
      fontSize: 16,
    },
    proBtnText: {
      color: colors.textOnPrimary,
      fontSize: 13,
      fontWeight: '800',
    },

    // ── Last measurement card ──
    lastCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: 20,
      padding: 20,
      marginBottom: 18,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    lastCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 18,
    },
    lastCardLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    lastCardDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
    },
    lastCardLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    lastCardDate: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    metricsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    metric: {
      alignItems: 'center',
      flex: 1,
    },
    metricUnitLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    metricDivider: {
      width: 1,
      height: 100,
      backgroundColor: colors.border,
      marginHorizontal: 12,
      alignSelf: 'center',
    },
    metricValue: {
      fontSize: 42,
      fontWeight: '800',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
      letterSpacing: -1,
      lineHeight: 48,
    },
    bpValue: {
      fontSize: 34,
      letterSpacing: -0.5,
    },
    metricUnit: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    classificationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 12,
      marginTop: 10,
    },
    classificationDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    classificationText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.2,
    },

    // ── Empty state ──
    emptyCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: 20,
      padding: 36,
      alignItems: 'center',
      marginBottom: 18,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    emptyIconWrapper: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary + (isDark ? '15' : '8'),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    emptyIcon: {
      fontSize: 30,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 10,
      letterSpacing: -0.3,
    },
    emptySub: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 22,
      paddingHorizontal: 12,
    },
    emptyCta: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 32,
    },
    emptyCtaText: {
      color: colors.textOnPrimary,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.2,
    },

    // ── Stats row ──
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 18,
      gap: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.bgElevated,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    statIconRow: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.primary + (isDark ? '12' : '8'),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    statIcon: {
      fontSize: 14,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.primary,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.3,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      marginTop: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },

    // ── Tutorial button ──
    tutorialBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      marginBottom: 14,
      backgroundColor: colors.bgElevated,
      borderRadius: 14,
      gap: 10,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        },
        android: {
          elevation: 1,
        },
      }),
    },
    tutorialIconWrapper: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.secondary + (isDark ? '15' : '10'),
      alignItems: 'center',
      justifyContent: 'center',
    },
    tutorialIcon: {
      fontSize: 14,
    },
    tutorialBtnText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
    },
    tutorialChevron: {
      fontSize: 20,
      color: colors.textMuted,
      fontWeight: '300',
    },
  });
}
