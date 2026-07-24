/**
 * UpgradeScreen.js — VitalPulse v5.0
 *
 * Pantalla de suscripción "Hazte Pro" refinada con tema dinámico.
 * Muestra el plan actual, días restantes, planes disponibles y botón de compra.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Platform, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import {
  PLANS, purchaseProduct, restorePurchases,
  getCurrentPlan, isPro, getDaysRemaining, addSubscriptionListener,
} from '../services/subscriptions';
import { SPACING, RADIUS, SHADOWS } from '../theme/designTokens';

const FEATURES = [
  { icon: '✅', text: 'Mediciones ilimitadas' },
  { icon: '✅', text: 'Calibración multi-punto avanzada' },
  { icon: '✅', text: 'Exportación de datos a CSV' },
  { icon: '✅', text: 'Gráficas detalladas de tendencias' },
  { icon: '✅', text: 'SNR y métricas de calidad avanzadas' },
  { icon: '✅', text: 'Sin anuncios' },
];

export default function UpgradeScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(getCurrentPlan);
  const alreadyPro = isPro();
  const daysLeft = getDaysRemaining();

  // Escuchar cambios de suscripción en tiempo real
  useEffect(() => {
    const unsub = addSubscriptionListener(() => {
      setCurrentPlan(getCurrentPlan());
    });
    return unsub;
  }, []);

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const success = await purchaseProduct(selectedPlan);
      if (success) {
        setCurrentPlan(getCurrentPlan());
        Alert.alert(
          '✅ ¡Bienvenido a VitalPulse Pro!',
          selectedPlan === 'lifetime'
            ? 'Ahora tienes acceso ilimitado de por vida a todas las funciones.'
            : 'Ahora tienes acceso ilimitado durante 30 días a todas las funciones.',
          [{ text: 'Genial', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Error', 'No se pudo completar la compra. Inténtalo de nuevo.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        setCurrentPlan(getCurrentPlan());
        Alert.alert('✅ Compras restauradas', 'Tus suscripciones anteriores han sido restauradas.');
      } else {
        Alert.alert('Sin compras', 'No se encontraron suscripciones anteriores para restaurar.');
      }
    } finally {
      setRestoring(false);
    }
  };

  const planLabel = alreadyPro
    ? currentPlan.id === 'lifetime' ? 'Vitalicio' : currentPlan.name
    : '';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroSection}>
          <Image source={require('../../assets/icon.png')} style={styles.heroLogo} />
          <Text style={[styles.heroTitle, { color: colors.primary }]}>VitalPulse Pro</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Lleva tu monitorización cardiovascular al siguiente nivel
          </Text>
        </View>

        {/* Plan actual */}
        <View style={[styles.currentPlanCard, SHADOWS.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Text style={[styles.currentPlanLabel, { color: colors.textSecondary }]}>
            {alreadyPro ? '✅ Plan actual' : '📋 Plan actual'}
          </Text>
          <Text style={[styles.currentPlanName, { color: colors.primary }]}>
            {currentPlan.name}
          </Text>
          {alreadyPro && daysLeft !== null && (
            <Text style={[styles.daysLeft, { color: colors.textSecondary }]}>
              {daysLeft > 0
                ? `⏱ ${daysLeft} día${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`
                : '⏱ Se renueva hoy'}
            </Text>
          )}
          {alreadyPro && currentPlan.id === 'lifetime' && (
            <Text style={[styles.daysLeft, { color: colors.textSecondary }]}>♾️ Acceso vitalicio</Text>
          )}
          {!alreadyPro && (
            <Text style={[styles.currentPlanDesc, { color: colors.textSecondary }]}>
              {PLANS.free.maxMeasurementsPerDay} mediciones gratuitas por día
            </Text>
          )}
        </View>

        {/* Features */}
        <View style={[styles.featuresCard, SHADOWS.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Text style={[styles.featuresTitle, { color: colors.textPrimary }]}>Funciones Pro</Text>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={[styles.featureIcon, { color: colors.success }]}>{f.icon}</Text>
              <Text style={[styles.featureText, { color: colors.textPrimary }]}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Planes disponibles (solo si no es Pro) */}
        {!alreadyPro && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Elige tu plan</Text>
            <View style={styles.plansContainer}>
              {/* Plan mensual */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  { backgroundColor: colors.bg, borderColor: selectedPlan === 'monthly' ? colors.primary : colors.border },
                  selectedPlan === 'monthly' && { backgroundColor: colors.primarySubtle || '#F8FAFF' },
                ]}
                onPress={() => setSelectedPlan('monthly')}
              >
                <View style={styles.planHeader}>
                  <Text style={[styles.planName, { color: colors.textPrimary }]}>{PLANS.monthly.name}</Text>
                  <View style={[styles.planBadge, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.planBadgeText, { color: colors.textOnPrimary }]}>RECOMENDADO</Text>
                  </View>
                </View>
                <Text style={[styles.planPrice, { color: colors.primary }]}>{PLANS.monthly.price}</Text>
                <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>por mes</Text>
                <Text style={[styles.planDesc, { color: colors.textSecondary }]}>Cancela cuando quieras</Text>
              </TouchableOpacity>

              {/* Plan vitalicio */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  { backgroundColor: colors.bg, borderColor: selectedPlan === 'lifetime' ? colors.primary : colors.border },
                  selectedPlan === 'lifetime' && { backgroundColor: colors.primarySubtle || '#F8FAFF' },
                ]}
                onPress={() => setSelectedPlan('lifetime')}
              >
                <View style={styles.planHeader}>
                  <Text style={[styles.planName, { color: colors.textPrimary }]}>{PLANS.lifetime.name}</Text>
                </View>
                <Text style={[styles.planPrice, { color: colors.primary }]}>{PLANS.lifetime.price}</Text>
                <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>pago único</Text>
                <Text style={[styles.planDesc, { color: colors.textSecondary }]}>Sin renovaciones · Para siempre</Text>
              </TouchableOpacity>
            </View>

            {/* Comparativa */}
            <View style={[styles.comparisonCard, SHADOWS.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <Text style={[styles.comparisonTitle, { color: colors.textPrimary }]}>Comparativa</Text>
              <View style={[styles.compRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.compLabel, { color: colors.textSecondary }]}>Mediciones/día</Text>
                <Text style={[styles.compValueFree, { color: colors.danger }]}>5</Text>
                <Text style={[styles.compValuePro, { color: colors.success }]}>∞</Text>
              </View>
              <View style={[styles.compRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.compLabel, { color: colors.textSecondary }]}>Anuncios</Text>
                <Text style={[styles.compValueFree, { color: colors.danger }]}>Sí</Text>
                <Text style={[styles.compValuePro, { color: colors.success }]}>No</Text>
              </View>
              <View style={[styles.compRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.compLabel, { color: colors.textSecondary }]}>Calibración avanzada</Text>
                <Text style={[styles.compValueFree, { color: colors.danger }]}>No</Text>
                <Text style={[styles.compValuePro, { color: colors.success }]}>Sí</Text>
              </View>
              <View style={[styles.compRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.compLabel, { color: colors.textSecondary }]}>Exportación CSV</Text>
                <Text style={[styles.compValueFree, { color: colors.danger }]}>No</Text>
                <Text style={[styles.compValuePro, { color: colors.success }]}>Sí</Text>
              </View>
            </View>

            {/* Botón de compra */}
            <TouchableOpacity
              style={[styles.purchaseBtn, { backgroundColor: colors.primary }, purchasing && styles.purchaseBtnDisabled]}
              onPress={handlePurchase}
              disabled={purchasing}
            >
              {purchasing ? (
                <ActivityIndicator color={colors.textOnPrimary} size="small" />
              ) : (
                <>
                  <Text style={[styles.purchaseBtnText, { color: colors.textOnPrimary }]}>
                    Obtener {selectedPlan === 'monthly' ? PLANS.monthly.name : PLANS.lifetime.name}
                  </Text>
                  <Text style={[styles.purchaseBtnSub, { color: colors.textOnPrimary + 'B3' }]}>
                    {selectedPlan === 'monthly' ? PLANS.monthly.price : PLANS.lifetime.price}
                    {selectedPlan === 'monthly' ? ' · Cancela cuando quieras' : ' · Pago único'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Si ya es Pro, botón de gestión */}
        {alreadyPro && (
          <TouchableOpacity
            style={[styles.manageBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
            onPress={() => {
              Alert.alert(
                'Gestionar suscripción',
                'Puedes gestionar tu suscripción desde la App Store/Google Play.'
              );
            }}
          >
            <Text style={[styles.manageBtnText, { color: colors.primary }]}>Gestionar suscripción</Text>
          </TouchableOpacity>
        )}

        {/* Restaurar compras */}
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={[styles.restoreBtnText, { color: colors.primary }]}>Restaurar compras anteriores</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          El pago se cargará a tu cuenta de {Platform.OS === 'ios' ? 'Apple' : 'Google'}.
          Las suscripciones se renuevan automáticamente a menos que se cancelen
          24 horas antes del final del periodo actual.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles factory ────────────────────────────────────────────────────────────
const createStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'flex-end',
    marginBottom: 8,
  },
  closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { color: colors.textMuted, fontSize: 22, fontWeight: '600' },

  heroSection: { alignItems: 'center', marginBottom: 24 },
  heroLogo: { width: 64, height: 64, marginBottom: 12, resizeMode: 'contain' },
  heroTitle: { color: colors.primary, fontSize: 28, fontWeight: '700', marginBottom: 8 },
  heroSubtitle: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  // Plan actual
  currentPlanCard: {
    backgroundColor: colors.bg, borderRadius: 16, padding: 20,
    marginBottom: 20, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  currentPlanLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  currentPlanName: { color: colors.primary, fontSize: 22, fontWeight: '800', marginTop: 8 },
  daysLeft: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  currentPlanDesc: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },

  sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 12 },

  featuresCard: {
    backgroundColor: colors.bg, borderRadius: 16, padding: 20,
    marginBottom: 20, borderWidth: 1, borderColor: colors.border,
  },
  featuresTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  featureIcon: { color: colors.success, fontSize: 18, fontWeight: '700' },
  featureText: { color: colors.textPrimary, fontSize: 14, flex: 1 },

  plansContainer: { gap: 12, marginBottom: 20 },
  planCard: {
    backgroundColor: colors.bg, borderRadius: 16, padding: 20,
    borderWidth: 2, borderColor: colors.border,
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  planName: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  planBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  planBadgeText: { color: colors.textOnPrimary, fontSize: 10, fontWeight: '800' },
  planPrice: { color: colors.primary, fontSize: 32, fontWeight: '700' },
  planPeriod: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  planDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 8 },

  comparisonCard: {
    backgroundColor: colors.bg, borderRadius: 16, padding: 20,
    marginBottom: 20, borderWidth: 1, borderColor: colors.border,
  },
  comparisonTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  compRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  compLabel: { flex: 1, color: colors.textSecondary, fontSize: 13 },
  compValueFree: { color: colors.danger, fontSize: 13, fontWeight: '600', width: 40, textAlign: 'center' },
  compValuePro: { color: colors.success, fontSize: 13, fontWeight: '700', width: 40, textAlign: 'center' },

  purchaseBtn: {
    backgroundColor: colors.primary, borderRadius: 16, padding: 18,
    alignItems: 'center', marginBottom: 12, minHeight: 56,
    justifyContent: 'center',
  },
  purchaseBtnDisabled: { opacity: 0.6 },
  purchaseBtnText: { color: colors.textOnPrimary, fontSize: 18, fontWeight: '700' },
  purchaseBtnSub: { color: colors.textOnPrimary + 'B3', fontSize: 13, marginTop: 4 },

  manageBtn: {
    backgroundColor: colors.bg, borderRadius: 12, padding: 14,
    alignItems: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  manageBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },

  restoreBtn: { alignItems: 'center', padding: 12, marginBottom: 16, minHeight: 44, justifyContent: 'center' },
  restoreBtnText: { color: colors.primary, fontSize: 14, textDecorationLine: 'underline' },

  footer: {
    color: colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16,
  },
});
