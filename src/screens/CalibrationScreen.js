/**
 * CalibrationScreen.js — VitalPulse v5.0
 *
 * Pantalla para que el usuario introduzca una medición real de presión arterial
 * y la asocie a la última medición de PPG, creando un punto de calibración.
 * Soporta tema dinámico mediante ThemeContext.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import useHealthStore from '../store/healthstore';
import { SPACING, RADIUS } from '../theme/designTokens';

export default function CalibrationScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { addCalibrationPoint, calibration } = useHealthStore();
  // La pantalla puede recibir la medición reciente para asociar datos de morfología y BPM
  const measurement = route?.params?.measurement || null;
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');

  const handleSave = async () => {
    const sys = parseInt(systolic, 10);
    const dia = parseInt(diastolic, 10);
    if (isNaN(sys) || isNaN(dia) || sys < 50 || sys > 250 || dia < 30 || dia > 150) {
      Alert.alert('Valores inválidos', 'Introduce valores de presión arterial reales y dentro de rangos razonables.');
      return;
    }
    // Si disponemos de la medición original, incluimos sus datos para la calibración multi‑punto
    const extra = measurement
      ? {
          morphology: measurement.bp?.morphology || measurement.morphology,
          bpm: measurement.bpm,
          sdnn: measurement.sdnn,
        }
      : {};
    await addCalibrationPoint({ realSystolic: sys, realDiastolic: dia, ...extra });
    Alert.alert('Calibración guardada', 'El punto de calibración se ha añadido.');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Calibración manual</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Introduce los valores de tu tensiómetro real para mejorar la precisión.
        </Text>
        <Text style={[styles.label, { color: colors.primary }]}>Presión sistólica (mmHg)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.border }]}
          value={systolic}
          onChangeText={setSystolic}
          keyboardType="number-pad"
          placeholder="120"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={[styles.label, { color: colors.primary }]}>Presión diastólica (mmHg)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.border }]}
          value={diastolic}
          onChangeText={setDiastolic}
          keyboardType="number-pad"
          placeholder="80"
          placeholderTextColor={colors.textMuted}
        />
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
          <Text style={[styles.saveBtnText, { color: colors.textOnPrimary }]}>Guardar punto de calibración</Text>
        </TouchableOpacity>
        {calibration?.points?.length > 0 && (
          <View style={[styles.infoCard, { backgroundColor: colors.primarySubtle, borderColor: colors.primaryMuted }]}>
            <Text style={styles.infoIcon}>📏</Text>
            <Text style={[styles.infoText, { color: colors.primary }]}>Puntos guardados: {calibration.points.length}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles factory ────────────────────────────────────────────────────────────
const createStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 24 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 24 },
  label: { color: colors.primary, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 14,
    color: colors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '600' },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySubtle,
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    gap: 10,
  },
  infoIcon: { fontSize: 18 },
  infoText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
});
