/**
 * UpgradeScreen.js — VitalPulse
 *
 * Pantalla de suscripción "Hazte Pro" refinada.
 * Muestra el plan actual, días restantes, planes disponibles y botón de compra.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  PLANS, purchaseProduct, restorePurchases,
  getCurrentPlan, isPro, getDaysRemaining, addSubscriptionListener,
} from '../services/subscriptions';

const FEATURES = [
  { icon: '📊', text: 'Mediciones ilimitadas' },
  { icon: '🎯', text: 'Calibración multi-punto avanzada' },
  { icon: '📤', text: 'Exportación de datos a CSV' },
  { icon: '📈', text: 'Gráficas detalladas de tendencias' },
  { icon: '🔬', text: 'SNR y métricas de calidad avanzadas' },
  { icon: '🚫', text: 'Sin anuncios' },
];

export default function UpgradeScreen({ navigation }) {
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
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroSection}>
          <Text style={styles.heroIcon}>💚</Text>
          <Text style={styles.heroTitle}>VitalPulse Pro</Text>
          <Text style={styles.heroSubtitle}>
            Lleva tu monitorización cardiovascular al siguiente nivel
          </Text>
        </View>

        {/* Plan actual */}
        <View style={styles.currentPlanCard}>
          <Text style={styles.currentPlanLabel}>
            {alreadyPro ? '✅ Plan actual' : '📋 Plan actual'}
          </Text>
          <Text style={[styles.currentPlanName, { color: currentPlan.color }]}>
            {currentPlan.name}
          </Text>
          {alreadyPro && daysLeft !== null && (
            <Text style={styles.daysLeft}>
              {daysLeft > 0
                ? `⏱ ${daysLeft} día${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`
                : '⏱ Se renueva hoy'}
            </Text>
          )}
          {alreadyPro && currentPlan.id === 'lifetime' && (
            <Text style={styles.daysLeft}>♾️ Acceso vitalicio</Text>
          )}
          {!alreadyPro && (
            <Text style={styles.currentPlanDesc}>
              {PLANS.free.maxMeasurementsPerDay} mediciones gratuitas por día
            </Text>
          )}
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>Funciones Pro</Text>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Planes disponibles (solo si no es Pro) */}
        {!alreadyPro && (
          <>
            <Text style={styles.sectionTitle}>Elige tu plan</Text>
            <View style={styles.plansContainer}>
              {/* Plan mensual */}
              <TouchableOpacity
                style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
                onPress={() => setSelectedPlan('monthly')}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>{PLANS.monthly.name}</Text>
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>RECOMENDADO</Text>
                  </View>
                </View>
                <Text style={styles.planPrice}>{PLANS.monthly.price}</Text>
                <Text style={styles.planPeriod}>por mes</Text>
                <Text style={styles.planDesc}>Cancela cuando quieras</Text>
              </TouchableOpacity>

              {/* Plan vitalicio */}
              <TouchableOpacity
                style={[styles.planCard, selectedPlan === 'lifetime' && styles.planCardSelected]}
                onPress={() => setSelectedPlan('lifetime')}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>{PLANS.lifetime.name}</Text>
                </View>
                <Text style={styles.planPrice}>{PLANS.lifetime.price}</Text>
                <Text style={styles.planPeriod}>pago único</Text>
                <Text style={styles.planDesc}>Sin renovaciones · Para siempre</Text>
              </TouchableOpacity>
            </View>

            {/* Comparativa */}
            <View style={styles.comparisonCard}>
              <Text style={styles.comparisonTitle}>Comparativa</Text>
              <View style={styles.compRow}>
                <Text style={styles.compLabel}>Mediciones/día</Text>
                <Text style={styles.compValueFree}>5</Text>
                <Text style={styles.compValuePro}>∞</Text>
              </View>
              <View style={styles.compRow}>
                <Text style={styles.compLabel}>Anuncios</Text>
                <Text style={styles.compValueFree}>Sí</Text>
                <Text style={styles.compValuePro}>No</Text>
              </View>
              <View style={styles.compRow}>
                <Text style={styles.compLabel}>Calibración avanzada</Text>
                <Text style={styles.compValueFree}>No</Text>
                <Text style={styles.compValuePro}>Sí</Text>
              </View>
              <View style={styles.compRow}>
                <Text style={styles.compLabel}>Exportación CSV</Text>
                <Text style={styles.compValueFree}>No</Text>
                <Text style={styles.compValuePro}>Sí</Text>
              </View>
            </View>

            {/* Botón de compra */}
            <TouchableOpacity
              style={[styles.purchaseBtn, purchasing && styles.purchaseBtnDisabled]}
              onPress={handlePurchase}
              disabled={purchasing}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.purchaseBtnText}>
                    Obtener {selectedPlan === 'monthly' ? PLANS.monthly.name : PLANS.lifetime.name}
                  </Text>
                  <Text style={styles.purchaseBtnSub}>
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
            style={styles.manageBtn}
            onPress={() => {
              Alert.alert(
                'Gestionar suscripción',
                'Puedes gestionar tu suscripción desde la App Store/Google Play.'
              );
            }}
          >
            <Text style={styles.manageBtnText}>Gestionar suscripción</Text>
          </TouchableOpacity>
        )}

        {/* Restaurar compras */}
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator color="#2BBFA4" size="small" />
          ) : (
            <Text style={styles.restoreBtnText}>Restaurar compras anteriores</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footer}>
          El pago se cargará a tu cuenta de {Platform.OS === 'ios' ? 'Apple' : 'Google'}.
          Las suscripciones se renuevan automáticamente a menos que se cancelen
          24 horas antes del final del periodo actual.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D1918' },
  scroll: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'flex-end',
    marginBottom: 8,
  },
  closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { color: '#4A6A67', fontSize: 22, fontWeight: '600' },

  heroSection: { alignItems: 'center', marginBottom: 24 },
  heroIcon: { fontSize: 64, marginBottom: 12 },
  heroTitle: { color: '#2BBFA4', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  heroSubtitle: { color: '#4A6A67', fontSize: 15, textAlign: 'center', lineHeight: 22 },

  // Plan actual
  currentPlanCard: {
    backgroundColor: '#132220', borderRadius: 16, padding: 20,
    marginBottom: 20, borderWidth: 1, borderColor: '#1A7F6E33',
    alignItems: 'center',
  },
  currentPlanLabel: { color: '#4A6A67', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  currentPlanName: { fontSize: 22, fontWeight: '800', marginTop: 8 },
  daysLeft: { color: '#8BBAB5', fontSize: 13, marginTop: 4 },
  currentPlanDesc: { color: '#4A6A67', fontSize: 13, marginTop: 4 },

  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 12 },

  featuresCard: {
    backgroundColor: '#132220', borderRadius: 16, padding: 20,
    marginBottom: 20, borderWidth: 1, borderColor: '#1A7F6E22',
  },
  featuresTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  featureIcon: { fontSize: 18 },
  featureText: { color: '#8BBAB5', fontSize: 14, flex: 1 },

  plansContainer: { gap: 12, marginBottom: 20 },
  planCard: {
    backgroundColor: '#132220', borderRadius: 16, padding: 20,
    borderWidth: 2, borderColor: '#1A7F6E22',
  },
  planCardSelected: { borderColor: '#2BBFA4', backgroundColor: '#1A2F2E' },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  planName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  planBadge: {
    backgroundColor: '#2BBFA4',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  planBadgeText: { color: '#0D1918', fontSize: 10, fontWeight: '800' },
  planPrice: { color: '#2BBFA4', fontSize: 32, fontWeight: '700' },
  planPeriod: { color: '#4A6A67', fontSize: 13, marginTop: 2 },
  planDesc: { color: '#8BBAB5', fontSize: 12, marginTop: 8 },

  comparisonCard: {
    backgroundColor: '#132220', borderRadius: 16, padding: 20,
    marginBottom: 20, borderWidth: 1, borderColor: '#1A7F6E22',
  },
  comparisonTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  compRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#1A7F6E22',
  },
  compLabel: { flex: 1, color: '#8BBAB5', fontSize: 13 },
  compValueFree: { color: '#F25C54', fontSize: 13, fontWeight: '600', width: 40, textAlign: 'center' },
  compValuePro: { color: '#2BBFA4', fontSize: 13, fontWeight: '700', width: 40, textAlign: 'center' },

  purchaseBtn: {
    backgroundColor: '#1A7F6E', borderRadius: 16, padding: 18,
    alignItems: 'center', marginBottom: 12, minHeight: 56,
    justifyContent: 'center',
  },
  purchaseBtnDisabled: { opacity: 0.6 },
  purchaseBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  purchaseBtnSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 },

  manageBtn: {
    backgroundColor: '#132220', borderRadius: 12, padding: 14,
    alignItems: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: '#1A7F6E44',
  },
  manageBtnText: { color: '#2BBFA4', fontSize: 15, fontWeight: '600' },

  restoreBtn: { alignItems: 'center', padding: 12, marginBottom: 16, minHeight: 44, justifyContent: 'center' },
  restoreBtnText: { color: '#2BBFA4', fontSize: 14, textDecorationLine: 'underline' },

  footer: {
    color: '#2A4A47', fontSize: 11, textAlign: 'center', lineHeight: 16,
  },
});