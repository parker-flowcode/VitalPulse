import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Dimensions,
  FlatList, KeyboardAvoidingView, Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useHealthStore from '../store/healthstore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Datos de los pasos del tutorial ─────────────────────────────────────────
const TUTORIAL_SLIDES = [
  {
    icon:  '💚',
    title: 'Bienvenido a VitalPulse',
    body:  'Tu monitor cardiovascular personal. Mide tu frecuencia cardíaca y estima tu presión arterial usando únicamente la cámara de tu móvil.',
  },
  {
    icon:  '📷',
    title: 'Cómo funciona',
    body:  'Coloca el dedo índice sobre la cámara trasera y el flash. La luz del flash atraviesa tu dedo y la cámara detecta las pulsaciones de tu sangre en tiempo real.',
  },
  {
    icon:  '🎯',
    title: 'Para mayor precisión',
    body:  'Mantén el móvil apoyado en una superficie durante la medición. Cuantos más datos personales nos des, más precisa será la estimación de tu presión arterial.',
  },
  {
    icon:  '⚕️',
    title: 'Aviso importante',
    body:  'VitalPulse es una herramienta de seguimiento personal. No es un dispositivo médico certificado y no sustituye el diagnóstico clínico. Consulta siempre a tu médico.',
  },
];

export default function OnboardingScreen({ navigation }) {
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
      Alert.alert('Términos y condiciones', 'Debes aceptar los Términos de Uso y la Política de Privacidad para continuar.');
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
    // Guardar aceptación de términos
    await setTermsAccepted(true);
    await setOnboardingDone();
    // Navegar a la app principal
    navigation.replace('Main');
  };

  // ─── Tutorial slides ────────────────────────────────────────────────────
  if (isTutorial) {
    return (
      <SafeAreaView style={styles.safe}>
        <FlatList
          ref={flatListRef}
          data={TUTORIAL_SLIDES}
          keyExtractor={(_, i) => i.toString()}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Text style={styles.slideIcon}>{item.icon}</Text>
              <Text style={styles.slideTitle}>{item.title}</Text>
              <Text style={styles.slideBody}>{item.body}</Text>
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
          <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
            <Text style={styles.primaryBtnText}>
              {step < TUTORIAL_SLIDES.length - 1 ? 'Siguiente →' : 'Personalizar mi perfil'}
            </Text>
          </TouchableOpacity>
          {step < TUTORIAL_SLIDES.length - 1 && (
            <TouchableOpacity onPress={() => setStep(TUTORIAL_SLIDES.length)}>
              <Text style={styles.skipText}>Saltar tutorial</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ─── Formulario de perfil ────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.formScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.formTitle}>Tu perfil personal</Text>
          <Text style={styles.formSubtitle}>
            Estos datos mejoran significativamente la precisión de las estimaciones.
            Puedes cambiarlos en cualquier momento desde Ajustes.
          </Text>

          {/* Nombre */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Nombre (opcional)</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="¿Cómo te llamas?"
              placeholderTextColor="#4A6A67"
              maxLength={40}
            />
          </View>

          {/* Edad */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Edad *</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              placeholder="Años"
              placeholderTextColor="#4A6A67"
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={styles.fieldHint}>
              La edad es el factor más importante para estimar la PA
            </Text>
          </View>

          {/* Sexo */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Sexo biológico *</Text>
            <View style={styles.optionRow}>
              <TouchableOpacity
                style={[styles.optionBtn, sex === 'male' && styles.optionBtnActive]}
                onPress={() => setSex('male')}
              >
                <Text style={[styles.optionBtnText, sex === 'male' && styles.optionBtnTextActive]}>
                  👨 Hombre
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionBtn, sex === 'female' && styles.optionBtnActive]}
                onPress={() => setSex('female')}
              >
                <Text style={[styles.optionBtnText, sex === 'female' && styles.optionBtnTextActive]}>
                  👩 Mujer
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Peso y talla */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Peso y estatura</Text>
            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Peso (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="70"
                  placeholderTextColor="#4A6A67"
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Estatura (cm)</Text>
                <TextInput
                  style={styles.input}
                  value={height}
                  onChangeText={setHeight}
                  placeholder="170"
                  placeholderTextColor="#4A6A67"
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
            </View>
          </View>

          {/* Actividad física */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Actividad física *</Text>
            <Text style={styles.fieldHint}>
              Las personas activas tienen la PA más baja en reposo
            </Text>
            <View style={styles.optionRow}>
              <TouchableOpacity
                style={[styles.optionBtn, isActive === false && styles.optionBtnActive]}
                onPress={() => setIsActive(false)}
              >
                <Text style={[styles.optionBtnText, isActive === false && styles.optionBtnTextActive]}>
                  🛋️ Sedentario
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionBtn, isActive === true && styles.optionBtnActive]}
                onPress={() => setIsActive(true)}
              >
                <Text style={[styles.optionBtnText, isActive === true && styles.optionBtnTextActive]}>
                  🏃 Activo
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Factores de riesgo */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Factores de salud (opcional)</Text>
            <Text style={styles.fieldHint}>Ayudan a interpretar mejor los resultados</Text>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setSmoker(!smoker)}
            >
              <View style={[styles.checkbox, smoker && styles.checkboxActive]}>
                {smoker && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>Fumador/a</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setDiabetic(!diabetic)}
            >
              <View style={[styles.checkbox, diabetic && styles.checkboxActive]}>
                {diabetic && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>Diabetes</Text>
            </TouchableOpacity>
          </View>

          {/* Aceptación de términos */}
          <View style={styles.checkRow}>
            <TouchableOpacity onPress={() => setTermsAcceptedState(!termsAccepted)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.checkbox, termsAccepted && styles.checkboxActive]}>
                {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>He leído y acepto los </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Terms')}>
              <Text style={styles.linkText}>Términos de Uso</Text>
            </TouchableOpacity>
            <Text style={styles.checkLabel}> y la </Text>
            <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
              <Text style={styles.linkText}>Política de Privacidad</Text>
            </TouchableOpacity>
          </View>

          {/* Botón finalizar */}
          <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
            <Text style={styles.finishBtnText}>
              {age && sex && isActive !== null ? '✅ Empezar a usar VitalPulse' : 'Continuar sin perfil completo'}
            </Text>
          </TouchableOpacity>

          {age && sex && isActive !== null && (
            <Text style={styles.profileComplete}>
              ✨ Perfil completo — máxima precisión activada
            </Text>
          )}

          <Text style={styles.privacyNote}>
            🔒 Todos los datos se guardan únicamente en tu dispositivo.
            Nunca se envían a ningún servidor.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#0D1918' },
  // Tutorial
  slide:        { width: SCREEN_WIDTH, paddingHorizontal: 32, paddingTop: 80, alignItems: 'center' },
  slideIcon:    { fontSize: 80, marginBottom: 28 },
  slideTitle:   { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  slideBody:    { color: '#8BBAB5', fontSize: 16, textAlign: 'center', lineHeight: 26 },
  dotsContainer:{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 32 },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2A4A47' },
  dotActive:    { backgroundColor: '#2BBFA4', width: 24 },
  tutorialFooter: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  primaryBtn:   { backgroundColor: '#1A7F6E', borderRadius: 16, padding: 18, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  skipText:     { color: '#4A6A67', fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  // Formulario
  formScroll:   { padding: 24, paddingBottom: 48 },
  formTitle:    { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 8 },
  formSubtitle: { color: '#4A6A67', fontSize: 14, lineHeight: 22, marginBottom: 28 },
  fieldGroup:   { marginBottom: 24 },
  fieldLabel:   { color: '#2BBFA4', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  fieldHint:    { color: '#4A6A67', fontSize: 12, marginBottom: 10, lineHeight: 18 },
  inputLabel:   { color: '#8BBAB5', fontSize: 12, marginBottom: 6 },
  input:        { backgroundColor: '#132220', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#1A7F6E33' },
  rowInputs:    { flexDirection: 'row' },
  optionRow:    { flexDirection: 'row', gap: 12 },
  optionBtn:    { flex: 1, backgroundColor: '#132220', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1A7F6E33' },
  optionBtnActive: { backgroundColor: '#1A7F6E', borderColor: '#2BBFA4' },
  optionBtnText:   { color: '#4A6A67', fontSize: 15, fontWeight: '600' },
  optionBtnTextActive: { color: '#fff' },
  checkRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  checkbox:     { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#2A4A47', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#1A7F6E', borderColor: '#2BBFA4' },
  checkmark:    { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkLabel:   { color: '#8BBAB5', fontSize: 15 },
  finishBtn:    { backgroundColor: '#1A7F6E', borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 8, marginBottom: 12 },
  finishBtnText:{ color: '#fff', fontSize: 17, fontWeight: '700' },
  profileComplete: { color: '#2BBFA4', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  privacyNote:  { color: '#2A4A47', fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
