/**
 * SettingsScreen.js — VitalPulse v4.0
 *
 * Ajustes reorganizados con jerarquía visual clara:
 *
 * ┌─────────────────────────────────────┐
 * │ 1. PERFIL PERSONAL (Card)           │
 * │    Nombre, edad, sexo, peso, etc.   │
 * ├─────────────────────────────────────┤
 * │ 2. CALIBRACIÓN (Card)               │
 * │    Puntos guardados, regresión      │
 * ├─────────────────────────────────────┤
 * │ 3. ALERTAS BPM (Card)               │
 * │    Límites alto/bajo                │
 * ├─────────────────────────────────────┤
 * │ 4. VITALPULSE PRO (Card destacado)  │
 * │    Upgrade CTA                      │
 * ├─────────────────────────────────────┤
 * │ 5. EXPORTAR DATOS (Card)            │
 * │    CSV export                       │
 * ├─────────────────────────────────────┤
 * │ 6. GESTIÓN DE DATOS (Card)          │
 * │    Info privacidad local            │
 * ├─────────────────────────────────────┤
 * │ 7. ⚠️ ZONA DE PELIGRO (Card rojo)  │
 * │    Borrar historial                 │
 * │    Borrar TODOS los datos           │
 * ├─────────────────────────────────────┤
 * │ 8. ACERCA DE (Card)                 │
 * │    Versión, SDK, desarrollador      │
 * ├─────────────────────────────────────┤
 * │ [STICKY FOOTER]                     │
 * │   Política de Privacidad · Términos │
 * └─────────────────────────────────────┘
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform, Switch, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useHealthStore from '../store/healthstore';
import { useNavigation } from '@react-navigation/native';
import { generateCSV, shareCSV, getExportFilename } from '../services/exportService';
import BannerAd from '../components/BannerAd';

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
    Alert.alert('Guardado', 'Perfil actualizado. Las próximas mediciones serán más precisas.');
  };

  const saveAlerts = () => {
    const high = parseInt(alertHigh, 10);
    const low  = parseInt(alertLow, 10);
    if (isNaN(high) || isNaN(low) || low >= high) {
      Alert.alert('Inválido', 'El BPM alto debe ser mayor que el BPM bajo.'); return;
    }
    updateSettings({ alertBPMHigh: high, alertBPMLow: low });
    Alert.alert('Guardado', 'Alertas actualizadas.');
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

  const profileComplete = !!(userProfile.age && userProfile.sex && userProfile.isActive !== null && userProfile.weight && userProfile.height);

  const handleExportCSV = async () => {
    if (history.length === 0) {
      Alert.alert('Sin datos', 'No hay mediciones para exportar.');
      return;
    }
    try {
      const csv = generateCSV(history);
      const filename = getExportFilename();
      const success = await shareCSV(csv, filename);
      if (success) {
        Alert.alert('Exportado', `Historial compartido como ${filename}`);
      } else {
        Alert.alert('Exportación cancelada', 'No se pudo completar la exportación.');
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
          {/* ─── Logo y t├¡tulo ─────────────────────────────────────────────── */}
          <View style={styles.logoSection}>
            <Image source={require('../../assets/icon.png')} style={styles.logo} />
            <Text style={styles.appTitle}>VitalPulse</Text>
            <Text style={styles.appVersion}>v4.0.0</Text>
          </View>

          {/* ─── Estado del perfil ──────────────────────────────────────── */}
          <View style={[styles.profileStatus, profileComplete ? styles.profileStatusOk : styles.profileStatusWarn]}>
            <Text style={[styles.profileStatusText, { color: profileComplete ? '#10B981' : '#F59E0B' }]}>
              {profileComplete
                ? 'Perfil completo — máxima precisión activa'
                : 'Perfil incompleto — complétalo para mayor precisión'}
            </Text>
          </View>

          {/* ═══════════════════════════════════════════════════════════════
              CARD 1: PERFIL PERSONAL
              ═══════════════════════════════════════════════════════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>👤</Text>
              <Text style={styles.cardTitle}>Perfil personal</Text>
            </View>
            <Text style={styles.cardDesc}>
              Tus datos demográficos mejoran la precisión de la estimación de presión arterial.
            </Text>

            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName}
              placeholder="Tu nombre" placeholderTextColor="#94A3B8" maxLength={40} />

            <Text style={styles.label}>Edad *</Text>
            <TextInput style={styles.input} value={age} onChangeText={setAge}
              placeholder="Años" placeholderTextColor="#94A3B8" keyboardType="number-pad" maxLength={3} />

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
                  placeholder="70" placeholderTextColor="#94A3B8" keyboardType="decimal-pad" maxLength={5} />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Estatura (cm)</Text>
                <TextInput style={styles.input} value={height} onChangeText={setHeight}
                  placeholder="170" placeholderTextColor="#94A3B8" keyboardType="number-pad" maxLength={3} />
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

          {/* ═══════════════════════════════════════════════════════════════
              CARD 2: CALIBRACI├ôN DE PA
              ═══════════════════════════════════════════════════════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>📏</Text>
              <Text style={styles.cardTitle}>Calibración de PA</Text>
            </View>
            <Text style={styles.cardDesc}>
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
                    ├Ültimo: {new Date(calibration.points[calibration.points.length - 1].date).toLocaleDateString('es-ES')}
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
                trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
                thumbColor={preferRegression ? '#FFFFFF' : '#94A3B8'}
              />
            </View>
          </View>

          {/* ═══════════════════════════════════════════════════════════════
              CARD 3: ALERTAS DE BPM
              ═══════════════════════════════════════════════════════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>🔔</Text>
              <Text style={styles.cardTitle}>Alertas de BPM</Text>
            </View>
            <Text style={styles.cardDesc}>
              Recibe una notificación si tu frecuencia cardíaca supera o baja de estos límites.
            </Text>
            <Text style={styles.label}>Alerta BPM alto (por encima de)</Text>
            <TextInput style={styles.input} value={alertHigh} onChangeText={setAlertHigh}
              keyboardType="number-pad" maxLength={3} placeholderTextColor="#94A3B8" />
            <Text style={styles.label}>Alerta BPM bajo (por debajo de)</Text>
            <TextInput style={styles.input} value={alertLow} onChangeText={setAlertLow}
              keyboardType="number-pad" maxLength={3} placeholderTextColor="#94A3B8" />
            <TouchableOpacity style={styles.saveBtn} onPress={saveAlerts}>
              <Text style={styles.saveBtnText}>Guardar alertas</Text>
            </TouchableOpacity>
          </View>

          {/* ═══════════════════════════════════════════════════════════════
              CARD 4: VITALPULSE PRO (destacado)
              ═══════════════════════════════════════════════════════════════ */}
          <TouchableOpacity
            style={styles.proCard}
            onPress={() => navigation.navigate('Upgrade')}
            activeOpacity={0.8}
          >
            <View style={styles.proCardContent}>
              <Text style={styles.proEmoji}>💙</Text>
              <View style={styles.proTextWrap}>
                <Text style={styles.proTitle}>VitalPulse Pro</Text>
                <Text style={styles.proSub}>
                  Mediciones ilimitadas · Sin anuncios · Calibración avanzada
                </Text>
              </View>
              <Text style={styles.proArrow}>→</Text>
            </View>
          </TouchableOpacity>

          {/* ═══════════════════════════════════════════════════════════════
              CARD 5: EXPORTAR DATOS
              ═══════════════════════════════════════════════════════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>📤</Text>
              <Text style={styles.cardTitle}>Exportar datos</Text>
            </View>
            <Text style={styles.cardDesc}>
              Exporta tu historial completo como archivo CSV compatible con Excel, Google Sheets y otros programas de análisis.
            </Text>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
              <Text style={styles.exportBtnIcon}>📊</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.exportBtnTitle}>Exportar historial como CSV</Text>
                <Text style={styles.exportBtnSub}>{history.length} mediciones · Punto y coma</Text>
              </View>
              <Text style={styles.exportBtnArrow}>→</Text>
            </TouchableOpacity>
          </View>

          {/* ═══════════════════════════════════════════════════════════════
              CARD 6: GESTI├ôN DE DATOS
              ═══════════════════════════════════════════════════════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>🔒</Text>
              <Text style={styles.cardTitle}>Gestión de datos</Text>
            </View>
            <View style={styles.privacyBadge}>
              <Text style={styles.privacyBadgeIcon}>📱</Text>
              <Text style={styles.privacyBadgeText}>
                Todos los datos se guardan únicamente en este dispositivo. Nada se envía a servidores externos.
              </Text>
            </View>
          </View>

          {/* ═══════════════════════════════════════════════════════════════
              CARD 7: ⚠️ ZONA DE PELIGRO
              ═══════════════════════════════════════════════════════════════ */}
          <View style={styles.dangerCard}>
            <View style={styles.dangerCardHeader}>
              <Text style={styles.dangerIcon}>⚠️</Text>
              <Text style={styles.dangerTitle}>Zona de peligro</Text>
            </View>
            <Text style={styles.dangerDesc}>
              Estas acciones son irreversibles. Los datos eliminados no se pueden recuperar.
            </Text>

            <TouchableOpacity style={styles.dangerAction} onPress={() => {
              Alert.alert('Borrar historial', '¿Eliminar todas las mediciones?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Borrar', style: 'destructive', onPress: clearHistory },
              ]);
            }}>
              <View style={styles.dangerActionIconWrap}>
                <Text style={styles.dangerActionIcon}>🗑️</Text>
              </View>
              <View style={styles.dangerActionTextWrap}>
                <Text style={styles.dangerActionTitle}>Borrar historial de mediciones</Text>
                <Text style={styles.dangerActionSub}>Se eliminarán todas las mediciones guardadas</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dangerActionDestructive} onPress={handleClearAll}>
              <View style={styles.dangerActionIconWrap}>
                <Text style={styles.dangerActionIcon}>☢️</Text>
              </View>
              <View style={styles.dangerActionTextWrap}>
                <Text style={styles.dangerActionTitleDestructive}>Borrar todos los datos</Text>
                <Text style={styles.dangerActionSub}>Mediciones, calibración, perfil y configuración</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ═══════════════════════════════════════════════════════════════
              CARD 8: ACERCA DE
              ═══════════════════════════════════════════════════════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>ℹ️</Text>
              <Text style={styles.cardTitle}>Acerca de VitalPulse</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Versión</Text>
              <Text style={styles.aboutValue}>4.0.0</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>SDK</Text>
              <Text style={styles.aboutValue}>Expo 54</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Desarrollador</Text>
              <Text style={styles.aboutValue}>MVP Software Studios</Text>
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

          {/* Banner inferior no intrusivo */}
          <BannerAd />

          {/* Espacio extra para que el footer sticky no tape contenido */}
          <View style={{ height: 60 }} />
        </ScrollView>

        {/* ═══════════════════════════════════════════════════════════════
            STICKY FOOTER — Enlaces legales
            ═══════════════════════════════════════════════════════════════ */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.footerLink}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <Text style={styles.footerLinkText}>Política de Privacidad</Text>
          </TouchableOpacity>
          <View style={styles.footerDivider} />
          <TouchableOpacity
            style={styles.footerLink}
            onPress={() => navigation.navigate('Terms')}
          >
            <Text style={styles.footerLinkText}>Términos de Uso</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { padding: 20, paddingBottom: 16 },

  // ─── Logo section ──────────────────────────────────────────────────────────
  logoSection: { alignItems: 'center', marginBottom: 20, marginTop: 8 },
  logo:        { width: 56, height: 56, marginBottom: 10, resizeMode: 'contain' },
  appTitle:    { color: '#1E293B', fontSize: 26, fontWeight: '700' },
  appVersion:  { color: '#94A3B8', fontSize: 14, marginTop: 2 },

  // ─── Profile status banner ────────────────────────────────────────────────
  profileStatus:     { borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1 },
  profileStatusOk:   { backgroundColor: '#EFF6FF', borderColor: '#2563EB33' },
  profileStatusWarn: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B33' },
  profileStatusText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // ─── Card base ────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardIcon:    { fontSize: 20 },
  cardTitle:   { color: '#2563EB', fontSize: 15, fontWeight: '700' },
  cardDesc:    { color: '#64748B', fontSize: 13, lineHeight: 20, marginBottom: 12 },

  // ─── Form fields ──────────────────────────────────────────────────────────
  label:       { color: '#2563EB', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input:       { backgroundColor: '#F1F5F9', borderRadius: 10, padding: 12, color: '#1E293B', fontSize: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  rowFields:   { flexDirection: 'row', marginTop: 4 },
  optionRow:   { flexDirection: 'row', gap: 10, marginBottom: 4 },
  optionBtn:   { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  optionBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  optionText:  { color: '#64748B', fontSize: 14 },
  optionTextActive: { color: '#FFFFFF', fontWeight: '600' },
  checkRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  checkbox:    { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkmark:   { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  checkLabel:  { color: '#1E293B', fontSize: 14 },
  saveBtn:     { backgroundColor: '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  // ─── Calibration ──────────────────────────────────────────────────────────
  calStatus:   { backgroundColor: '#EFF6FF', borderRadius: 8, padding: 12, marginBottom: 10 },
  calStatusText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
  calStatusSub:  { color: '#64748B', fontSize: 12, marginTop: 2 },
  calEmptyText:  { color: '#94A3B8', fontSize: 13, fontStyle: 'italic' },
  switchRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 4 },
  switchLabel: { color: '#1E293B', fontSize: 14, flex: 1, marginRight: 12 },

  // ─── Pro card (destacado) ─────────────────────────────────────────────────
  proCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  proCardContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  proEmoji:  { fontSize: 24 },
  proTextWrap: { flex: 1 },
  proTitle:  { color: '#2563EB', fontSize: 15, fontWeight: '700' },
  proSub:    { color: '#64748B', fontSize: 12, marginTop: 2 },
  proArrow:  { color: '#2563EB', fontSize: 18, fontWeight: '600' },

  // ─── Export ───────────────────────────────────────────────────────────────
  exportBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F9FA', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#E2E8F0', gap: 12,
  },
  exportBtnIcon: { fontSize: 20 },
  exportBtnTitle: { color: '#2563EB', fontSize: 14, fontWeight: '600' },
  exportBtnSub: { color: '#64748B', fontSize: 11, marginTop: 2 },
  exportBtnArrow: { color: '#2563EB', fontSize: 16, fontWeight: '600' },

  // ─── Privacy badge ────────────────────────────────────────────────────────
  privacyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F8F9FA', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  privacyBadgeIcon: { fontSize: 20 },
  privacyBadgeText: { color: '#64748B', fontSize: 13, lineHeight: 20, flex: 1 },

  // ─── ⚠️ Zona de peligro ──────────────────────────────────────────────────
  dangerCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  dangerCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dangerIcon:  { fontSize: 20 },
  dangerTitle: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
  dangerDesc:  { color: '#DC2626', fontSize: 13, lineHeight: 20, marginBottom: 16 },

  dangerAction: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#FECACA',
  },
  dangerActionDestructive: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
    borderWidth: 2, borderColor: '#EF4444',
  },
  dangerActionIconWrap: { width: 32, alignItems: 'center' },
  dangerActionIcon: { fontSize: 20 },
  dangerActionTextWrap: { flex: 1 },
  dangerActionTitle: { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  dangerActionTitleDestructive: { color: '#DC2626', fontSize: 15, fontWeight: '700' },
  dangerActionSub: { color: '#B91C1C', fontSize: 12, marginTop: 2 },

  // ─── Botones danger peque├▒os (para calibraci├│n) ───────────────────────────
  dangerBtnSmall: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  dangerBtnSmallText: { color: '#EF4444', fontSize: 14, fontWeight: '600' },

  // ─── Acerca de ────────────────────────────────────────────────────────────
  aboutRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  aboutLabel: { color: '#64748B', fontSize: 13 },
  aboutValue: { color: '#1E293B', fontSize: 13, fontWeight: '600' },
  aboutDesc: { color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 12 },

  // ─── Sticky footer (enlaces legales) ──────────────────────────────────────
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  footerLinkText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
  },
  footerDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
});
