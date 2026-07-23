import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme/designTokens';

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
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
    alignItems: 'flex-start',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopColor: COLORS.border,
    borderRightColor: COLORS.border,
    borderBottomColor: COLORS.border,
  },
  icon: { fontSize: 16, marginRight: 8, marginTop: 1 },
  text: { flex: 1, color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  compactText: {
    color: COLORS.danger,
    fontSize: 11,
    textAlign: 'center',
    opacity: 0.8,
    marginVertical: 4,
  },
});
