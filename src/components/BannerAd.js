/**
 * BannerAd.js — VitalPulse
 *
 * Banner de anuncio inferior no intrusivo.
 * Usa el banner real de react-native-google-mobile-ads.
 *
 * Diseño: compacto, fondo blanco minimalista.
 */
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BannerAd as AdMobBanner, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { shouldShowBanner, getBannerUnitId } from '../services/ads';
import { COLORS } from '../theme/designTokens';

// ID de prueba de Google (visible en dispositivos de test)
const TEST_BANNER_ID = Platform.OS === 'ios'
  ? TestIds.BANNER
  : 'ca-app-pub-3940256099942544/6300978111';

export default function BannerAd({ compact = false }) {
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

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    marginVertical: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  compactContainer: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 8,
    marginVertical: 4,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  compactText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
