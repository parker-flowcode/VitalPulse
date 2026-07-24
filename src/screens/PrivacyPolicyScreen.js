/**
 * PrivacyPolicyScreen.js — VitalPulse v5.0
 *
 * Pantalla que muestra la política de privacidad de la aplicación.
 * El contenido está escrito en español y cubre los requisitos de Google Play
 * para apps de salud que no envían datos a servidores externos.
 * Soporta tema dinámico mediante ThemeContext.
 */
import React, { useMemo } from 'react';
import { SafeAreaView, ScrollView, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { SPACING } from '../theme/designTokens';

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Política de Privacidad</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          VitalPulse no recopila, almacena ni transmite datos personales a servidores externos.
          Todos los datos (señal PPG, perfil del usuario, calibraciones y resultados) se guardan
          localmente en el dispositivo mediante AsyncStorage y están cifrados mediante el propio
          sistema de almacenamiento del SO. No se realizan llamadas a APIs externas ni se comparte
          información con terceros.
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          La aplicación utiliza la cámara del móvil y el flash para medir la frecuencia cardíaca
          y estimar la presión arterial mediante fotopletismografía (PPG). No se recopilan datos de
          ubicación, contactos ni identificadores de dispositivo.
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Al usar la aplicación aceptas que los datos se almacenen únicamente en tu dispositivo y
          que la app no constituye un dispositivo médico certificado. Siempre consulta a un profesional
          de la salud para diagnóstico o tratamiento.
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
