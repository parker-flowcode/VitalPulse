/**
 * SettingsScreen.js — VitalPulse v9.0
 *
 * Premium accordion-style settings with dynamic Sky Blue theme.
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform, Switch, Image,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import useHealthStore from '../store/healthstore';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../theme/LanguageContext';
import { generateCSV, shareCSV, getExportFilename } from '../services/exportService';
import { isPro, getCurrentPlan, PLANS } from '../services/subscriptions';
import BottomWarningAdWrapper from '../components/BottomWarningAdWrapper';
import { SPACING, RADIUS, SHADOWS } from '../theme/designTokens';

// ─── Constants ───────────────────────────────────────────────────────────────────
const THEME_OPTIONS = [
  { key: 'system', label: 'Sistema', icon: 'cellphone' },
  { key: 'light',  label: 'Claro',   icon: 'weather-sunny' },
  { key: 'dark',   label: 'Oscuro',  icon: 'weather-night' },
];

const PRO_FEATURES = [
  { icon: 'chart-bar', title: 'Mediciones ilimitadas',         desc: 'Sin limite diario de mediciones' },
  { icon: 'chart-line', title: 'Calibración avanzada',           desc: 'Calibración multi-punto con regresión' },
  { icon: 'share-variant', title: 'Exportacion a CSV',               desc: 'Descarga tus datos completos' },
  { icon: 'chart-line', title: 'Graficas de tendencias',          desc: 'Visualiza tu evolucion cardiovascular' },
  { icon: 'target', title: 'Metricas de calidad',             desc: 'SNR y metricas avanzadas de senal' },
  { icon: 'close-circle', title: 'Sin anuncios',                    desc: 'Experiencia limpia y sin distracciones' },
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
        <Icon name={icon} size={20} color={colors.textPrimary} style={{width: 28, textAlign: 'center'}} />
        <Text style={[
          accordionHeaderTitle(colors),
          titleColor ? { color: titleColor } : null,
        ]}>{title}</Text>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
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

const accordionHeaderTitle = (colors) => ({
  flex: 1,
  fontSize: 15,
  fontWeight: '700',
  color: colors.textPrimary,
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
  const { lang, setLang } = useLanguage();
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
  const [expandedLang,    setExpandedLang]    = useState(false);
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
      Alert.alert('Edad invalida', 'Introduce una edad entre 5 y 120 anios.');
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
    Alert.alert('Guardado', 'Perfil actualizado. Las proximas mediciones seran mas precisas.');
  };

  const saveAlerts = () => {
    const high = parseInt(alertHigh, 10);
    const low  = parseInt(alertLow, 10);
    if (isNaN(high) || isNaN(low) || low >= high) {
      Alert.alert('Invalido', 'El BPM alto debe ser mayor que el BPM bajo.');
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
      'Eliminar todos los puntos de calibración de PA?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: clearCalibration },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Borrar todos los datos',
      'Se eliminaran mediciones, calibración, perfil y configuración. Esta accion no se puede deshacer.',
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
      'Eliminar todas las mediciones guardadas?',
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
        Alert.alert('Exportado', 'Historial compartido como ' + filename);
      } else {
        Alert.alert('Exportacion cancelada', 'No se pudo completar la exportacion.');
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{flex: 1}}
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
                ? 'Perfil completo — maxima precision activa'
                : 'Perfil incompleto — completalo para mayor precision'}
            </Text>
          </View>

          {/* ═══════════════════════════════════════════════════════════════════
              1. VITALPULSE PRO — Always at the very top
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedPro}
            onToggle={() => setExpandedPro(!expandedPro)}
            icon="crown"
            title={userIsPro ? 'VitalPulse Pro — Activo' : 'VitalPulse Pro'}
            titleColor={colors.primary}
            borderColor={colors.primary}
            cardStyle={styles.proAccordionCard}
            colors={colors}
          >
            {userIsPro ? (
              <>
                <View style={styles.proBadgeActive}>
                  <Icon name="check-circle" size={18} color={colors.successDark} />
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
                      <Icon name={f.icon} size={18} color={colors.primary} />
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
                  Desbloquea el maximo potencial de VitalPulse. Mide sin limites,
                  exporta tus datos y obten análisis avanzados.
                </Text>
                <View style={styles.proFeaturesList}>
                  {PRO_FEATURES.map((f, i) => (
                    <View key={i} style={styles.proFeatureItem}>
                      <Icon name={f.icon} size={18} color={colors.primary} />
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
                  <Icon name="crown" size={18} color={colors.textOnPrimary} />
                  <Text style={styles.proActivateBtnText}>  Activar VitalPulse Pro</Text>
                </TouchableOpacity>
                <Text style={styles.proPriceHint}>
                  Desde {PLANS.monthly.price} o {PLANS.lifetime.price} vitalicio
                </Text>
              </>
            )}
          </AccordionSection>

          {/* ═══════════════════════════════════════════════════════════════════
              2. TEMA — Always expanded by default
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedTheme}
            onToggle={() => setExpandedTheme(!expandedTheme)}
            icon="palette"
            title="Tema"
            colors={colors}
          >
            <Text style={styles.sectionDesc}>
              Elige como se ve VitalPulse. El modo "Sistema" sigue la configuracion
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
                    <Icon name={opt.icon} size={18} color={isSelected ? colors.textOnPrimary : colors.textSecondary} />
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
            <View style={styles.themeHintRow}>
              <Icon name={resolvedTheme === 'dark' ? 'weather-night' : 'weather-sunny'} size={12} color={colors.textMuted} />
              <Text style={styles.themeHint}>
                Modo actual: {resolvedTheme === 'dark' ? ' Oscuro' : ' Claro'}
              </Text>
            </View>
          </AccordionSection>

          {/* ═══════════════════════════════════════════════════════════════════
              3. IDIOMA / LANGUAGE
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedLang}
            onToggle={() => setExpandedLang(!expandedLang)}
            icon="translate"
            title="🌐 Idioma / Language"
            colors={colors}
          >
            <Text style={styles.sectionDesc}>
              Selecciona el idioma de la aplicacion. / Select the app language.
            </Text>
            <View style={styles.themeRow}>
              <TouchableOpacity
                style={[styles.themePill, lang === 'es' && styles.themePillActive]}
                onPress={() => setLang('es')}
                activeOpacity={0.7}
              >
                <Icon name="earth" size={18} color={lang === 'es' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.themePillLabel, lang === 'es' && styles.themePillLabelActive]}>
                  Español
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.themePill, lang === 'en' && styles.themePillActive]}
                onPress={() => setLang('en')}
                activeOpacity={0.7}
              >
                <Icon name="earth" size={18} color={lang === 'en' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.themePillLabel, lang === 'en' && styles.themePillLabelActive]}>
                  English
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.themeHintRow}>
              <Icon name="earth" size={12} color={colors.textMuted} />
              <Text style={styles.themeHint}>
                Actual: {lang === 'es' ? 'Español' : 'English'}
              </Text>
            </View>
          </AccordionSection>

          {/* ═══════════════════════════════════════════════════════════════════
              4. PERFIL PERSONAL
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedProfile}
            onToggle={() => setExpandedProfile(!expandedProfile)}
            icon="account"
            title="Perfil personal"
            colors={colors}
          >
            <Text style={styles.sectionDesc}>
              Tus datos demograficos mejoran la precision de la estimacion de
              presion arterial.
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
              placeholder="Anios"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={3}
            />

            <Text style={styles.label}>Sexo biologico *</Text>
            <View style={styles.optionRow}>
              {[
                ['male', 'Hombre'],
                ['female', 'Mujer'],
              ].map(([val, label]) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.optionBtn, sex === val && styles.optionBtnActive]}
                  onPress={() => setSex(val)}
                >
                  <View style={styles.optionBtnContent}>
                    <Icon name="account" size={15} color={sex === val ? colors.textOnPrimary : colors.textSecondary} />
                    <Text
                      style={[
                        styles.optionText,
                        sex === val && styles.optionTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
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

            <Text style={styles.label}>Actividad fisica *</Text>
            <View style={styles.optionRow}>
              {[
                [false, 'sofa', 'Sedentario'],
                [true, 'run', 'Activo'],
              ].map(([val, iconName, label]) => (
                <TouchableOpacity
                  key={label}
                  style={[
                    styles.optionBtn,
                    isActive === val && styles.optionBtnActive,
                  ]}
                  onPress={() => setIsActive(val)}
                >
                  <View style={styles.optionBtnContent}>
                    <Icon name={iconName} size={15} color={isActive === val ? colors.textOnPrimary : colors.textSecondary} />
                    <Text
                      style={[
                        styles.optionText,
                        isActive === val && styles.optionTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Factores de salud</Text>
            {[
              [smoker, setSmoker, 'smoking', 'Fumador/a'],
              [diabetic, setDiabetic, 'needle', 'Diabetes'],
            ].map(([val, setter, iconName, label]) => (
              <TouchableOpacity
                key={label}
                style={styles.checkRow}
                onPress={() => setter(!val)}
              >
                <View style={[styles.checkbox, val && styles.checkboxActive]}>
                  {val && <Text style={styles.checkmark}>{'✓'}</Text>}
                </View>
                <View style={styles.checkLabelRow}>
                  <Icon name={iconName} size={16} color={val ? colors.primary : colors.textMuted} style={{marginRight: 6}} />
                  <Text style={styles.checkLabel}>{label}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
              <Text style={styles.saveBtnText}>Guardar perfil</Text>
            </TouchableOpacity>
          </AccordionSection>

          {/* ═══════════════════════════════════════════════════════════════════
              5. CALIBRACIÓN PA
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedCal}
            onToggle={() => setExpandedCal(!expandedCal)}
            icon="ruler"
            title="Calibración PA"
            colors={colors}
          >
            <Text style={styles.sectionDesc}>
              Puedes calibrar la estimacion de presion arterial desde la pantalla
              de resultados despues de cada medición, introduciendo la lectura de
              tu tensiometro real.
            </Text>
            {calibration?.points?.length > 0 ? (
              <>
                <View style={styles.calStatus}>
                  <View style={styles.calStatusRow}>
                    <Icon name="check-circle" size={14} color={colors.primary} />
                    <Text style={styles.calStatusText}>
                      {' '}{calibration.points.length} punto
                      {calibration.points.length > 1 ? 's' : ''} de calibración
                      guardado{calibration.points.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={styles.calStatusSub}>
                    Ultimo:{' '}
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
                Sin calibración. Usa el boton en la pantalla de resultados.
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
              6. ALERTAS BPM
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedAlerts}
            onToggle={() => setExpandedAlerts(!expandedAlerts)}
            icon="bell"
            title="Alertas BPM"
            colors={colors}
          >
            <Text style={styles.sectionDesc}>
              Recibe una notificacion si tu frecuencia cardíaca supera o baja de
              estos limites.
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
              7. EXPORTAR DATOS
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedExport}
            onToggle={() => setExpandedExport(!expandedExport)}
            icon="share-variant"
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
                <Icon name="chart-bar" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.exportBtnTitle}>
                    Exportar historial como CSV
                  </Text>
                  <Text style={styles.exportBtnSub}>
                    {history.length} mediciones · Punto y coma
                  </Text>
                </View>
                <Text style={styles.exportBtnArrow}>{'→'}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.proGateContainer}>
                <View style={styles.proGateBadge}>
                  <Icon name="crown" size={24} color={colors.primary} style={{marginRight: 12}} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.proGateTitle}>
                      Necesitas VitalPulse Pro para exportar datos CSV
                    </Text>
                    <Text style={styles.proGateDesc}>
                      Actualiza a Pro y obten exportacion ilimitada de tus
                      mediciones, calibración avanzada y mas.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.proGateBtn}
                  onPress={() => navigation.navigate('Upgrade')}
                  activeOpacity={0.8}
                >
                  <Icon name="crown" size={16} color={colors.textOnPrimary} />
                  <Text style={styles.proGateBtnText}>  Activar Pro</Text>
                </TouchableOpacity>
              </View>
            )}
          </AccordionSection>

          {/* ═══════════════════════════════════════════════════════════════════
              8. GESTION DE DATOS
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedData}
            onToggle={() => setExpandedData(!expandedData)}
            icon="shield-lock"
            title="Gestion de datos"
            colors={colors}
          >
            <Text style={styles.sectionDesc}>
              VitalPulse prioriza tu privacidad. Aqui te explicamos como manejamos
              tu informacion.
            </Text>
            <View style={styles.privacyCard}>
              <View style={styles.privacyRow}>
                <Icon name="cellphone" size={18} color={colors.textSecondary} style={{width: 26, textAlign: 'center'}} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.privacyRowTitle}>
                    Almacenamiento local
                  </Text>
                  <Text style={styles.privacyRowDesc}>
                    Todos los datos se guardan unicamente en este dispositivo. Nada
                    se envia a servidores externos.
                  </Text>
                </View>
              </View>
              <View style={styles.privacyDivider} />
              <View style={styles.privacyRow}>
                <Icon name="shield-lock" size={18} color={colors.textSecondary} style={{width: 26, textAlign: 'center'}} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.privacyRowTitle}>
                    Sin registro de cuenta
                  </Text>
                  <Text style={styles.privacyRowDesc}>
                    No necesitas crear una cuenta ni compartir tu correo
                    electronico. Tu identidad permanece anonima.
                  </Text>
                </View>
              </View>
              <View style={styles.privacyDivider} />
              <View style={styles.privacyRow}>
                <Icon name="close-circle" size={18} color={colors.textSecondary} style={{width: 26, textAlign: 'center'}} />
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
              9. ZONA DE PELIGRO
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedDanger}
            onToggle={() => setExpandedDanger(!expandedDanger)}
            icon="alert"
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
                <Icon name="delete" size={20} color={colors.danger} />
              </View>
              <View style={styles.dangerActionTextWrap}>
                <Text style={styles.dangerActionTitle}>
                  Borrar historial de mediciones
                </Text>
                <Text style={styles.dangerActionSub}>
                  Se eliminaran todas las mediciones guardadas
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dangerActionDestructive}
              onPress={handleClearAll}
            >
              <View style={styles.dangerActionIconWrap}>
                <Icon name="radioactive" size={20} color={colors.dangerDark} />
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
              10. ACERCA DE
              ═══════════════════════════════════════════════════════════════════ */}
          <AccordionSection
            expanded={expandedAbout}
            onToggle={() => setExpandedAbout(!expandedAbout)}
            icon="information"
            title="Acerca de VitalPulse"
            colors={colors}
          >
            <View style={styles.aboutCard}>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Version</Text>
                <Text style={styles.aboutValue}>{APP_VERSION}</Text>
              </View>
              <View style={styles.aboutDivider} />
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Desarrollador</Text>
                <Text style={styles.aboutValue}>{DEVELOPER}</Text>
              </View>
            </View>
          </AccordionSection>

          {/* ─── Footer legal links (at end of scroll, not sticky) ─────────── */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => navigation.navigate('PrivacyPolicy')}
              activeOpacity={0.7}
            >
              <Text style={styles.footerLinkText}>Politica de Privacidad</Text>
            </TouchableOpacity>
            <Text style={styles.footerDivider}>·</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Terms')}
              activeOpacity={0.7}
            >
              <Text style={styles.footerLinkText}>Terminos de Uso</Text>
            </TouchableOpacity>
          </View>

          {/* Extra bottom padding so nothing is cut off */}
          <View style={{ height: 40 }} />
          <BottomWarningAdWrapper />
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
  themePillLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  themePillLabelActive: {
    color: colors.textOnPrimary,
  },
  themeHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    gap: 4,
  },
  themeHint: {
    color: colors.textMuted,
    fontSize: 12,
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
  optionBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  checkLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  calStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginBottom: 14,
  },
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
