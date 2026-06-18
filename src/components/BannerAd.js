/**
 * BannerAd.js — VitalPulse
 *
 * Componente placeholder para banner de AdMob.
 * Cuando ADS_CONFIG.enabled = false, muestra un placeholder sutil.
 * Cuando se activa, renderiza el banner real de react-native-google-mobile-ads.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { shouldShowBanner } from '../services/ads';

export default function BannerAd({ compact = false }) {
  if (!shouldShowBanner()) {
    // Placeholder: solo visible en desarrollo como indicación de posición
    if (__DEV__) {
      return (
        <View style={[styles.placeholder, compact && styles.placeholderCompact]}>
          <Text style={styles.placeholderText}>
            {compact ? '' : '📢 Espacio para anuncio'}
          </Text>
        </View>
      );
    }
    return null;
  }

  // Aquí se renderizaría el banner real de AdMob
  // import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
  // return (
  //   <BannerAd
  //     size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
  //     unitId={ADS_CONFIG.admob.banner}
  //   />
  // );

  return (
    <View style={styles.realBanner}>
      <Text style={styles.realBannerText}>📢 Anuncio</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#132220',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A7F6E22',
    borderStyle: 'dashed',
  },
  placeholderCompact: {
    padding: 6,
    marginVertical: 4,
  },
  placeholderText: {
    color: '#2A4A47',
    fontSize: 11,
    fontWeight: '500',
  },
  realBanner: {
    backgroundColor: '#132220',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    alignItems: 'center',
  },
  realBannerText: {
    color: '#4A6A67',
    fontSize: 12,
  },
});