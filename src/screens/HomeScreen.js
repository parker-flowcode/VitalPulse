/**
 * HomeScreen.js — VitalPulse v9.0 Glassmorphism Compact Redesign
 *
 * Compact glassmorphism home screen. All sections are aggressively
 * sized to fit <650 px total so most phones see everything without
 * scrolling. Uses { useTheme } for all colors.
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
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
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
        {/* ───── Hero Section (~90px): Logo + Branding ───── */}
        <View style={styles.heroGlass}>
          <View style={styles.heroRow}>
            {!logoError ? (
              <Image
                source={require('../../assets/icon.png')}
                style={styles.heroLogo}
                resizeMode="contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <View style={styles.heroLogoFallback}>
                <Text style={styles.heroLogoFallbackText}>VP</Text>
              </View>
            )}
            <View style={styles.heroTextCol}>
              <Text style={styles.heroTitle}>VitalPulse</Text>
            </View>
          </View>
        </View>

        {/* ───── Remaining pill — always visible ───── */}
        <View style={styles.remainingPill}>
          <Icon name="chart-bar" size={14} color={colors.primary} />
          <Text style={styles.remainingText}>
            {isPro() ? ' Ilimitadas' : ` ${remaining} de ${plan.maxMeasurementsPerDay}`}
            {' disponibles hoy'}
          </Text>
        </View>

        {/* ───── CTA: Measurement card (~120px) ───── */}
        <TouchableOpacity
          style={styles.measureGlass}
          onPress={handleStartMeasurement}
          activeOpacity={0.85}
        >
          {/* Left sky blue accent — 3px */}
          <View style={styles.measureAccent} />
          <View style={styles.measureContent}>
            <Icon name="heart-pulse" size={40} color={colors.primary} />
            <Text style={styles.measureTitle}>Iniciar Medicion</Text>
            <Text style={styles.measureSub}>~60 seg · Camara trasera</Text>
          </View>
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
              <Icon name="play-circle" size={18} color="#92400E" />
              <Text style={styles.watchAdBtnText}>Ver anuncio (+1)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.proBtn}
              onPress={handleUpgrade}
              activeOpacity={0.8}
            >
              <Icon name="crown" size={18} color={colors.textOnPrimary} />
              <Text style={styles.proBtnText}>VitalPulse Pro</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ───── Last measurement card (~130px) ───── */}
        {last ? (
          <View style={styles.lastGlass}>
            {/* Card header */}
            <View style={styles.lastHeader}>
              <View style={styles.lastLabelRow}>
                <View style={styles.lastDot} />
                <Text style={styles.lastLabel}>Ultima medicion</Text>
              </View>
              <Text style={styles.lastDate}>
                {new Date(last.timestamp).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            {/* Metrics row: BPM + BP side by side, no divider */}
            <View style={styles.metricsRow}>
              {/* ── BPM ── */}
              <View style={styles.metricBlock}>
                <Text style={[styles.metricValue, { color: classifyBPM(last.bpm).color }]}>
                  {last.bpm}
                </Text>
                <Text style={styles.metricUnit}>BPM</Text>
                <View
                  style={[
                    styles.classBadge,
                    { backgroundColor: classifyBPM(last.bpm).color + (isDark ? '25' : '15') },
                  ]}
                >
                  <View
                    style={[styles.classDot, { backgroundColor: classifyBPM(last.bpm).color }]}
                  />
                  <Text style={[styles.classText, { color: classifyBPM(last.bpm).color }]}>
                    {classifyBPM(last.bpm).label}
                  </Text>
                </View>
              </View>

              {/* ── BP ── */}
              {last.bp && (
                <View style={styles.metricBlock}>
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
                      styles.classBadge,
                      {
                        backgroundColor:
                          classifyBP(last.bp.systolic, last.bp.diastolic).color + (isDark ? '25' : '15'),
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.classDot,
                        {
                          backgroundColor: classifyBP(last.bp.systolic, last.bp.diastolic).color,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.classText,
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
          <View style={styles.emptyGlass}>
            <View style={styles.emptyIconWrap}>
              <Icon name="heart" size={22} color={colors.primary} />
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

        {/* ───── Stats row (~75px): 3 compact glass cards ───── */}
        {history.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statGlass}>
              <Text style={styles.statValue}>{history.length}</Text>
              <Text style={styles.statLabel}>Mediciones</Text>
            </View>
            <View style={styles.statGlass}>
              <Text style={styles.statValue}>{avgBPM}</Text>
              <Text style={styles.statLabel}>BPM medio</Text>
            </View>
            <View style={styles.statGlass}>
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
          <Icon name="controller-classic" size={18} color={colors.primary} />
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

// ─── Dynamic styles factory — glassmorphism compact ───────────────────────────
function createStyles(colors, isDark) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      padding: 16,
      paddingBottom: 32,
    },

    // ── Hero Section (~90px) ──
    heroGlass: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      marginBottom: 14,
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroLogo: {
      width: 40,
      height: 40,
      borderRadius: 12,
    },
    heroLogoFallback: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroLogoFallbackText: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.primary,
    },
    heroTextCol: {
      marginLeft: 14,
      flex: 1,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: '#38BDF8',
      letterSpacing: -0.4,
      ...Platform.select({
        ios: {
          textShadowColor: 'rgba(56, 189, 248, 0.25)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 6,
        },
        android: {
          textShadowColor: 'rgba(56, 189, 248, 0.25)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 6,
        },
      }),
    },
    heroSub: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
      letterSpacing: 0.3,
      marginTop: 1,
    },

    // ── Remaining pill ──
    remainingPill: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primarySubtle,
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 20,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.primary + (isDark ? '20' : '15'),
    },
    remainingText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.2,
    },

    // ── CTA Measurement Card (~120px) ──
    measureGlass: {
      backgroundColor: colors.bgCard,
      borderRadius: 20,
      marginBottom: 14,
      flexDirection: 'row',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#38BDF8',
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
      width: 3,
      backgroundColor: '#38BDF8',
      borderTopLeftRadius: 20,
      borderBottomLeftRadius: 20,
    },
    measureContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 12,
    },
    measureTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.3,
      marginBottom: 2,
      marginTop: 6,
    },
    measureSub: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500',
    },
    measureChevron: {
      justifyContent: 'center',
      paddingRight: 12,
    },
    chevronText: {
      fontSize: 20,
      color: colors.textMuted,
      fontWeight: '300',
    },

    // ── Limit reached buttons ──
    limitRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14,
    },
    watchAdBtn: {
      flex: 1,
      backgroundColor: isDark ? '#422006' : colors.warningLight,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.warning + '30',
      flexDirection: 'row',
      gap: 5,
    },
    watchAdBtnText: {
      color: isDark ? '#FDE68A' : '#92400E',
      fontSize: 12,
      fontWeight: '700',
    },
    proBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    proBtnText: {
      color: colors.textOnPrimary,
      fontSize: 12,
      fontWeight: '800',
    },

    // ── Last measurement card (~130px) ──
    lastGlass: {
      backgroundColor: colors.bgCard,
      borderRadius: 20,
      padding: 14,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.1,
          shadowRadius: 20,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    lastHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    lastLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    lastDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.success,
    },
    lastLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    lastDate: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    metricsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-start',
      gap: 8,
    },
    metricBlock: {
      alignItems: 'center',
      flex: 1,
    },
    metricValue: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.8,
      lineHeight: 32,
    },
    bpValue: {
      fontSize: 22,
      letterSpacing: -0.4,
      lineHeight: 26,
    },
    metricUnit: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
      letterSpacing: 0.3,
      marginTop: 1,
    },
    classBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      marginTop: 6,
    },
    classDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
    classText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.2,
    },

    // ── Empty state ──
    emptyGlass: {
      backgroundColor: colors.bgCard,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    emptyIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + (isDark ? '15' : '8'),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 6,
      letterSpacing: -0.3,
    },
    emptySub: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 14,
      paddingHorizontal: 8,
    },
    emptyCta: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 24,
    },
    emptyCtaText: {
      color: colors.textOnPrimary,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.2,
    },

    // ── Stats row (~75px) ──
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14,
      gap: 10,
    },
    statGlass: {
      flex: 1,
      backgroundColor: colors.bgCard,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
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
    statValue: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.primary,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.3,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // ── Tutorial button ──
    tutorialBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginBottom: 12,
      backgroundColor: colors.bgCard,
      borderRadius: 14,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
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
    tutorialBtnText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
    tutorialChevron: {
      fontSize: 18,
      color: colors.textMuted,
      fontWeight: '300',
    },
  });
}
