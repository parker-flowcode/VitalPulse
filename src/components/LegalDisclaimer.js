/**
 * LegalDisclaimer.js — VitalPulse v5.0
 *
 * Aviso legal sanitario: indica que la app no es un dispositivo medico certificado.
 * Siempre debe aparecer ANTES de BannerAd en el orden JSX de cada pantalla.
 * Usa el sistema de temas para todos los estilos.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
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
      <View style={styles.compactRow}>
        <Icon name="medical-cross" size={11} color={colors.danger} style={styles.compactIcon} />
        <Text style={styles.compactText}>
          {'No sustituye el criterio medico. Consulte a un profesional.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Icon name="medical-cross" size={16} color={colors.danger} style={styles.icon} />
      <Text style={styles.text}>
        {'No es un dispositivo medico certificado. Consulte a un profesional de la salud.'}
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
      marginRight: 8,
      marginTop: 1,
    },
    text: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    compactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 4,
    },
    compactIcon: {
      marginRight: 4,
    },
    compactText: {
      color: colors.danger,
      fontSize: 11,
      textAlign: 'center',
      opacity: 0.8,
    },
  });
}
