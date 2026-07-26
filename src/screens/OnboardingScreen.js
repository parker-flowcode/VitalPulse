/**
 * OnboardingScreen.js — VitalPulse v5.0
 *
 * Tutorial de bienvenida con formulario de perfil personal.
 * Soporta tema dinamico mediante ThemeContext.
 */
import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Dimensions,
  FlatList, KeyboardAvoidingView, Platform,
  Alert, Image,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import useHealthStore from '../store/healthstore';
import { SPACING, RADIUS } from '../theme/designTokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Datos de los pasos del tutorial ─────────────────────────────────────────
const TUTORIAL_SLIDES = [
  {
    icon:  'heart',
    title: 'Bienvenido a VitalPulse',
    body:  'Tu monitor cardiovascular personal. Mide tu frecuencia cardiaca y estima tu presion arterial usando unicamente la camara de tu movil.',
  },
  {
    icon:  'camera',
    title: 'Como funciona',
    body:  'Coloca el dedo indice sobre la camara trasera y el flash. La luz del flash atraviesa tu dedo y la camara detecta las pulsaciones de tu sangre en tiempo real.',
  },
  {
    icon:  'target',
    title: 'Para mayor precision',
    body:  'Manten el movil apoyado en una superficie durante la medicion. Cuantos mas datos personales nos des, mas precisa sera la estimacion de tu presion arterial.',
  },
];

export default function OnboardingScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { updateUserProfile, setOnboardingDone, setTermsAccepted } = useHealthStore();

  const [step, setStep]       = useState(0); // 0-3: tutorial, 4: datos usuario
  const flatListRef           = useRef(null);

  // Datos del perfil
  const [name, setName]       = useState('');
  const [age, setAge]         = useState('');
  const [sex, setSex]         = useState(null);   // 'male' | 'female'
  const [weight, setWeight]   = useState('');
  const [height, setHeight]   = useState('');
  const [isActive, setIsActive] = useState(null);  // true | false
  const [smoker, setSmoker]   = useState(false);
  const [diabetic, setDiabetic] = useState(false);
  const [termsAccepted, setTermsAcceptedState] = useState(false);
  const [showTermsSubmenu, setShowTermsSubmenu] = useState(false);

  const isTutorial = step < TUTORIAL_SLIDES.length;

  const goNext = () => {
    if (step < TUTORIAL_SLIDES.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      flatListRef.current?.scrollToIndex({ index: nextStep, animated: true });
    } else if (step === TUTORIAL_SLIDES.length - 1) {
      setStep(TUTORIAL_SLIDES.length); // Pasar a formulario
    }
  };

  const handleFinish = async () => {
    if (!termsAccepted) {
      Alert.alert('Terminos y condiciones', 'Debes aceptar los Terminos de Uso y la Politica de Privacidad para continuar.');
      return;
    }
    // Guardar perfil con los datos introducidos
    await updateUserProfile({
      name:     name.trim(),
      age:      age ? parseInt(age, 10) : null,
      sex:      sex,
      weight:   weight ? parseFloat(weight) : null,
      height:   height ? parseFloat(height) : null,
      isActive: isActive === true,
      smoker,
      diabetic,
    });
    // Guardar aceptacion de terminos
    await setTermsAccepted(true);
    await setOnboardingDone();
    // Navegar a la app principal
    navigation.replace('Main');
  };

  // ─── Tutorial slides ────────────────────────────────────────────────────
  if (isTutorial) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <FlatList
          ref={flatListRef}
          data={TUTORIAL_SLIDES}
          keyExtractor={(_, i) => i.toString()}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={[styles.slide, { backgroundColor: colors.bg }]}>
              {index === 0 && (
                <Image source={require('../../assets/icon.png')} style={styles.slideLogo} />
              )}
              <Icon name={item.icon} size={80} color={colors.primary} style={{marginBottom: 28}} />
              <Text style={[styles.slideTitle, { color: colors.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.slideBody, { color: colors.textSecondary }]}>{item.body}</Text>
            </View>
          )}
        />

        {/* Indicadores de paso */}
        <View style={styles.dotsContainer}>
          {TUTORIAL_SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === step && styles.dotActive]}
            />
          ))}
        </View>

        <View style={styles.tutorialFooter}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={goNext}
          >
            <Text style={[styles.primaryBtnText, { color: colors.textOnPrimary }]}>
              {step < TUTORIAL_SLIDES.length - 1 ? 'Siguiente' : 'Personalizar mi perfil'}
            </Text>
          </TouchableOpacity>
          {step < TUTORIAL_SLIDES.length - 1 && (
            <TouchableOpacity onPress={() => setStep(TUTORIAL_SLIDES.length)}>
              <Text style={[styles.skipText, { color: colors.textMuted }]}>Saltar tutorial</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ─── Formulario de perfil ────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.formScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.formTitle, { color: colors.textPrimary }]}>Tu perfil personal</Text>
          <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>
            Estos datos mejoran significativamente la precision de las estimaciones.
            Puedes cambiarlos en cualquier momento desde Ajustes.
          </Text>

          {/* Nombre */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.primary }]}>Nombre (opcional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              placeholder="Como te llamas?"
              placeholderTextColor={colors.textMuted}
              maxLength={40}
            />
          </View>

          {/* Edad */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.primary }]}>Edad *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.border }]}
              value={age}
              onChangeText={setAge}
              placeholder="Anos"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
              La edad es el factor mas importante para estimar la PA
            </Text>
          </View>

          {/* Sexo */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.primary }]}>Sexo biologico *</Text>
            <View style={styles.optionRow}>
              <TouchableOpacity
                style={[styles.optionBtn, sex === 'male' && styles.optionBtnActive]}
                onPress={() => setSex('male')}
              >
                <View style={styles.optionBtnContent}>
                  <Icon name="account" size={15} color={sex === 'male' ? colors.textOnPrimary : colors.textSecondary} />
                  <Text style={[styles.optionBtnText, sex === 'male' && styles.optionBtnTextActive]}> Hombre</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionBtn, sex === 'female' && styles.optionBtnActive]}
                onPress={() => setSex('female')}
              >
                <View style={styles.optionBtnContent}>
                  <Icon name="account" size={15} color={sex === 'female' ? colors.textOnPrimary : colors.textSecondary} />
                  <Text style={[styles.optionBtnText, sex === 'female' && styles.optionBtnTextActive]}> Mujer</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Peso y talla */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.primary }]}>Peso y estatura</Text>
            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Peso (kg)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.border }]}
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
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Estatura (cm)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                  value={height}
                  onChangeText={setHeight}
                  placeholder="170"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
            </View>
          </View>

          {/* Actividad fisica */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.primary }]}>Actividad fisica *</Text>
            <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
              Las personas activas tienen la PA mas baja en reposo
            </Text>
            <View style={styles.optionRow}>
              <TouchableOpacity
                style={[styles.optionBtn, isActive === false && styles.optionBtnActive]}
                onPress={() => setIsActive(false)}
              >
                <View style={styles.optionBtnContent}>
                  <Icon name="sofa" size={15} color={isActive === false ? colors.textOnPrimary : colors.textSecondary} />
                  <Text style={[styles.optionBtnText, isActive === false && styles.optionBtnTextActive]}> Sedentario</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionBtn, isActive === true && styles.optionBtnActive]}
                onPress={() => setIsActive(true)}
              >
                <View style={styles.optionBtnContent}>
                  <Icon name="run" size={15} color={isActive === true ? colors.textOnPrimary : colors.textSecondary} />
                  <Text style={[styles.optionBtnText, isActive === true && styles.optionBtnTextActive]}> Activo</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Factores de riesgo */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.primary }]}>Factores de salud (opcional)</Text>
            <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>Ayudan a interpretar mejor los resultados</Text>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setSmoker(!smoker)}
            >
              <View style={[styles.checkbox, { borderColor: colors.border }, smoker && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {smoker && <Text style={styles.checkmark}>{'✓'}</Text>}
              </View>
              <View style={styles.checkLabelContent}>
                <Icon name="smoking" size={16} color={smoker ? colors.primary : colors.textMuted} style={{marginRight: 6}} />
                <Text style={[styles.checkLabel, { color: colors.textPrimary }]}>Fumador/a</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setDiabetic(!diabetic)}
            >
              <View style={[styles.checkbox, { borderColor: colors.border }, diabetic && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {diabetic && <Text style={styles.checkmark}>{'✓'}</Text>}
              </View>
              <View style={styles.checkLabelContent}>
                <Icon name="needle" size={16} color={diabetic ? colors.primary : colors.textMuted} style={{marginRight: 6}} />
                <Text style={[styles.checkLabel, { color: colors.textPrimary }]}>Diabetes</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Aceptacion de terminos */}
          <View style={styles.termsSection}>
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setTermsAcceptedState(!termsAccepted)}
            >
              <View style={[styles.checkbox, { borderColor: colors.border }, termsAccepted && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {termsAccepted && <Text style={styles.checkmark}>{'✓'}</Text>}
              </View>
              <Text style={[styles.checkLabel, { color: colors.textPrimary }]}>Acepto los Terminos de Uso y la Politica de Privacidad</Text>
            </TouchableOpacity>
            <View style={styles.termsLinks}>
              <TouchableOpacity onPress={() => setShowTermsSubmenu(!showTermsSubmenu)}>
                <View style={styles.linkRow}>
                  <Icon name="file-document" size={14} color={colors.primary} />
                  <Text style={[styles.linkText, { color: colors.primary }]}> Ver documentos legales</Text>
                </View>
              </TouchableOpacity>
              {showTermsSubmenu && (
                <View style={[styles.termsSubmenu, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={styles.termsSubmenuItem}
                    onPress={() => navigation.navigate('Terms')}
                  >
                    <View style={styles.linkRow}>
                      <Icon name="clipboard-text" size={14} color={colors.primary} />
                      <Text style={[styles.termsSubmenuText, { color: colors.primary }]}> Terminos de Uso</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.termsSubmenuItem}
                    onPress={() => navigation.navigate('PrivacyPolicy')}
                  >
                    <View style={styles.linkRow}>
                      <Icon name="shield-lock" size={14} color={colors.primary} />
                      <Text style={[styles.termsSubmenuText, { color: colors.primary }]}> Politica de Privacidad</Text>
                    </View>
                  </TouchableOpacity>
                  <Text style={[styles.termsSubmenuHint, { color: colors.textMuted }]}>
                    Pulsa el boton "Volver" de la pantalla de terminos para regresar aqui.
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Boton finalizar */}
          <TouchableOpacity
            style={[styles.finishBtn, { backgroundColor: colors.primary }]}
            onPress={handleFinish}
          >
            <View style={styles.finishBtnContent}>
              {age && sex && isActive !== null && (
                <Icon name="check-circle" size={17} color={colors.textOnPrimary} />
              )}
              <Text style={[styles.finishBtnText, { color: colors.textOnPrimary }]}>
                {age && sex && isActive !== null ? ' Empezar a usar VitalPulse' : 'Continuar sin perfil completo'}
              </Text>
            </View>
          </TouchableOpacity>

          {age && sex && isActive !== null && (
            <View style={styles.profileCompleteRow}>
              <Icon name="crown" size={14} color={colors.primary} />
              <Text style={[styles.profileComplete, { color: colors.primary }]}> Perfil completo — maxima precision activada</Text>
            </View>
          )}

          <View style={styles.privacyNoteRow}>
            <Icon name="shield-lock" size={12} color={colors.textMuted} />
            <Text style={[styles.privacyNote, { color: colors.textMuted }]}> Todos los datos se guardan unicamente en tu dispositivo. Nunca se envian a ningun servidor.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles factory ────────────────────────────────────────────────────────────
const createStyles = (colors) => StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.bg },
  // Tutorial
  slide:        { width: SCREEN_WIDTH, paddingHorizontal: 32, paddingTop: 80, alignItems: 'center' },
  slideLogo:    { width: 64, height: 64, marginBottom: 16, resizeMode: 'contain' },
  slideTitle:   { color: colors.textPrimary, fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  slideBody:    { color: colors.textSecondary, fontSize: 16, textAlign: 'center', lineHeight: 26 },
  dotsContainer:{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 32 },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive:    { backgroundColor: colors.primary, width: 24 },
  tutorialFooter: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  primaryBtn:   { backgroundColor: colors.primary, borderRadius: 16, padding: 18, alignItems: 'center' },
  primaryBtnText: { color: colors.textOnPrimary, fontSize: 17, fontWeight: '700' },
  skipText:     { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  // Formulario
  formScroll:   { padding: 24, paddingBottom: 48 },
  formTitle:    { color: colors.textPrimary, fontSize: 26, fontWeight: '700', marginBottom: 8 },
  formSubtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 28 },
  fieldGroup:   { marginBottom: 24 },
  fieldLabel:   { color: colors.primary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  fieldHint:    { color: colors.textSecondary, fontSize: 12, marginBottom: 10, lineHeight: 18 },
  inputLabel:   { color: colors.textSecondary, fontSize: 12, marginBottom: 6 },
  input:        { backgroundColor: colors.bgSecondary, borderRadius: 12, padding: 14, color: colors.textPrimary, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  rowInputs:    { flexDirection: 'row' },
  optionRow:    { flexDirection: 'row', gap: 12 },
  optionBtn:    { flex: 1, backgroundColor: colors.bg, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  optionBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionBtnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  optionBtnText:   { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  optionBtnTextActive: { color: colors.textOnPrimary },
  termsSection: { marginBottom: 24 },
  termsLinks: { marginLeft: 36, marginTop: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'center' },
  termsSubmenu: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 12, marginTop: 8, borderWidth: 1, borderColor: colors.border },
  termsSubmenuItem: { paddingVertical: 8, paddingHorizontal: 4 },
  termsSubmenuText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  termsSubmenuHint: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 16 },
  linkText:     { color: colors.primary, fontSize: 14, fontWeight: '600' },
  checkRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  checkLabelContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  checkbox:     { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  checkmark:    { color: colors.textOnPrimary, fontSize: 14, fontWeight: '700' },
  checkLabel:   { color: colors.textPrimary, fontSize: 15 },
  finishBtn:    { backgroundColor: colors.primary, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 8, marginBottom: 12 },
  finishBtnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  finishBtnText:{ color: colors.textOnPrimary, fontSize: 17, fontWeight: '700' },
  profileCompleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  profileComplete: { color: colors.primary, fontSize: 13, textAlign: 'center' },
  privacyNoteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  privacyNote:  { color: colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
