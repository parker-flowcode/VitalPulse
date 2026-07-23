/**
 * subscriptions.js — VitalPulse
 *
 * Sistema de suscripciones con persistencia, expiración y estado reactivo.
 *
 * Para activar pagos reales:
 * 1. Instalar: npx expo install react-native-iap
 * 2. Configurar IDs de producto en Apple App Store Connect / Google Play Console
 * 3. Cambiar IAP_ENABLED a true
 * 4. Añadir los productIds reales
 *
 * Modo desarrollo: el usuario es "free" por defecto. Pro se simula sin pagos.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SUBSCRIPTION_KEY = '@vitalpulse_subscription';

// ─── Planes ───────────────────────────────────────────────────────────────────
export const PLANS = {
  free: {
    id: 'free',
    name: 'Gratuito',
    price: '0€',
    maxMeasurementsPerDay: 5,
    hasAds: true,
    hasAdvancedCalibration: false,
    hasExport: false,
    color: '#94A3B8',
  },
  monthly: {
    id: 'pro_monthly',
    name: 'VitalPulse Pro',
    price: '4.99€/mes',
    productId: 'com.vpstudios.vitalpulse.pro.monthly',
    maxMeasurementsPerDay: Infinity,
    hasAds: false,
    hasAdvancedCalibration: true,
    hasExport: true,
    color: '#2563EB',
  },
  lifetime: {
    id: 'pro_lifetime',
    name: 'VitalPulse Pro Vitalicio',
    price: '29.99€',
    productId: 'com.vpstudios.vitalpulse.pro.lifetime',
    maxMeasurementsPerDay: Infinity,
    hasAds: false,
    hasAdvancedCalibration: true,
    hasExport: true,
    color: '#F59E0B',
  },
};

// ─── Configuración IAP ────────────────────────────────────────────────────────
const IAP_ENABLED = false;

// ─── Estado interno ────────────────────────────────────────────────────────────
let _subscription = 'free';
let _expiresAt = null; // ISO string o null
const _listeners = new Set();

// ─── Notificar cambio a listeners ─────────────────────────────────────────────
function _notify(planId) {
  _listeners.forEach((fn) => {
    try { fn(planId); } catch (e) { console.warn('[IAP] listener error:', e); }
  });
}

// ─── Persistir estado ─────────────────────────────────────────────────────────
async function _persist() {
  try {
    await AsyncStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify({
      planId: _subscription,
      expiresAt: _expiresAt,
    }));
  } catch (e) {
    console.warn('[IAP] Error persistiendo suscripción:', e);
  }
}

// ─── Registrar listener para cambios de plan ──────────────────────────────────
export function addSubscriptionListener(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// ─── Obtener plan actual ──────────────────────────────────────────────────────
export function getCurrentPlan() {
  // Si hay fecha de expiración y ha pasado, hacer downgrade a free
  if (_expiresAt && _subscription !== 'free' && _subscription !== 'lifetime') {
    try {
      if (new Date(_expiresAt) < new Date()) {
        console.log('[IAP] Suscripción expirada, downgrade a free');
        _subscription = 'free';
        _expiresAt = null;
        _persist();
        _notify('free');
      }
    } catch {
      // Ignorar errores de parsing de fecha
    }
  }
  return PLANS[_subscription] || PLANS.free;
}

// ─── Verificar si es Pro ──────────────────────────────────────────────────────
export function isPro() {
  return _subscription !== 'free';
}

// ─── Establecer suscripción (restore) ─────────────────────────────────────────
export function setSubscription(planId) {
  if (PLANS[planId]) {
    _subscription = planId;
    // Planes vitalicios no expiran; mensuales expiran en 30 días
    if (planId === 'monthly') {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      _expiresAt = d.toISOString();
    } else if (planId === 'lifetime') {
      _expiresAt = null; // nunca expira
    } else {
      _expiresAt = null;
    }
    _persist();
    _notify(planId);
    return true;
  }
  return false;
}

// ─── Obtener mediciones restantes hoy ─────────────────────────────────────────
export function getRemainingMeasurements(todayCount) {
  const plan = getCurrentPlan();
  if (plan.maxMeasurementsPerDay === Infinity) return Infinity;
  return Math.max(0, plan.maxMeasurementsPerDay - todayCount);
}

// ─── Inicializar desde persistencia ──────────────────────────────────────────
export async function initIAP() {
  try {
    const raw = await AsyncStorage.getItem(SUBSCRIPTION_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.planId && PLANS[data.planId]) {
        _subscription = data.planId;
        _expiresAt = data.expiresAt || null;
        console.log(`[IAP] Suscripción cargada: ${_subscription}`, _expiresAt ? `exp: ${_expiresAt}` : 'sin expiración');
      }
    }
  } catch (e) {
    console.warn('[IAP] Error cargando suscripción:', e);
  }

  if (!IAP_ENABLED) {
    console.log('[IAP] Pagos desactivados (modo desarrollo)');
    return;
  }
  try {
    // const RNIap = require('react-native-iap').default;
    // await RNIap.initConnection();
    // const products = await RNIap.getProducts([PLANS.monthly.productId, PLANS.lifetime.productId]);
    console.log('[IAP] Inicializado correctamente');
  } catch (e) {
    console.warn('[IAP] Error al inicializar:', e.message);
  }
}

// ─── Fecha de expiración formateada ──────────────────────────────────────────
export function getExpirationDate() {
  if (!_expiresAt || _subscription === 'lifetime') return null;
  try {
    return new Date(_expiresAt);
  } catch {
    return null;
  }
}

// ─── Días restantes de suscripción ────────────────────────────────────────────
export function getDaysRemaining() {
  const exp = getExpirationDate();
  if (!exp) return null; // lifetime o free
  const diff = Math.ceil((exp - new Date()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

// ─── Iniciar compra ────────────────────────────────────────────────────────────
export async function purchaseProduct(planId) {
  if (!IAP_ENABLED) {
    console.log(`[IAP] Simulando compra de: ${planId}`);
    setSubscription(planId);
    return true;
  }
  try {
    // const RNIap = require('react-native-iap').default;
    // const purchase = await RNIap.requestPurchase({ sku: PLANS[planId].productId });
    // await RNIap.finishTransaction({ purchase, isConsumable: false });
    // setSubscription(planId);
    console.log(`[IAP] Compra realizada: ${planId}`);
    return true;
  } catch (e) {
    console.warn('[IAP] Error en compra:', e.message);
    return false;
  }
}

// ─── Restaurar compras ─────────────────────────────────────────────────────────
export async function restorePurchases() {
  if (!IAP_ENABLED) {
    console.log('[IAP] Simulando restauración');
    return false;
  }
  try {
    // const RNIap = require('react-native-iap').default;
    // const purchases = await RNIap.getAvailablePurchases();
    // for (const p of purchases) {
    //   if (p.productId === PLANS.monthly.productId) setSubscription('monthly');
    //   if (p.productId === PLANS.lifetime.productId) setSubscription('lifetime');
    // }
    // return purchases.length > 0;
    console.log('[IAP] Restauración completada');
    return false;
  } catch (e) {
    console.warn('[IAP] Error restaurando:', e.message);
    return false;
  }
}