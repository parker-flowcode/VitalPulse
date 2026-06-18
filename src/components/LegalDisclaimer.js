import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function LegalDisclaimer({ compact = false }) {
  if (compact) {
    return (
      <Text style={styles.compactText}>
        ⚠️ Esta app no es un dispositivo médico. Consulte a su médico.
      </Text>
    );
  }
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚕️</Text>
      <Text style={styles.text}>
        Esta aplicación no es un dispositivo médico certificado y no sustituye
        el diagnóstico ni el seguimiento clínico profesional. Los valores
        mostrados son orientativos. Consulte siempre a su médico.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(242, 92, 84, 0.12)',
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
    alignItems: 'flex-start',
    borderLeftWidth: 3,
    borderLeftColor: '#F25C54',
  },
  icon: { fontSize: 16, marginRight: 8, marginTop: 1 },
  text: { flex: 1, color: '#F25C54', fontSize: 12, lineHeight: 18 },
  compactText: {
    color: '#F25C54',
    fontSize: 11,
    textAlign: 'center',
    opacity: 0.8,
    marginVertical: 4,
  },
});