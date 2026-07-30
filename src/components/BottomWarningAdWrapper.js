/**
 * BottomWarningAdWrapper.js — VitalPulse
 *
 * Mismo layout que el footer de Historial, aplicado a todas las pantallas.
 * LegalDisclaimer completo + BannerAd compacto con padding consistente.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import LegalDisclaimer from './LegalDisclaimer';
import BannerAd from './BannerAd';

export default function BottomWarningAdWrapper() {
  return (
    <View style={styles.footer}>
      <LegalDisclaimer />
      <BannerAd compact />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
});
