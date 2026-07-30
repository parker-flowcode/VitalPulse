/**
 * BottomWarningAdWrapper.js — VitalPulse
 *
 * Wrapper reutilizable que contiene el aviso médico legal y el banner de AdMob.
 * Unifica márgenes, centrado y radio de borde en todas las pantallas.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import LegalDisclaimer from './LegalDisclaimer';
import BannerAd from './BannerAd';

export default function BottomWarningAdWrapper({ compactAd = false }) {
  return (
    <View style={styles.wrapper}>
      <LegalDisclaimer />
      <BannerAd compact={compactAd} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    alignItems: 'center',
  },
});
