/**
 * BannerAd.js — VitalPulse v5.0
 *
 * Banner de anuncio inferior no intrusivo.
 * Usa el banner real de react-native-google-mobile-ads.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BannerAd as AdMobBanner, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { shouldShowBanner, getBannerUnitId } from '../services/ads';
import { useTheme } from '../theme/ThemeContext';

const TEST_BANNER_ID = Platform.OS === 'ios'
  ? TestIds.BANNER
  : 'ca-app-pub-3940256099942544/6300978111';

export default function BannerAd({ compact = false }) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      alignItems: 'center',
      backgroundColor: colors.bg,
      borderRadius: 10,
      marginVertical: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    compactContainer: {
      backgroundColor: colors.bgCard,
      borderRadius: 8,
      marginVertical: 4,
      paddingVertical: 6,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    compactText: {
      fontSize: 11,
      color: colors.textMuted,
    },
  }), [colors]);

  if (!shouldShowBanner()) return null;

  const adUnitId = __DEV__ ? TEST_BANNER_ID : getBannerUnitId();

  if (__DEV__ && compact) {
    return (
      <View style={styles.compactContainer}>
        <Text style={styles.compactText}>📢</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdMobBanner
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        unitId={adUnitId}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
      />
    </View>
  );
}
