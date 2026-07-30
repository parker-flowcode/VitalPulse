/**
 * BottomWarningAdWrapper.js — VitalPulse
 *
 * Wrapper premium que contiene el aviso medico + banner AdMob.
 * DISENO CONSISTENTE en todas las pantallas:
 *   - LegalDisclaimer version completa (no compacta) para altura uniforme
 *   - BannerAd siempre a ancho completo (no compacto)
 *   - Divider sutil en la parte superior con colors.divider
 *   - Padding horizontal y vertical fijo y uniforme
 *   - Centrado correcto de todos los elementos
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import LegalDisclaimer from './LegalDisclaimer';
import BannerAd from './BannerAd';

export default function BottomWarningAdWrapper() {
  const { colors } = useTheme();

  return (
    <View style={[styles.outer, { borderTopColor: colors.divider }]}>
      <LegalDisclaimer />
      <View style={styles.adContainer}>
        <BannerAd />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  adContainer: {
    marginTop: 8,
    alignItems: 'center',
    width: '100%',
  },
});
