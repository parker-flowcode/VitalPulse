/**
 * SettingsScreen.js — VitalPulse v5.0
 *
 * Ajustes reorganizados con jerarquía visual clara y tema dinámico.
 *
 * ┌─────────────────────────────────────────┐
 * │ 1. TEMA (Card) — Theme toggle          │
 * │    Sistema · Claro · Oscuro             │
 * ├─────────────────────────────────────────┤
 * │ 2. PERFIL PERSONAL (Card)               │
 * │    Nombre, edad, sexo, peso, etc.       │
 * ├─────────────────────────────────────────┤
 * │ 3. CALIBRACIÓN (Card)                   │
 * │    Puntos guardados, regresión          │
 * ├─────────────────────────────────────────┤
 * │ 4. ALERTAS BPM (Card)                   │
 * │    Límites alto/bajo                    │
 * ├─────────────────────────────────────────┤
 * │ 5. VITALPULSE PRO (Card destacado)      │
 * │    Upgrade CTA                          │
 * ├─────────────────────────────────────────┤
 * │ 6. EXPORTAR DATOS (Card)                │
 * │    CSV export                           │
 * ├─────────────────────────────────────────┤
 * │ 7. GESTIÓN DE DATOS (Card)              │
 * │    Info privacidad local                │
 * ├─────────────────────────────────────────┤
 * │ 8. ⚠️ ZONA DE PELIGRO (Card rojo)      │
 * │    Borrar historial                     │
 * │    Borrar TODOS los datos               │
 * ├─────────────────────────────────────────┤
 * │ 9. ACERCA DE (Card)                     │
 * │    Versión, SDK, desarrollador          │
 * ├─────────────────────────────────────────┤
 * │ [BannerAd]                              │
 * ├─────────────────────────────────────────┤
 * │ [STICKY FOOTER]                         │
 * │   Política de Privacidad · Términos     │
 * └─────────────────────────────────────────┘
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform, Switch, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useHealthStore from '../store/healthstore';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { generateCSV, shareCSV, getExportFilename } from '../services/exportService';
import BannerAd from '../components/BannerAd';
import { SPACING, RADIUS, SHADOWS } from '../theme/designTokens';

const THEME_OPTIONS = [
  { key: 'system', label: 'Sistema', icon: '📱' },
  { key: 'light',  label: 'Claro',   icon: '☀️' },
  { key: 'dark',   label: 'Oscuro',  icon: '🌙' },
];

export default function SettingsScreen() {
  const { colors, theme, setTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
          {/* ─── Logo y título ─────────────────────────────────────────────── */}
          <View style={styles.logoSection}>
            <Image source={require('../../assets/icon.png')} style={styles.logo} />
            <Text style={styles.appTitle}>VitalPulse</Text>
            <Text style={styles.appVersion}>v5.0.0</Text>
          </View>

          {/* ─── Estado del perfil ──────────────────────────────────────── */}
          <View style={[styles.profileStatus, profileComplete ? styles.profileStatusOk : styles.profileStatusWarn]}>
            <Text style={[styles.profileStatusText, { color: profileComplete ? colors.success : colors.warning }]}>
              {profileComplete
                ? 'Perfil completo — máxima precisión activa'
                : 'Perfil incompleto — complétalo para mayor precisión'}
            </Text>
          </View>

          {/* ═══════════════════════════════════════════════════════════════
              CARD 1: TEMA (Theme Toggle)
              ═══════════════════════════════════════════════════════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>🎨</Text>
              <Text style={styles.cardTitle}>Tema</Text>
            </View>
            <Text style={styles.cardDesc}>
              Elige cómo se ve VitalPulse. El modo "Sistema" sigue la configuración de tu dispositivo.
            </Text>
            <View style={styles.themeRow}>
              {THEME_OPTIONS.map((opt) => {
                const isSelected = theme === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.themePill,
                      isSelected && styles.themePillActive,
                    ]}
                    onPress={() => setTheme(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.themePillIcon}>{opt.icon}</Text>
                    <Text style={[
                      styles.themePillLabel,
                      isSelected && styles.themePillLabelActive,
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ═══════════════════════════════════════════════════════════════
              CARD 2: PERFIL PERSONAL
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
              placeholder="Tu nombre" placeholderTextColor={colors.textMuted} maxLength={40} />

            <Text style={styles.label}>Edad *</Text>
            <TextInput style={styles.input} value={age} onChangeText={setAge}
              placeholder="Años" placeholderTextColor={colors.textMuted} keyboardType="number-pad" maxLength={3} />

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
                  placeholder="70" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" maxLength={5} />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Estatura (cm)</Text>
                <TextInput style={styles.input} value={height} onChangeText={setHeight}
                  placeholder="170" placeholderTextColor={colors.textMuted} keyboardType="number-pad" maxLength={3} />
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
              CARD 3: CALIBRACIÓN DE PA
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
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={preferRegression ? colors.textOnPrimary : colors.textMuted}
              />
            </View>
          </View>

          {/* ═══════════════════════════════════════════════════════════════
              CARD 4: ALERTAS DE BPM
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
              keyboardType="number-pad" maxLength={3} placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>Alerta BPM bajo (por debajo de)</Text>
            <TextInput style={styles.input} value={alertLow} onChangeText={setAlertLow}
              keyboardType="number-pad" maxLength={3} placeholderTextColor={colors.textMuted} />
            <TouchableOpacity style={styles.saveBtn} onPress={saveAlerts}>
              <Text style={styles.saveBtnText}>Guardar alertas</Text>
            </TouchableOpacity>
          </View>

          {/* ═══════════════════════════════════════════════════════════════
              CARD 5: VITALPULSE PRO (destacado)
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
              CARD 6: EXPORTAR DATOS
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
              CARD 7: GESTIÓN DE DATOS
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
              CARD 8: ⚠️ ZONA DE PELIGRO
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
              CARD 9: ACERCA DE
              ═══════════════════════════════════════════════════════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>ℹ️</Text>
              <Text style={styles.cardTitle}>Acerca de VitalPulse</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Versión</Text>
              <Text style={styles.aboutValue}>5.0.0</Text>
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

// ─── Styles factory ────────────────────────────────────────────────────────────
const createStyles = (colors) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 16 },

  // ─── Logo section ──────────────────────────────────────────────────────────
  logoSection: { alignItems: 'center', marginBottom: 20, marginTop: 8 },
  logo:        { width: 56, height: 56, marginBottom: 10, resizeMode: 'contain' },
  appTitle:    { color: colors.textPrimary, fontSize: 26, fontWeight: '700' },
  appVersion:  { color: colors.textMuted, fontSize: 14, marginTop: 2 },

  // ─── Profile status banner ────────────────────────────────────────────────
  profileStatus:     { borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1 },
  profileStatusOk:   { backgroundColor: colors.primarySubtle, borderColor: colors.primary + '33' },
  profileStatusWarn: { backgroundColor: colors.warningLight, borderColor: colors.warning + '33' },
  profileStatusText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // ─── Theme toggle ──────────────────────────────────────────────────────────
  themeRow: {
    flexDirection: 'row', gap: 10, marginTop: 8,
  },
  themePill: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  themePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  themePillIcon: { fontSize: 18 },
  themePillLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  themePillLabelActive: {
    color: colors.textOnPrimary,
  },

  // ─── Card base ────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.bg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardIcon:    { fontSize: 20 },
  cardTitle:   { color: colors.primary, fontSize: 15, fontWeight: '700' },
  cardDesc:    { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 12 },

  // ─── Form fields ──────────────────────────────────────────────────────────
  label:       { color: colors.primary, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input:       { backgroundColor: colors.bgSecondary, borderRadius: 10, padding: 12, color: colors.textPrimary, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  rowFields:   { flexDirection: 'row', marginTop: 4 },
  optionRow:   { flexDirection: 'row', gap: 10, marginBottom: 4 },
  optionBtn:   { flex: 1, backgroundColor: colors.bg, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  optionBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText:  { color: colors.textSecondary, fontSize: 14 },
  optionTextActive: { color: colors.textOnPrimary, fontWeight: '600' },
  checkRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  checkbox:    { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark:   { color: colors.textOnPrimary, fontSize: 13, fontWeight: '700' },
  checkLabel:  { color: colors.textPrimary, fontSize: 14 },
  saveBtn:     { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '600' },

  // ─── Calibration ──────────────────────────────────────────────────────────
  calStatus:   { backgroundColor: colors.primarySubtle, borderRadius: 8, padding: 12, marginBottom: 10 },
  calStatusText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  calStatusSub:  { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  calEmptyText:  { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  switchRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 4 },
  switchLabel: { color: colors.textPrimary, fontSize: 14, flex: 1, marginRight: 12 },

  // ─── Pro card (destacado) ─────────────────────────────────────────────────
  proCard: {
    backgroundColor: colors.bg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  proCardContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  proEmoji:  { fontSize: 24 },
  proTextWrap: { flex: 1 },
  proTitle:  { color: colors.primary, fontSize: 15, fontWeight: '700' },
  proSub:    { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  proArrow:  { color: colors.primary, fontSize: 18, fontWeight: '600' },

  // ─── Export ───────────────────────────────────────────────────────────────
  exportBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border, gap: 12,
  },
  exportBtnIcon: { fontSize: 20 },
  exportBtnTitle: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  exportBtnSub: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  exportBtnArrow: { color: colors.primary, fontSize: 16, fontWeight: '600' },

  // ─── Privacy badge ────────────────────────────────────────────────────────
  privacyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bgCard, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  privacyBadgeIcon: { fontSize: 20 },
  privacyBadgeText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, flex: 1 },

  // ─── ⚠️ Zona de peligro ──────────────────────────────────────────────────
  dangerCard: {
    backgroundColor: colors.dangerLight,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.danger,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  dangerCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dangerIcon:  { fontSize: 20 },
  dangerTitle: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  dangerDesc:  { color: colors.dangerDark, fontSize: 13, lineHeight: 20, marginBottom: 16 },

  dangerAction: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bg, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: colors.dangerLight,
  },
  dangerActionDestructive: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bg, borderRadius: 12, padding: 16,
    borderWidth: 2, borderColor: colors.danger,
  },
  dangerActionIconWrap: { width: 32, alignItems: 'center' },
  dangerActionIcon: { fontSize: 20 },
  dangerActionTextWrap: { flex: 1 },
  dangerActionTitle: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  dangerActionTitleDestructive: { color: colors.dangerDark, fontSize: 15, fontWeight: '700' },
  dangerActionSub: { color: colors.dangerDark, fontSize: 12, marginTop: 2 },

  // ─── Botones danger pequeños (para calibración) ───────────────────────────
  dangerBtnSmall: { backgroundColor: colors.dangerLight, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.dangerLight },
  dangerBtnSmallText: { color: colors.danger, fontSize: 14, fontWeight: '600' },

  // ─── Acerca de ────────────────────────────────────────────────────────────
  aboutRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  aboutLabel: { color: colors.textSecondary, fontSize: 13 },
  aboutValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  aboutDesc: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 12 },

  // ─── Sticky footer (enlaces legales) ──────────────────────────────────────
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  footerLinkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  footerDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
});
