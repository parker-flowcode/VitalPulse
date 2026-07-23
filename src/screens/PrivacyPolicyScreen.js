/**
 * PrivacyPolicyScreen.js — VitalPulse
 *
 * Pantalla que muestra la política de privacidad de la aplicación.
 * El contenido está escrito en español y cubre los requisitos de Google Play
 * para apps de salud que no envían datos a servidores externos.
 */
import React from 'react';
import { SafeAreaView, ScrollView, Text, StyleSheet } from 'react-native';

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Política de Privacidad</Text>
        <Text style={styles.paragraph}>
          VitalPulse no recopila, almacena ni transmite datos personales a servidores externos.
          Todos los datos (señal PPG, perfil del usuario, calibraciones y resultados) se guardan
          localmente en el dispositivo mediante AsyncStorage y están cifrados mediante el propio
          sistema de almacenamiento del SO. No se realizan llamadas a APIs externas ni se comparte
          información con terceros.
        </Text>
        <Text style={styles.paragraph}>
          La aplicación utiliza la cámara del móvil y el flash para medir la frecuencia cardíaca
          y estimar la presión arterial mediante fotopletismografía (PPG). No se recopilan datos de
          ubicación, contactos ni identificadores de dispositivo.
        </Text>
        <Text style={styles.paragraph}>
          Al usar la aplicación aceptas que los datos se almacenen únicamente en tu dispositivo y
          que la app no constituye un dispositivo médico certificado. Siempre consulta a un profesional
          de la salud para diagnóstico o tratamiento.
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
