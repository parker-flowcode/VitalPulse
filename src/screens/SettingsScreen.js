/**
 * SettingsScreen.js — VitalPulse v9.0
 *
 * Premium accordion-style settings with dynamic Sky Blue theme.
 *
 * ┌─────────────────────────────────────────────────┐
 * │ [Logo]                                           │
 * ├─────────────────────────────────────────────────┤
 * │ ▼ 💎 VitalPulse Pro (always first, prominent)  │
 * │ ▼ 🎨 Tema (pill buttons, expanded by default)  │
 * │ ▼ 👤 Perfil personal                            │
 * │ ▼ 📏 Calibración PA                             │
 * │ ▼ 🔔 Alertas BPM                                │
 * │ ▼ 📤 Exportar datos                             │
 * │ ▼ 🔒 Gestión de datos                           │
 * │ ▼ ⚠️ Zona de peligro                            │
 * │ ▼ ℹ️ Acerca de                                   │
 * ├─────────────────────────────────────────────────┤
 * │ Política de Privacidad · Términos de Uso         │
 * └─────────────────────────────────────────────────┘
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
import { isPro, getCurrentPlan, PLANS } from '../services/subscriptions';
import BannerAd from '../components/BannerAd';
import { SPACING, RADIUS, SHADOWS } from '../theme/designTokens';

// ─── Constants ───────────────────────────────────────────────────────────────────
const THEME_OPTIONS = [
  { key: 'system', label: 'Sistema', icon: '📱' },
  { key: 'light',  label: 'Claro',   icon: '☀️' },
  { key: 'dark',   label: 'Oscuro',  icon: '🌙' },
];

const PRO_FEATURES = [
  { icon: '📊', title: 'Mediciones ilimitadas',         desc: 'Sin límite diario de mediciones' },
  { icon: '📈', title: 'Calibración avanzada',           desc: 'Calibración multi-punto con regresión' },
  { icon: '📤', title: 'Exportación a CSV',               desc: 'Descarga tus datos completos' },
  { icon: '📉', title: 'Gráficas de tendencias',          desc: 'Visualiza tu evolución cardiovascular' },
  { icon: '🎯', title: 'Métricas de calidad',             desc: 'SNR y métricas avanzadas de señal' },
  { icon: '🚫', title: 'Sin anuncios',                    desc: 'Experiencia limpia y sin distracciones' },
];

const APP_VERSION = '9.0.0';
const DEVELOPER = 'MVP Software Studios';

// ─── AccordionSection component ──────────────────────────────────────────────────
function AccordionSection({
  expanded,
  onToggle,
  icon,
  title,
  titleColor,
  borderColor,
  cardStyle,
  children,
  colors,
}) {
  return (
    <View style={[
      accordionCard(colors, borderColor),
      cardStyle,
    ]}>
      <TouchableOpacity
        style={accordionHeader(colors)}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={accordionHeaderIcon}>{icon}</Text>
        <Text style={[
          accordionHeaderTitle(colors),
          titleColor ? { color: titleColor } : null,
        ]}>{title}</Text>
        <Text style={accordionChevron(colors)}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={accordionContent(colors)}>
          {children}
        </View>
      )}
    </View>
  );
}

// ─── Reusable accordion sub-styles (functions so they use the dynamic colors) ────
const accordionCard = (colors, _borderColor) => ({
  backgroundColor: 'transparent',
  borderBottomWidth: 1,
  borderBottomColor: colors.divider,
});

const accordionHeader = (colors) => ({
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 16,
  paddingHorizontal: 18,
  gap: 10,
});

const accordionHeaderIcon = {
  fontSize: 20,
  width: 28,
  textAlign: 'center',
};

const accordionHeaderTitle = (colors) => ({
  flex: 1,
  fontSize: 15,
  fontWeight: '700',
  color: colors.textPrimary,
});

const accordionChevron = (colors) => ({
  fontSize: 12,
  color: colors.textMuted,
});

const accordionContent = (colors) => ({
  paddingHorizontal: 18,
  paddingBottom: 18,
  borderTopWidth: 1,
  borderTopColor: colors.divider,
  paddingTop: 14,
  backgroundColor: colors.bgCard,
});

// ─── Main Screen ─────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { colors, resolvedTheme, theme, setTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();

  const {
    userProfile, updateUserProfile,
    calibration, clearCalibration,
    settings, updateSettings,
    history, clearHistory, clearAllData,
  } = useHealthStore();

  // ─── Accordion expanded states ───────────────────────────────────────────────
  const [expandedPro,     setExpandedPro]     = useState(false);
  const [expandedTheme,   setExpandedTheme]   = useState(true);  // Always expanded by default
  const [expandedProfile, setExpandedProfile] = useState(false);
  const [expandedCal,     setExpandedCal]     = useState(false);
  const [expandedAlerts,  setExpandedAlerts]  = useState(false);
  const [expandedExport,  setExpandedExport]  = useState(false);
  const [expandedData,    setExpandedData]    = useState(false);
  const [expandedDanger,  setExpandedDanger]  = useState(false);
  const [expandedAbout,   setExpandedAbout]   = useState(false);

  // ─── Form state ───────────────────────────────────────────────────────────────
  const [name, setName]          = useState(userProfile.name || '');
  const [age, setAge]            = useState(userProfile.age?.toString() || '');
  const [sex, setSex]            = useState(userProfile.sex || null);
  const [weight, setWeight]      = useState(userProfile.weight?.toString() || '');
  const [height, setHeight]      = useState(userProfile.height?.toString() || '');
  const [isActive, setIsActive]  = useState(userProfile.isActive || false);
  const [smoker, setSmoker]      = useState(userProfile.smoker || false);
  const [diabetic, setDiabetic]  = useState(userProfile.diabetic || false);
  const [alertHigh, setAlertHigh] = useState(settings.alertBPMHigh?.toString() || '100');
  const [alertLow, setAlertLow]   = useState(settings.alertBPMLow?.toString() || '50');
  const [preferRegression, setPreferRegression] = useState(settings.preferRegression ?? true);

  const userIsPro = isPro();
  const currentPlan = getCurrentPlan();

  // ─── Handlers ──────────────────────────────────────────────────────────────────
  const saveProfile = async () => {
    const parsedAge = age ? parseInt(age, 10) : null;
    if (parsedAge !== null && (isNaN(parsedAge) || parsedAge < 5 || parsedAge > 120)) {
      Alert.alert('Edad inválida', 'Introduce una edad entre 5 y 120 años.');
      return;
    }
    await updateUserProfile({
      name: name.trim(),
      age: parsedAge,
      sex,
      weight: weight ? parseFloat(weight) : null,
      height: height ? parseFloat(height) : null,
      isActive,
      smoker,
      diabetic,
    });
    Alert.alert('Guardado', 'Perfil actualizado. Las próximas mediciones serán más precisas.');
  };

  const saveAlerts = () => {
    const high = parseInt(alertHigh, 10);
    const low  = parseInt(alertLow, 10);
    if (isNaN(high) || isNaN(low) || low >= high) {
      Alert.alert('Inválido', 'El BPM alto debe ser mayor que el BPM bajo.');
      return;
    }
    updateSettings({ alertBPMHigh: high, alertBPMLow: low });
    Alert.alert('Guardado', 'Alertas actualizadas.');
  };

  const togglePreferRegression = (value) => {
    setPreferRegression(value);
    updateSettings({ preferRegression: value });
  };

  const handleClearCalibration = () => {
    Alert.alert(
      'Borrar calibración',
      '¿Eliminar todos los puntos de calibración de PA?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: clearCalibration },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Borrar todos los datos',
      'Se eliminarán mediciones, calibración, perfil y configuración. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            Alert.alert('Datos eliminados', 'Todos los datos han sido borrados.');
          },
        },
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Borrar historial',
      '¿Eliminar todas las mediciones guardadas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: clearHistory },
      ]
    );
  };

  const handleExportCSV = async () => {
    if (!userIsPro) {
      return; // Never reaches here if not Pro; the UI handles it inline
    }
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

  const profileComplete = !!(
    userProfile.age && userProfile.sex && userProfile.isActive !== null &&
    userProfile.weight && userProfile.height
  );

  // ─── Render ────────────────────────────────────────────────────────────────────
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
          {/* ─── Logo + Branding ─────────────────────────────────────────────── */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appTitle}>VitalPulse</Text>
            <Text style={styles.appVersion}>v{APP_VERSION}</Text>
          </View>

          {/* ─── Profile status banner ───────────────────────────────────────── */}
          <View
            style={[
              styles.profileStatus,
              profileComplete ? styles.profileStatusOk : styles.profileStatusWarn,
            ]}
          >
            <Text
              style={[
                styles.profileStatusText,
                { color: profileComplete ? colors.success : colors.warning },
              ]}
            >
              {profileComplete
                ? 'Perfil completo — máxima precisión activa'
                : 'Perfil incompleto — complétalo para mayor precisión'}
            </Text>
          </View>

          {/* ═══════════════════════════════════════════════════════════════════
              1. 💎 VITALPULSE PRO — Always at the very top
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedPro}
            onToggle={() => setExpandedPro(!expandedPro)}
            icon="💎"
            title={userIsPro ? 'VitalPulse Pro — Activo' : 'VitalPulse Pro'}
            titleColor={colors.primary}
            borderColor={colors.primary}
            cardStyle={styles.proAccordionCard}
            colors={colors}
          >
            {userIsPro ? (
              <>
                <View style={styles.proBadgeActive}>
                  <Text style={styles.proBadgeActiveIcon}>✅</Text>
                  <Text style={styles.proBadgeActiveText}>
                    Plan {currentPlan?.name || 'Pro'} activo
                  </Text>
                </View>
                <Text style={styles.proIntroText}>
                  Disfrutas de todas las funcionalidades premium de VitalPulse.
                </Text>
                <View style={styles.proFeaturesList}>
                  {PRO_FEATURES.map((f, i) => (
                    <View key={i} style={styles.proFeatureItem}>
                      <Text style={styles.proFeatureIcon}>{f.icon}</Text>
                      <View style={styles.proFeatureTextWrap}>
                        <Text style={styles.proFeatureTitle}>{f.title}</Text>
                        <Text style={styles.proFeatureDesc}>{f.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.proIntroText}>
                  Desbloquea el máximo potencial de VitalPulse. Mide sin límites,
                  exporta tus datos y obtén análisis avanzados.
                </Text>
                <View style={styles.proFeaturesList}>
                  {PRO_FEATURES.map((f, i) => (
                    <View key={i} style={styles.proFeatureItem}>
                      <Text style={styles.proFeatureIcon}>{f.icon}</Text>
                      <View style={styles.proFeatureTextWrap}>
                        <Text style={styles.proFeatureTitle}>{f.title}</Text>
                        <Text style={styles.proFeatureDesc}>{f.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.proActivateBtn}
                  onPress={() => navigation.navigate('Upgrade')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.proActivateBtnIcon}>💎</Text>
                  <Text style={styles.proActivateBtnText}>Activar VitalPulse Pro</Text>
                </TouchableOpacity>
                <Text style={styles.proPriceHint}>
                  Desde {PLANS.monthly.price} o {PLANS.lifetime.price} vitalicio
                </Text>
              </>
            )}
          </AccordionSection>

          {/* ═══════════════════════════════════════════════════════════════════
              2. 🎨 TEMA — Always expanded by default
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedTheme}
            onToggle={() => setExpandedTheme(!expandedTheme)}
            icon="🎨"
            title="Tema"
            colors={colors}
          >
            <Text style={styles.sectionDesc}>
              Elige cómo se ve VitalPulse. El modo "Sistema" sigue la configuración
              de tu dispositivo.
            </Text>
            <View style={styles.themeRow}>
              {THEME_OPTIONS.map((opt) => {
                const isSelected = theme === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.themePill, isSelected && styles.themePillActive]}
                    onPress={() => setTheme(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.themePillIcon}>{opt.icon}</Text>
                    <Text
                      style={[
                        styles.themePillLabel,
                        isSelected && styles.themePillLabelActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.themeHint}>
              Modo actual: {resolvedTheme === 'dark' ? '🌙 Oscuro' : '☀️ Claro'}
            </Text>
          </AccordionSection>

          {/* ═══════════════════════════════════════════════════════════════════
              3. 👤 PERFIL PERSONAL
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedProfile}
            onToggle={() => setExpandedProfile(!expandedProfile)}
            icon="👤"
            title="Perfil personal"
            colors={colors}
          >
            <Text style={styles.sectionDesc}>
              Tus datos demográficos mejoran la precisión de la estimación de
              presión arterial.
            </Text>

            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Tu nombre"
              placeholderTextColor={colors.textMuted}
              maxLength={40}
            />

            <Text style={styles.label}>Edad *</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              placeholder="Años"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={3}
            />

            <Text style={styles.label}>Sexo biológico *</Text>
            <View style={styles.optionRow}>
              {[
                ['male', '👨 Hombre'],
                ['female', '👩 Mujer'],
              ].map(([val, label]) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.optionBtn, sex === val && styles.optionBtnActive]}
                  onPress={() => setSex(val)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      sex === val && styles.optionTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.rowFields}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Peso (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="70"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Estatura (cm)</Text>
                <TextInput
                  style={styles.input}
                  value={height}
                  onChangeText={setHeight}
                  placeholder="170"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
            </View>

            <Text style={styles.label}>Actividad física *</Text>
            <View style={styles.optionRow}>
              {[
                [false, '🛋️ Sedentario'],
                [true, '🏃 Activo'],
              ].map(([val, label]) => (
                <TouchableOpacity
                  key={label}
                  style={[
                    styles.optionBtn,
                    isActive === val && styles.optionBtnActive,
                  ]}
                  onPress={() => setIsActive(val)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isActive === val && styles.optionTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Factores de salud</Text>
            {[
              [smoker, setSmoker, '🚬 Fumador/a'],
              [diabetic, setDiabetic, '💉 Diabetes'],
            ].map(([val, setter, label]) => (
              <TouchableOpacity
                key={label}
                style={styles.checkRow}
                onPress={() => setter(!val)}
              >
                <View style={[styles.checkbox, val && styles.checkboxActive]}>
                  {val && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkLabel}>{label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
              <Text style={styles.saveBtnText}>Guardar perfil</Text>
            </TouchableOpacity>
          </AccordionSection>

          {/* ═══════════════════════════════════════════════════════════════════
              4. 📏 CALIBRACIÓN PA
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedCal}
            onToggle={() => setExpandedCal(!expandedCal)}
            icon="📏"
            title="Calibración PA"
            colors={colors}
          >
            <Text style={styles.sectionDesc}>
              Puedes calibrar la estimación de presión arterial desde la pantalla
              de resultados después de cada medición, introduciendo la lectura de
              tu tensiómetro real.
            </Text>
            {calibration?.points?.length > 0 ? (
              <>
                <View style={styles.calStatus}>
                  <Text style={styles.calStatusText}>
                    ✅ {calibration.points.length} punto
                    {calibration.points.length > 1 ? 's' : ''} de calibración
                    guardado{calibration.points.length > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.calStatusSub}>
                    Último:{' '}
                    {new Date(
                      calibration.points[calibration.points.length - 1].date
                    ).toLocaleDateString('es-ES')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.dangerBtnSmall}
                  onPress={handleClearCalibration}
                >
                  <Text style={styles.dangerBtnSmallText}>
                    Borrar calibración
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.calEmptyText}>
                Sin calibración. Usa el botón en la pantalla de resultados.
              </Text>
            )}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                Preferir calibración por regresión
              </Text>
              <Switch
                value={preferRegression}
                onValueChange={togglePreferRegression}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={
                  preferRegression ? colors.textOnPrimary : colors.textMuted
                }
              />
            </View>
          </AccordionSection>

          {/* ═══════════════════════════════════════════════════════════════════
              5. 🔔 ALERTAS BPM
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedAlerts}
            onToggle={() => setExpandedAlerts(!expandedAlerts)}
            icon="🔔"
            title="Alertas BPM"
            colors={colors}
          >
            <Text style={styles.sectionDesc}>
              Recibe una notificación si tu frecuencia cardíaca supera o baja de
              estos límites.
            </Text>
            <Text style={styles.label}>Alerta BPM alto (por encima de)</Text>
            <TextInput
              style={styles.input}
              value={alertHigh}
              onChangeText={setAlertHigh}
              keyboardType="number-pad"
              maxLength={3}
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Alerta BPM bajo (por debajo de)</Text>
            <TextInput
              style={styles.input}
              value={alertLow}
              onChangeText={setAlertLow}
              keyboardType="number-pad"
              maxLength={3}
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveAlerts}>
              <Text style={styles.saveBtnText}>Guardar alertas</Text>
            </TouchableOpacity>
          </AccordionSection>

          {/* ═══════════════════════════════════════════════════════════════════
              6. 📤 EXPORTAR DATOS
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedExport}
            onToggle={() => setExpandedExport(!expandedExport)}
            icon="📤"
            title="Exportar datos"
            colors={colors}
          >
            <Text style={styles.sectionDesc}>
              Exporta tu historial completo como archivo CSV compatible con Excel,
              Google Sheets y otros programas de análisis.
            </Text>
            {userIsPro ? (
              <TouchableOpacity
                style={styles.exportBtn}
                onPress={handleExportCSV}
              >
                <Text style={styles.exportBtnIcon}>📊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exportBtnTitle}>
                    Exportar historial como CSV
                  </Text>
                  <Text style={styles.exportBtnSub}>
                    {history.length} mediciones · Punto y coma
                  </Text>
                </View>
                <Text style={styles.exportBtnArrow}>→</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.proGateContainer}>
                <View style={styles.proGateBadge}>
                  <Text style={styles.proGateIcon}>💎</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.proGateTitle}>
                      Necesitas VitalPulse Pro para exportar datos CSV
                    </Text>
                    <Text style={styles.proGateDesc}>
                      Actualiza a Pro y obtén exportación ilimitada de tus
                      mediciones, calibración avanzada y más.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.proGateBtn}
                  onPress={() => navigation.navigate('Upgrade')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.proGateBtnIcon}>💎</Text>
                  <Text style={styles.proGateBtnText}>Activar Pro</Text>
                </TouchableOpacity>
              </View>
            )}
          </AccordionSection>

          {/* ═══════════════════════════════════════════════════════════════════
              7. 🔒 GESTIÓN DE DATOS
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedData}
            onToggle={() => setExpandedData(!expandedData)}
            icon="🔒"
            title="Gestión de datos"
            colors={colors}
          >
            <Text style={styles.sectionDesc}>
              VitalPulse prioriza tu privacidad. Aquí te explicamos cómo manejamos
              tu información.
            </Text>
            <View style={styles.privacyCard}>
              <View style={styles.privacyRow}>
                <Text style={styles.privacyIcon}>📱</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.privacyRowTitle}>
                    Almacenamiento local
                  </Text>
                  <Text style={styles.privacyRowDesc}>
                    Todos los datos se guardan únicamente en este dispositivo. Nada
                    se envía a servidores externos.
                  </Text>
                </View>
              </View>
              <View style={styles.privacyDivider} />
              <View style={styles.privacyRow}>
                <Text style={styles.privacyIcon}>🔐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.privacyRowTitle}>
                    Sin registro de cuenta
                  </Text>
                  <Text style={styles.privacyRowDesc}>
                    No necesitas crear una cuenta ni compartir tu correo
                    electrónico. Tu identidad permanece anónima.
                  </Text>
                </View>
              </View>
              <View style={styles.privacyDivider} />
              <View style={styles.privacyRow}>
                <Text style={styles.privacyIcon}>🚫</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.privacyRowTitle}>
                    Sin terceros
                  </Text>
                  <Text style={styles.privacyRowDesc}>
                    No compartimos, vendemos ni transferimos tus datos a ninguna
                    empresa externa.
                  </Text>
                </View>
              </View>
            </View>
          </AccordionSection>

          {/* ═══════════════════════════════════════════════════════════════════
              8. ⚠️ ZONA DE PELIGRO
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedDanger}
            onToggle={() => setExpandedDanger(!expandedDanger)}
            icon="⚠️"
            title="Zona de peligro"
            titleColor={colors.danger}
            borderColor={colors.danger}
            cardStyle={styles.dangerAccordionCard}
            colors={colors}
          >
            <Text style={styles.dangerDesc}>
              Estas acciones son irreversibles. Los datos eliminados no se pueden
              recuperar.
            </Text>

            <TouchableOpacity
              style={styles.dangerAction}
              onPress={handleClearHistory}
            >
              <View style={styles.dangerActionIconWrap}>
                <Text style={styles.dangerActionIcon}>🗑️</Text>
              </View>
              <View style={styles.dangerActionTextWrap}>
                <Text style={styles.dangerActionTitle}>
                  Borrar historial de mediciones
                </Text>
                <Text style={styles.dangerActionSub}>
                  Se eliminarán todas las mediciones guardadas
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dangerActionDestructive}
              onPress={handleClearAll}
            >
              <View style={styles.dangerActionIconWrap}>
                <Text style={styles.dangerActionIcon}>☢️</Text>
              </View>
              <View style={styles.dangerActionTextWrap}>
                <Text style={styles.dangerActionTitleDestructive}>
                  Borrar todos los datos
                </Text>
                <Text style={styles.dangerActionSub}>
                  Mediciones, calibración, perfil y configuración
                </Text>
              </View>
            </TouchableOpacity>
          </AccordionSection>

          {/* ═══════════════════════════════════════════════════════════════════
              9. ℹ️ ACERCA DE
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedAbout}
            onToggle={() => setExpandedAbout(!expandedAbout)}
            icon="ℹ️"
            title="Acerca de VitalPulse"
            colors={colors}
          >
            <View style={styles.aboutCard}>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Versión</Text>
                <Text style={styles.aboutValue}>{APP_VERSION}</Text>
              </View>
              <View style={styles.aboutDivider} />
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Desarrollador</Text>
                <Text style={styles.aboutValue}>{DEVELOPER}</Text>
              </View>
            </View>
          </AccordionSection>

          {/* ─── Banner Ad ─────────────────────────────────────────────────── */}
          <BannerAd />

          {/* ─── Bottom spacing ────────────────────────────────────────────── */}
          <View style={{ height: 20 }} />

          {/* ─── Footer legal links (at end of scroll, not sticky) ─────────── */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => navigation.navigate('PrivacyPolicy')}
              activeOpacity={0.7}
            >
              <Text style={styles.footerLinkText}>Política de Privacidad</Text>
            </TouchableOpacity>
            <Text style={styles.footerDivider}>·</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Terms')}
              activeOpacity={0.7}
            >
              <Text style={styles.footerLinkText}>Términos de Uso</Text>
            </TouchableOpacity>
          </View>

          {/* Extra bottom padding so nothing is cut off */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles factory ──────────────────────────────────────────────────────────────
const createStyles = (colors) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 8 },

  // ─── Logo section ──────────────────────────────────────────────────────────────
  logoSection: { alignItems: 'center', marginBottom: 20, marginTop: 8 },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  logo:        { width: 52, height: 52, borderRadius: 12 },
  appTitle:    { color: colors.textPrimary, fontSize: 26, fontWeight: '700' },
  appVersion:  { color: colors.textMuted, fontSize: 14, marginTop: 2 },

  // ─── Profile status banner ────────────────────────────────────────────────────
  profileStatus: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
  },
  profileStatusOk: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primary + '33',
  },
  profileStatusWarn: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warning + '33',
  },
  profileStatusText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // ─── Section description ──────────────────────────────────────────────────────
  sectionDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },

  // ─── PRO section ──────────────────────────────────────────────────────────────
  proAccordionCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  proIntroText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  proFeaturesList: {
    gap: 10,
    marginBottom: 16,
  },
  proFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primarySubtle,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.primaryMuted + '44',
  },
  proFeatureIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  proFeatureTextWrap: { flex: 1 },
  proFeatureTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  proFeatureDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  proBadgeActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.success + '44',
  },
  proBadgeActiveIcon: { fontSize: 18 },
  proBadgeActiveText: {
    color: colors.successDark,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  proActivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  proActivateBtnIcon: { fontSize: 18 },
  proActivateBtnText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  proPriceHint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },

  // ─── Theme toggle ──────────────────────────────────────────────────────────────
  themeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
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
  themeHint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },

  // ─── Form fields ──────────────────────────────────────────────────────────────
  label: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 10,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowFields:   { flexDirection: 'row', marginTop: 4 },
  optionRow:   { flexDirection: 'row', gap: 10, marginBottom: 4 },
  optionBtn: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText:  { color: colors.textSecondary, fontSize: 14 },
  optionTextActive: { color: colors.textOnPrimary, fontWeight: '600' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark:   { color: colors.textOnPrimary, fontSize: 13, fontWeight: '700' },
  checkLabel:  { color: colors.textPrimary, fontSize: 14 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '600' },

  // ─── Calibration ──────────────────────────────────────────────────────────────
  calStatus: {
    backgroundColor: colors.primarySubtle,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  calStatusText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  calStatusSub:  { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  calEmptyText:  { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 2,
  },
  switchLabel: { color: colors.textPrimary, fontSize: 14, flex: 1, marginRight: 12 },

  // ─── Danger buttons (small) ────────────────────────────────────────────────────
  dangerBtnSmall: {
    backgroundColor: colors.dangerLight,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dangerLight,
  },
  dangerBtnSmallText: { color: colors.danger, fontSize: 14, fontWeight: '600' },

  // ─── Export ────────────────────────────────────────────────────────────────────
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  exportBtnIcon:   { fontSize: 20 },
  exportBtnTitle:  { color: colors.primary, fontSize: 14, fontWeight: '600' },
  exportBtnSub:    { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  exportBtnArrow:  { color: colors.primary, fontSize: 16, fontWeight: '600' },

  // ─── Pro gate (inline, no Alert.alert) ────────────────────────────────────────
  proGateContainer: {
    backgroundColor: colors.primarySubtle,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.primaryMuted,
  },
  proGateBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  proGateIcon: { fontSize: 24 },
  proGateTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  proGateDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  proGateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  proGateBtnIcon: { fontSize: 16 },
  proGateBtnText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },

  // ─── Privacy data management ──────────────────────────────────────────────────
  privacyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  privacyIcon:    { fontSize: 18, width: 26, textAlign: 'center' },
  privacyRowTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  privacyRowDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  privacyDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },
  privacyFooter: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // ─── Danger zone (inside accordion) ───────────────────────────────────────────
  dangerAccordionCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  dangerDesc: {
    color: colors.dangerDark,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
    fontWeight: '500',
  },
  dangerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.dangerLight,
  },
  dangerActionDestructive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.danger,
  },
  dangerActionIconWrap:  { width: 32, alignItems: 'center' },
  dangerActionIcon:      { fontSize: 20 },
  dangerActionTextWrap:  { flex: 1 },
  dangerActionTitle:     { color: colors.danger, fontSize: 14, fontWeight: '600' },
  dangerActionTitleDestructive: {
    color: colors.dangerDark,
    fontSize: 15,
    fontWeight: '700',
  },
  dangerActionSub: { color: colors.dangerDark, fontSize: 12, marginTop: 2 },

  // ─── About ─────────────────────────────────────────────────────────────────────
  aboutCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  aboutDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  aboutLabel: { color: colors.textSecondary, fontSize: 13 },
  aboutValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  aboutDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
  },

  // ─── Footer (end of scroll, not sticky) ────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
  },
  footerLinkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  footerDivider: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
