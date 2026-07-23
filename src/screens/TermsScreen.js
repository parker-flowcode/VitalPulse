/**
 * TermsScreen.js — VitalPulse
 *
 * Pantalla que muestra los Términos de Uso de la aplicación.
 * Cumple con los requisitos de Google Play para apps de salud.
 */
import React from 'react';
import { SafeAreaView, ScrollView, Text, StyleSheet } from 'react-native';

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Términos de Uso</Text>
        <Text style={styles.paragraph}>
          VitalPulse es una herramienta de seguimiento personal de la frecuencia cardíaca y la presión arterial.
          No está certificada como dispositivo médico y no sustituye la valoración profesional de un médico.
        </Text>
        <Text style={styles.paragraph}>
          Al utilizar la aplicación aceptas que los datos se almacenan localmente y que la app no recopila
          información personal ni la envía a servidores externos. La precisión de las mediciones depende
          de la correcta colocación del dedo y de la calidad de la señal PPG.
        </Text>
        <Text style={styles.paragraph}>
          La empresa no se hace responsable de diagnósticos erróneos o decisiones médicas basadas en los
          resultados de la app. Siempre consulta a un profesional de la salud para cualquier duda o
          condición médica.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { padding: 24 },
  title: { color: '#1E293B', fontSize: 24, fontWeight: '700', marginBottom: 16 },
  paragraph: { color: '#64748B', fontSize: 14, lineHeight: 22, marginBottom: 12 },
});
