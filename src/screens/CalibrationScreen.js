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
          morphology: measurement.morphology,
          bpm: measurement.bpm,
          sdnn: measurement.sdnn,
        }
      : {};
    await addCalibrationPoint({ realSystolic: sys, realDiastolic: dia, ...extra });
    Alert.alert('✅ Calibración guardada', 'El punto de calibración se ha añadido.');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Calibración manual</Text>
        <Text style={styles.label}>Presión sistólica (mmHg)</Text>
        <TextInput
          style={styles.input}
          value={systolic}
          onChangeText={setSystolic}
          keyboardType="number-pad"
          placeholder="120"
          placeholderTextColor="#4A6A67"
        />
        <Text style={styles.label}>Presión diastólica (mmHg)</Text>
        <TextInput
          style={styles.input}
          value={diastolic}
          onChangeText={setDiastolic}
          keyboardType="number-pad"
          placeholder="80"
          placeholderTextColor="#4A6A67"
        />
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Guardar punto de calibración</Text>
        </TouchableOpacity>
        {calibration?.points?.length > 0 && (
          <Text style={styles.info}>Puntos guardados: {calibration.points.length}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D1918' },
  container: { padding: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 16 },
  label: { color: '#8BBAB5', fontSize: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#132220',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#1A7F6E33',
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: '#1A7F6E',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  info: { color: '#8BBAB5', fontSize: 13, marginTop: 12, textAlign: 'center' },
});