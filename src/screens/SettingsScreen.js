import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useHealthStore from '../store/healthstore';
import LegalDisclaimer from '../components/LegalDisclaimer';
import { useNavigation } from '@react-navigation/native';

export default function SettingsScreen() {
  const {
    userProfile, updateUserProfile,
    calibration, clearCalibration,
    settings, updateSettings,
    history, clearHistory, clearAllData,
  } = useHealthStore();

  const navigation = useNavigation();

  const [name, setName]       = useState(userProfile.name || '');
  const [age, setAge]         = useState(userProfile.age?.toString() || '');
  const [sex, setSex]         = useState(userProfile.sex || null);
  const [weight, setWeight]   = useState(userProfile.weight?.toString() || '');
  const [height, setHeight]   = useState(userProfile.height?.toString() || '');
  const [isActive, setIsActive] = useState(userProfile.isActive || false);
  const [smoker, setSmoker]   = useState(userProfile.smoker || false);
  const [diabetic, setDiabetic] = useState(userProfile.diabetic || false);
  const [alertHigh, setAlertHigh] = useState(settings.alertBPMHigh?.toString() || '100');
  const [alertLow, setAlertLow]   = useState(settings.alertBPMLow?.toString() || '50');
  const [preferRegression, setPreferRegression] = useState(settings.preferRegression ?? true);

  const saveProfile = async () => {
    const parsedAge = age ? parseInt(age, 10) : null;
    if (parsedAge !== null && (isNaN(parsedAge) || parsedAge < 5 || parsedAge > 120)) {
      Alert.alert('Edad inválida', 'Introduce una edad entre 5 y 120 años.'); return;
    }
    await updateUserProfile({
      name: name.trim(), age: parsedAge, sex,
      weight: weight ? parseFloat(weight) : null,
      height: height ? parseFloat(height) : null,
      isActive, smoker, diabetic,
    });
    Alert.alert('✅ Guardado', 'Perfil actualizado. Las próximas mediciones serán más precisas.');
  };

  const saveAlerts = () => {
    const high = parseInt(alertHigh, 10);
    const low  = parseInt(alertLow, 10);
    if (isNaN(high) || isNaN(low) || low >= high) {
      Alert.alert('Inválido', 'El BPM alto debe ser mayor que el BPM bajo.'); return;
    }
    updateSettings({ alertBPMHigh: high, alertBPMLow: low });
    Alert.alert('✅ Guardado', 'Alertas actualizadas.');
  };

  const togglePreferRegression = (value) => {
    setPreferRegression(value);
    updateSettings({ preferRegression: value });
  };

  const handleClearCalibration = () => {
    Alert.alert('Borrar calibración', '¿Eliminar todos los puntos de calibración de PA?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: clearCalibration },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Borrar todos los datos',
      'Se eliminarán mediciones, calibración, perfil y configuración. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar todo', style: 'destructive', onPress: async () => {
          await clearAllData();
          Alert.alert('Datos eliminados', 'Todos los datos han sido borrados.');
        }},
      ]
    );
  };

  const profileComplete = !!(userProfile.age && userProfile.sex && userProfile.isActive !== null);

  const handleExportCSV = async () => {
    if (history.length === 0) {
      Alert.alert('Sin datos', 'No hay mediciones para exportar.');
      return;
    }
    try {
      const { generateCSV, shareCSV, getExportFilename } = require('../services/exportService');
      const csv = generateCSV(history);
      const filename = getExportFilename();
      const success = await shareCSV(csv, filename);
      if (success) {
        Alert.alert('✅ Exportado', `Historial compartido como ${filename}`);
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo exportar el historial.');
    }
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
          <Text style={styles.title}>Ajustes</Text>

          {/* Estado del perfil */}
          <View style={[styles.profileStatus, profileComplete ? styles.profileStatusOk : styles.profileStatusWarn]}>
            <Text style={[styles.profileStatusText, { color: profileComplete ? '#2BBFA4' : '#FFA500' }]}>
              {profileComplete
                ? '✅ Perfil completo — máxima precisión activa'
                : '⚠️ Perfil incompleto — complétalo para mayor precisión'}
            </Text>
          </View>

          {/* Perfil personal */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Perfil personal</Text>

            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName}
              placeholder="Tu nombre" placeholderTextColor="#4A6A67" maxLength={40} />

            <Text style={styles.label}>Edad *</Text>
            <TextInput style={styles.input} value={age} onChangeText={setAge}
              placeholder="Años" placeholderTextColor="#4A6A67" keyboardType="number-pad" maxLength={3} />

            <Text style={styles.label}>Sexo biológico *</Text>
            <View style={styles.optionRow}>
              {[['male','👨 Hombre'],['female','👩 Mujer']].map(([val, label]) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.optionBtn, sex === val && styles.optionBtnActive]}
                  onPress={() => setSex(val)}
                >
                  <Text style={[styles.optionText, sex === val && styles.optionTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.rowFields}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Peso (kg)</Text>
                <TextInput style={styles.input} value={weight} onChangeText={setWeight}
                  placeholder="70" placeholderTextColor="#4A6A67" keyboardType="decimal-pad" maxLength={5} />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Estatura (cm)</Text>
                <TextInput style={styles.input} value={height} onChangeText={setHeight}
                  placeholder="170" placeholderTextColor="#4A6A67" keyboardType="number-pad" maxLength={3} />
              </View>
            </View>

            <Text style={styles.label}>Actividad física *</Text>
            <View style={styles.optionRow}>
              {[[false,'🛋️ Sedentario'],[true,'🏃 Activo']].map(([val, label]) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.optionBtn, isActive === val && styles.optionBtnActive]}
                  onPress={() => setIsActive(val)}
                >
                  <Text style={[styles.optionText, isActive === val && styles.optionTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Factores de salud</Text>
            {[
              [smoker,   setSmoker,   '🚬 Fumador/a'],
              [diabetic, setDiabetic, '💉 Diabetes'],
            ].map(([val, setter, label]) => (
              <TouchableOpacity key={label} style={styles.checkRow} onPress={() => setter(!val)}>
                <View style={[styles.checkbox, val && styles.checkboxActive]}>
                  {val && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkLabel}>{label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
              <Text style={styles.saveBtnText}>Guardar perfil</Text>
            </TouchableOpacity>
          </View>

          {/* Calibración */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Calibración de PA</Text>
            <Text style={styles.sectionDesc}>
              Puedes calibrar la estimación de presión arterial desde la pantalla de resultados
              después de cada medición, introduciendo la lectura de tu tensiómetro real.
            </Text>
            {calibration?.points?.length > 0 ? (
              <>
                <View style={styles.calStatus}>
                  <Text style={styles.calStatusText}>
                    ✅ {calibration.points.length} punto{calibration.points.length > 1 ? 's' : ''} de calibración guardado{calibration.points.length > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.calStatusSub}>
                    Último: {new Date(calibration.points[calibration.points.length - 1].date).toLocaleDateString('es-ES')}
                  </Text>
                </View>
                <TouchableOpacity style={styles.dangerBtnSmall} onPress={handleClearCalibration}>
                  <Text style={styles.dangerBtnSmallText}>Borrar calibración</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.calEmptyText}>
                Sin calibración. Usa el botón en la pantalla de resultados.
              </Text>
            )}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Preferir calibración por regresión</Text>
            <Switch
              value={preferRegression}
              onValueChange={togglePreferRegression}
              trackColor={{ false: '#767577', true: '#2BBFA4' }}
              thumbColor={preferRegression ? '#fff' : '#f4f3f4'}
            />
          </View>
          </View>

          {/* Alertas BPM */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Alertas de BPM</Text>
            <Text style={styles.label}>Alerta BPM alto (por encima de)</Text>
            <TextInput style={styles.input} value={alertHigh} onChangeText={setAlertHigh}
              keyboardType="number-pad" maxLength={3} placeholderTextColor="#4A6A67" />
            <Text style={styles.label}>Alerta BPM bajo (por debajo de)</Text>
            <TextInput style={styles.input} value={alertLow} onChangeText={setAlertLow}
              keyboardType="number-pad" maxLength={3} placeholderTextColor="#4A6A67" />
            <TouchableOpacity style={styles.saveBtn} onPress={saveAlerts}>
              <Text style={styles.saveBtnText}>Guardar alertas</Text>
            </TouchableOpacity>
          </View>

           <LegalDisclaimer />
           <View style={styles.linkRow}>
             <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
               <Text style={styles.linkText}>Política de Privacidad</Text>
             </TouchableOpacity>
             <TouchableOpacity onPress={() => navigation.navigate('Terms')} style={{ marginLeft: 20 }}>
               <Text style={styles.linkText}>Términos de Uso</Text>
             </TouchableOpacity>
           </View>

          {/* Upgrade a Pro */}
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => navigation.navigate('Upgrade')}
          >
            <Text style={styles.upgradeBtnEmoji}>💚</Text>
            <View style={styles.upgradeBtnTextWrap}>
              <Text style={styles.upgradeBtnTitle}>VitalPulse Pro</Text>
              <Text style={styles.upgradeBtnSub}>
                Mediciones ilimitadas · Sin anuncios · Calibración avanzada
              </Text>
            </View>
            <Text style={styles.upgradeBtnArrow}>→</Text>
          </TouchableOpacity>

          {/* Exportar datos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Exportar datos</Text>
            <Text style={styles.sectionDesc}>
              Exporta tu historial completo como archivo CSV compatible con Excel, Google Sheets y otros programas de análisis.
            </Text>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
              <Text style={styles.exportBtnIcon}>📤</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.exportBtnTitle}>Exportar historial como CSV</Text>
                <Text style={styles.exportBtnSub}>{history.length} mediciones · Punto y coma</Text>
              </View>
              <Text style={styles.exportBtnArrow}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Gestión de datos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gestión de datos</Text>
            <Text style={styles.sectionDesc}>
              Todos los datos se guardan únicamente en este dispositivo. Nada se envía a servidores.
            </Text>
            <TouchableOpacity style={styles.dangerBtnSmall} onPress={() => {
              Alert.alert('Borrar historial', '¿Eliminar todas las mediciones?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Borrar', style: 'destructive', onPress: clearHistory },
              ]);
            }}>
              <Text style={styles.dangerBtnSmallText}>🗑️ Borrar historial de mediciones</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dangerBtn, { marginTop: 10 }]} onPress={handleClearAll}>
              <Text style={styles.dangerBtnText}>☢️ Borrar todos los datos y reiniciar app</Text>
            </TouchableOpacity>
          </View>

          {/* Acerca de */}
          <View style={styles.aboutCard}>
            <Text style={styles.aboutTitle}>Acerca de VitalPulse</Text>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Versión</Text>
              <Text style={styles.aboutValue}>4.0.0</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>SDK</Text>
              <Text style={styles.aboutValue}>Expo 54 · React Native 0.81</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Desarrollador</Text>
              <Text style={styles.aboutValue}>PoleyDev</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Licencia</Text>
              <Text style={styles.aboutValue}>MIT</Text>
            </View>
            <Text style={styles.aboutDesc}>
              Monitor cardiovascular personal. Los datos se almacenan exclusivamente en este dispositivo. 
              Esta aplicación NO es un dispositivo médico certificado.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#0D1918' },
  scroll: { padding: 20, paddingBottom: 48 },
  title:  { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 16 },
  profileStatus:     { borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1 },
  profileStatusOk:   { backgroundColor: '#2BBFA411', borderColor: '#2BBFA433' },
  profileStatusWarn: { backgroundColor: '#FFA50011', borderColor: '#FFA50033' },
  profileStatusText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  section:     { backgroundColor: '#132220', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#1A7F6E22' },
  sectionTitle:{ color: '#2BBFA4', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  sectionDesc: { color: '#4A6A67', fontSize: 13, lineHeight: 20, marginBottom: 12 },
  label:       { color: '#8BBAB5', fontSize: 12, marginBottom: 6, marginTop: 12 },
  input:       { backgroundColor: '#0D1918', borderRadius: 10, padding: 12, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#1A7F6E44' },
  rowFields:   { flexDirection: 'row', marginTop: 4 },
  optionRow:   { flexDirection: 'row', gap: 10, marginBottom: 4 },
  optionBtn:   { flex: 1, backgroundColor: '#0D1918', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1A7F6E33' },
  optionBtnActive: { backgroundColor: '#1A7F6E', borderColor: '#2BBFA4' },
  optionText:  { color: '#4A6A67', fontSize: 14 },
  optionTextActive: { color: '#fff', fontWeight: '600' },
  checkRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  checkbox:    { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#2A4A47', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#1A7F6E', borderColor: '#2BBFA4' },
  checkmark:   { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel:  { color: '#8BBAB5', fontSize: 14 },
  saveBtn:     { backgroundColor: '#1A7F6E', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  calStatus:   { backgroundColor: '#2BBFA411', borderRadius: 8, padding: 12, marginBottom: 10 },
  calStatusText: { color: '#2BBFA4', fontSize: 13, fontWeight: '600' },
  calStatusSub:  { color: '#4A6A67', fontSize: 12, marginTop: 2 },
  calEmptyText:  { color: '#4A6A67', fontSize: 13, fontStyle: 'italic' },
  dangerBtnSmall: { backgroundColor: '#F25C5415', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#F25C5433' },
  dangerBtnSmallText: { color: '#F25C54', fontSize: 14 },
  dangerBtn:   { backgroundColor: '#F25C5422', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#F25C5444' },
  dangerBtnText: { color: '#F25C54', fontSize: 15, fontWeight: '600' },
  version:     { color: '#2A4A47', fontSize: 12, textAlign: 'center', marginTop: 8 },
  switchRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 12 },
  switchLabel: { color: '#fff', fontSize: 14 },
  linkRow: { flexDirection: 'row', marginTop: 16, justifyContent: 'center' },
  linkText: { color: '#2BBFA4', fontSize: 14, textDecorationLine: 'underline' },
  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#132220', borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#2BBFA433',
    gap: 12,
  },
  upgradeBtnEmoji: { fontSize: 24 },
  upgradeBtnTextWrap: { flex: 1 },
  upgradeBtnTitle: { color: '#2BBFA4', fontSize: 15, fontWeight: '700' },
  upgradeBtnSub: { color: '#4A6A67', fontSize: 12, marginTop: 2 },
  upgradeBtnArrow: { color: '#2BBFA4', fontSize: 18, fontWeight: '600' },
  // Exportar
  exportBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0D1918', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#1A7F6E44', gap: 12,
  },
  exportBtnIcon: { fontSize: 20 },
  exportBtnTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  exportBtnSub: { color: '#4A6A67', fontSize: 11, marginTop: 2 },
  exportBtnArrow: { color: '#2BBFA4', fontSize: 16, fontWeight: '600' },

  // Acerca de
  aboutCard: {
    backgroundColor: '#132220', borderRadius: 16, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#1A7F6E22',
  },
  aboutTitle: { color: '#2BBFA4', fontSize: 15, fontWeight: '700', marginBottom: 16 },
  aboutRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1A7F6E15',
  },
  aboutLabel: { color: '#4A6A67', fontSize: 13 },
  aboutValue: { color: '#8BBAB5', fontSize: 13, fontWeight: '600' },
  aboutDesc: { color: '#4A6A67', fontSize: 12, lineHeight: 18, marginTop: 12 },
});
