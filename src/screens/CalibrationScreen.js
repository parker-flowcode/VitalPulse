/**
 * CalibrationScreen.js — VitalPulse
 *
 * Pantalla para que el usuario introduzca una medición real de presión arterial
 * y la asocie a la última medición de PPG, creando un punto de calibración.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useHealthStore from '../store/healthstore';

export default function CalibrationScreen({ navigation, route }) {
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Calibración manual</Text>
        <Text style={styles.subtitle}>
          Introduce los valores de tu tensiómetro real para mejorar la precisión.
        </Text>
        <Text style={styles.label}>Presión sistólica (mmHg)</Text>
        <TextInput
          style={styles.input}
          value={systolic}
          onChangeText={setSystolic}
          keyboardType="number-pad"
          placeholder="120"
          placeholderTextColor="#94A3B8"
        />
        <Text style={styles.label}>Presión diastólica (mmHg)</Text>
        <TextInput
          style={styles.input}
          value={diastolic}
          onChangeText={setDiastolic}
          keyboardType="number-pad"
          placeholder="80"
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Guardar punto de calibración</Text>
        </TouchableOpacity>
        {calibration?.points?.length > 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>📏</Text>
            <Text style={styles.infoText}>Puntos guardados: {calibration.points.length}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { padding: 24 },
  title: { color: '#1E293B', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#64748B', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  label: { color: '#2563EB', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 14,
    color: '#1E293B',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    gap: 10,
  },
  infoIcon: { fontSize: 18 },
  infoText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
});
