/**
 * BottomWarningAdWrapper.js — VitalPulse
 *
 * Wrapper premium que contiene el aviso médico + banner AdMob.
 * Unifica márgenes, radio de borde, espaciado y estilo en todas las pantallas.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import LegalDisclaimer from './LegalDisclaimer';
import BannerAd from './BannerAd';

export default function BottomWarningAdWrapper({ compactAd = false }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.outer, { borderTopColor: colors.divider }]}>
      <LegalDisclaimer />
      <View style={styles.adContainer}>
        <BannerAd compact={compactAd} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  adContainer: {
    marginTop: 6,
    alignItems: 'center',
    borderRadius: 10,
    overflow: 'hidden',
  },
});
