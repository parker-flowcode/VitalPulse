/**
 * LegalDisclaimer.js — VitalPulse v5.0
 *
 * Aviso legal sanitario: indica que la app no es un dispositivo medico certificado.
 * Siempre debe aparecer ANTES de BannerAd en el orden JSX de cada pantalla.
 * Usa el sistema de temas para todos los estilos.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

/**
 * LegalDisclaimer
 *
 * @param {object}  props
 * @param {boolean} props.compact - Versión compacta (una linea, sin icono)
 */
export default function LegalDisclaimer({ compact = false }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  if (compact) {
    return (
      <Text style={styles.compactText}>
        {'⚕️ Esta app no es un dispositivo medico certificado. Consulte a un profesional.'}
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{'⚕️'}</Text>
      <Text style={styles.text}>
        {'Esta aplicacion no es un dispositivo medico certificado. Consulte siempre a un profesional de la salud.'}
      </Text>
    </View>
  );
}

// ─── Dynamic styles factory ─────────────────────────────────────────────────────
function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.bg,
      borderRadius: 10,
      padding: 12,
      marginVertical: 8,
      alignItems: 'flex-start',
      borderLeftWidth: 3,
      borderLeftColor: colors.danger,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopColor: colors.border,
      borderRightColor: colors.border,
      borderBottomColor: colors.border,
    },
    icon: {
      fontSize: 16,
      marginRight: 8,
      marginTop: 1,
    },
    text: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    compactText: {
      color: colors.danger,
      fontSize: 11,
      textAlign: 'center',
      opacity: 0.8,
      marginVertical: 4,
    },
  });
}
