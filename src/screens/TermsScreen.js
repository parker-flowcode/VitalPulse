/**
 * TermsScreen.js — VitalPulse v5.0
 *
 * Pantalla que muestra los Términos de Uso de la aplicación.
 * Cumple con los requisitos de Google Play para apps de salud.
 * Soporta tema dinámico mediante ThemeContext.
 */
import React, { useMemo } from 'react';
import { SafeAreaView, ScrollView, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { SPACING } from '../theme/designTokens';

export default function TermsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Términos de Uso</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          VitalPulse es una herramienta de seguimiento personal de la frecuencia cardíaca y la presión arterial.
          No está certificada como dispositivo médico y no sustituye la valoración profesional de un médico.
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Al utilizar la aplicación aceptas que los datos se almacenan localmente y que la app no recopila
          información personal ni la envía a servidores externos. La precisión de las mediciones depende
          de la correcta colocación del dedo y de la calidad de la señal PPG.
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          La empresa no se hace responsable de diagnósticos erróneos o decisiones médicas basadas en los
          resultados de la app. Siempre consulta a un profesional de la salud para cualquier duda o
          condición médica.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles factory ────────────────────────────────────────────────────────────
const createStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 24 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 16 },
  paragraph: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 12 },
});
