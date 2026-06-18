import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { classifyBPM, classifyBP, analyzeHRV } from '../utils/bpEstimator';
import LegalDisclaimer from '../components/LegalDisclaimer';
import { shareMeasurementSummary } from '../services/exportService';
import useHealthStore from '../store/healthstore';

export default function ResultsScreen({ navigation, route }) {
  const { addCalibrationPoint } = useHealthStore();
  // La pantalla ya recibe la medición completa; la calibración guiada se maneja en una pantalla separada.

  if (!route?.params?.measurement) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Error: no hay datos de medición.</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('HomeMain')}
          >
            <Text style={styles.primaryBtnText}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { measurement } = route.params;
  const { bpm, bpmFFT, bpmPeaks, bp, quality, confidence, rrIntervals, sdnn, snr, saturated, stability } = measurement;

  const bpmClass = classifyBPM(bpm);
  const bpClass  = bp ? classifyBP(bp.systolic, bp.diastolic) : null;
  const hrv      = analyzeHRV(rrIntervals, sdnn);

  const qualityPercent    = Math.round((quality    || 0) * 100);
  const confidencePercent = Math.round((confidence || 0) * 100);

  const handleSaveCalibration = async () => {
    const sys = parseInt(realSystolic, 10);
    const dia = parseInt(realDiastolic, 10);

    if (isNaN(sys) || isNaN(dia) || sys < 80 || sys > 200 || dia < 50 || dia > 130) {
      Alert.alert('Valores inválidos', 'Introduce valores válidos de tu tensiómetro.\nSistólica: 80–200 · Diastólica: 50–130');
      return;
    }

    await addCalibrationPoint({
      realSystolic: sys,
      realDiastolic: dia,
      morphology:   measurement.bp?.morphology || measurement.morphology,
      bpm:          measurement.bpm,
      sdnn:         measurement.sdnn || 0,
    });

    Alert.alert(
      '✅ Calibración guardada',
      'Las próximas mediciones usarán este punto de referencia para mayor precisión.'
    );
    setShowCalibration(false);
    setRealSystolic('');
    setRealDiastolic('');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Disclaimer médico destacado */}
          <View style={styles.medicalDisclaimer}>
            <Text style={styles.medicalDisclaimerIcon}>⚕️</Text>
            <View style={styles.medicalDisclaimerTextWrap}>
              <Text style={styles.medicalDisclaimerTitle}>
                AVISO IMPORTANTE
              </Text>
              <Text style={styles.medicalDisclaimerBody}>
                Esta aplicación NO es un dispositivo médico certificado por la FDA ni la EMA.
                Los valores mostrados son estimaciones orientativas. Consulte siempre a su
                médico para diagnóstico o tratamiento.
              </Text>
            </View>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Resultados</Text>
            <Text style={styles.date}>
              {new Date().toLocaleString('es-ES', {
                weekday: 'long', day: '2-digit',
                month: 'long', hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          </View>

          {/* BPM */}
          <View style={[styles.resultCard, { borderColor: bpmClass.color + '44' }]}>
            <Text style={styles.cardLabel}>FRECUENCIA CARDÍACA</Text>
            <Text style={[styles.bigValue, { color: bpmClass.color }]}>{bpm}</Text>
            <Text style={styles.bigUnit}>pulsaciones por minuto</Text>
            <View style={[styles.badge, { backgroundColor: bpmClass.color + '22' }]}>
              <Text style={[styles.badgeText, { color: bpmClass.color }]}>{bpmClass.label}</Text>
            </View>
            <Text style={styles.rangeText}>Normal en reposo: 60–100 BPM</Text>
            {/* Detalle de los dos métodos de cálculo */}
            {bpmFFT > 0 && bpmPeaks > 0 && (
              <View style={styles.methodDetail}>
                <Text style={styles.methodText}>FFT: {bpmFFT} BPM</Text>
                <Text style={styles.methodDivider}>·</Text>
                <Text style={styles.methodText}>Picos: {bpmPeaks} BPM</Text>
                <Text style={styles.methodDivider}>·</Text>
                <Text style={[styles.methodText, { color: Math.abs(bpmFFT - bpmPeaks) <= 5 ? '#2BBFA4' : '#FFA500' }]}>
                  {Math.abs(bpmFFT - bpmPeaks) <= 5 ? 'Consenso alto' : 'Consenso bajo'}
                </Text>
              </View>
            )}
          </View>

          {/* PA */}
          {bp && bpClass && (
            <View style={[styles.resultCard, { borderColor: bpClass.color + '44' }]}>
              <Text style={styles.cardLabel}>PRESIÓN ARTERIAL ESTIMADA</Text>
              {!bp.isCalibrated && (
                <View style={styles.calibrationWarning}>
                  <Text style={styles.calibrationWarningText}>
                    ⚡ Sin calibración — precisión orientativa
                  </Text>
                </View>
              )}
              {bp.isCalibrated && (
                <View style={styles.calibrationOk}>
                  <Text style={styles.calibrationOkText}>
                    ✅ Calibrado con {bp.calibrationPoints} punto{bp.calibrationPoints > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
              {bp.isCalibrated && (
                <Text style={styles.calibrationMethodText}>
                  Método: {bp.calibrationMethod === 'regression' ? 'Regresión' : 'Offset'}
                </Text>
              )}
              <Text style={[styles.bigValue, { color: bpClass.color, fontSize: 48 }]}>
                {bp.systolic}/{bp.diastolic}
              </Text>
              <Text style={styles.bigUnit}>mmHg (sistólica/diastólica)</Text>
              <View style={[styles.badge, { backgroundColor: bpClass.color + '22' }]}>
                <Text style={[styles.badgeText, { color: bpClass.color }]}>{bpClass.label}</Text>
              </View>
              <Text style={styles.rangeText}>Óptima: {'<'}120/80 mmHg</Text>
            </View>
          )}

          {/* HRV */}
          {sdnn > 0 && (
            <View style={styles.resultCard}>
              <Text style={styles.cardLabel}>VARIABILIDAD CARDÍACA (HRV)</Text>
              <View style={styles.hrvRow}>
                <View style={styles.hrvItem}>
                  <Text style={[styles.hrvValue, { color: hrv.color }]}>
                    {Math.round(sdnn)} ms
                  </Text>
                  <Text style={styles.hrvLabel}>SDNN</Text>
                </View>
                <View style={styles.hrvDivider} />
                <View style={styles.hrvItem}>
                  <Text style={[styles.hrvValue, { color: hrv.color }]}>
                    {rrIntervals?.length || 0}
                  </Text>
                  <Text style={styles.hrvLabel}>Latidos</Text>
                </View>
                <View style={styles.hrvDivider} />
                <View style={styles.hrvItem}>
                  <Text style={[styles.hrvValue, { color: hrv.color, fontSize: 14 }]}>
                    {hrv.label}
                  </Text>
                  <Text style={styles.hrvLabel}>Estado</Text>
                </View>
              </View>
              <Text style={styles.rangeText}>
                HRV normal: 50–100 ms · Mayor HRV = mejor salud cardiovascular
              </Text>
            </View>
          )}

          {/* Calidad de medición */}
          <View style={styles.qualityCard}>
            <Text style={styles.cardLabel}>CALIDAD DE MEDICIÓN</Text>
        <View style={styles.qualityRow}>
          {[
            { v: qualityPercent + '%',    l: 'Señal' },
            { v: confidencePercent + '%', l: 'Confianza' },
            { v: measurement.signalLength || 0, l: 'Frames' },
            { v: snr ? snr.toFixed(1) + ' dB' : 'N/A', l: 'SNR' },
            { v: (stability * 100).toFixed(0) + '%', l: 'Estabilidad' },
            { v: saturated ? 'Sí' : 'No', l: 'Saturada' },
          ].map((item, i) => (
            <View key={i} style={styles.qualityItem}>
              <Text style={styles.qualityValue}>{item.v}</Text>
              <Text style={styles.qualityItemLabel}>{item.l}</Text>
            </View>
          ))}
        </View>
            {qualityPercent < 50 && (
              <Text style={styles.qualityWarn}>
                ⚠️ Calidad baja. Cubre mejor la cámara y mantén el dedo quieto.
              </Text>
            )}
          </View>

          {/* Compartir */}
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => shareMeasurementSummary(measurement)}
          >
            <Text style={styles.shareBtnText}>
              📤 Compartir resultado
            </Text>
          </TouchableOpacity>

          {/* Calibración */}
          {/* Botón para iniciar la calibración guiada en pantalla separada */}
          <TouchableOpacity
            style={styles.calibrateBtn}
            onPress={() => navigation.navigate('Calibration', { measurement })}
          >
            <Text style={styles.calibrateBtnText}>
              📏 Tengo un tensiómetro — calibrar para mayor precisión
            </Text>
          </TouchableOpacity>

          <LegalDisclaimer />

          {/* Acciones */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('Measure')}
            >
              <Text style={styles.secondaryBtnText}>Nueva medición</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('HomeMain')}
            >
              <Text style={styles.primaryBtnText}>Inicio</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#0D1918' },
  scroll:  { padding: 20, paddingBottom: 40 },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#F25C54', fontSize: 16, marginBottom: 24, textAlign: 'center' },
  header:  { marginBottom: 24 },
  title:   { color: '#fff', fontSize: 26, fontWeight: '700' },
  date:    { color: '#4A6A67', fontSize: 13, marginTop: 4, textTransform: 'capitalize' },

  resultCard: {
    backgroundColor: '#132220', borderRadius: 20,
    padding: 24, marginBottom: 16,
    borderWidth: 1, alignItems: 'center',
    borderColor: '#1A7F6E22',
  },
  cardLabel: {
    color: '#4A6A67', fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16,
  },
  bigValue: {
    fontSize: 72, fontWeight: '800',
    fontVariant: ['tabular-nums'], lineHeight: 76,
  },
  bigUnit:  { color: '#4A6A67', fontSize: 13, marginTop: 6, marginBottom: 12 },
  badge:    { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, marginBottom: 10, borderWidth: 1 },
  badgeText:{ fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  rangeText:{ color: '#3A5A57', fontSize: 12, textAlign: 'center' },

  methodDetail: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  methodText:   { color: '#4A6A67', fontSize: 12 },
  methodDivider:{ color: '#2A4A47', fontSize: 12 },

  calibrationWarning: { backgroundColor: '#FFA50022', borderRadius: 8, padding: 8, marginBottom: 12, width: '100%' },
  calibrationWarningText: { color: '#FFA500', fontSize: 12, textAlign: 'center' },
  calibrationOk:  { backgroundColor: '#2BBFA422', borderRadius: 8, padding: 8, marginBottom: 12, width: '100%' },
  calibrationOkText: { color: '#2BBFA4', fontSize: 12, textAlign: 'center' },

  // Calibration method label (Regresión / Offset)
  calibrationMethodText: { color: '#fff', fontSize: 14, marginTop: 4, textAlign: 'center' },

  // HRV
  hrvRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 12, width: '100%' },
  hrvItem:   { flex: 1, alignItems: 'center' },
  hrvValue:  { fontSize: 22, fontWeight: '700', color: '#2BBFA4' },
  hrvLabel:  { color: '#4A6A67', fontSize: 12, marginTop: 4 },
  hrvDivider:{ width: 1, height: 40, backgroundColor: '#1A7F6E33' },

  // Calidad
  qualityCard: {
    backgroundColor: '#132220', borderRadius: 16,
    padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#1A7F6E22',
  },
  qualityRow:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 8 },
  qualityItem:     { width: '31%', alignItems: 'center', marginBottom: 12 },
  qualityValue:    { color: '#2BBFA4', fontSize: 24, fontWeight: '700' },
  qualityItemLabel:{ color: '#4A6A67', fontSize: 12, marginTop: 4 },
  // qualityDivider is retained for compatibility but not used in the new grid layout
  qualityDivider:  { width: 1, height: 40, backgroundColor: '#1A7F6E33' },
  qualityWarn:     { color: '#FFA500', fontSize: 12, marginTop: 12, textAlign: 'center' },

  // Calibración
  calibrateBtn: {
    backgroundColor: '#1A7F6E22', borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: '#1A7F6E66', alignItems: 'center',
  },
  calibrateBtnText: { color: '#2BBFA4', fontSize: 14, fontWeight: '600' },
  calibrationForm: {
    backgroundColor: '#132220', borderRadius: 16,
    padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#1A7F6E44',
  },
  calibrationFormTitle:    { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  calibrationFormSubtitle: { color: '#4A6A67', fontSize: 13, marginBottom: 16, lineHeight: 20 },
  bpInputRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 },
  bpInputGroup: { flex: 1 },
  inputLabel:   { color: '#8BBAB5', fontSize: 12, marginBottom: 6 },
  calInput:     { backgroundColor: '#0D1918', borderRadius: 10, padding: 12, color: '#fff', fontSize: 18, textAlign: 'center', borderWidth: 1, borderColor: '#1A7F6E44' },
  slash:        { color: '#4A6A67', fontSize: 28, fontWeight: '300', marginBottom: 12 },
  calBtnRow:    { flexDirection: 'row', gap: 12 },
  calCancelBtn: { flex: 1, backgroundColor: 'transparent', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2A4A47' },
  calCancelBtnText: { color: '#4A6A67', fontSize: 15 },
  calSaveBtn:   { flex: 1, backgroundColor: '#1A7F6E', borderRadius: 12, padding: 14, alignItems: 'center' },
  calSaveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Disclaimer médico
  medicalDisclaimer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(242, 92, 84, 0.12)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F25C54',
    alignItems: 'flex-start',
    gap: 10,
  },
  medicalDisclaimerIcon: { fontSize: 20, marginTop: 1 },
  medicalDisclaimerTextWrap: { flex: 1 },
  medicalDisclaimerTitle: {
    color: '#F25C54',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  medicalDisclaimerBody: {
    color: '#F25C54',
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.85,
  },

  // Compartir
  shareBtn: {
    backgroundColor: '#132220', borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#1A7F6E66',
    alignItems: 'center',
  },
  shareBtnText: { color: '#8BBAB5', fontSize: 14, fontWeight: '600' },

  // Acciones
  actionsRow:     { flexDirection: 'row', gap: 12, marginTop: 8 },
  secondaryBtn:   { flex: 1, backgroundColor: 'transparent', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1A7F6E66' },
  secondaryBtnText: { color: '#2BBFA4', fontSize: 15, fontWeight: '600' },
  primaryBtn:     { flex: 1, backgroundColor: '#1A7F6E', borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
