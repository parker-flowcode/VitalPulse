/**
 * ads.js — VitalPulse
 *
 * Sistema de anuncios configurable.
 *
 * Para activar anuncios reales:
 * 1. Instalar: npx expo install react-native-google-mobile-ads
 * 2. Configurar IDs en ADMOB_ADS en app.json
 * 3. Cambiar ADS_ENABLED a true
 *
 * Modo desarrollo: los anuncios se muestran como placeholders grises
 * para que puedas ver el layout sin ads reales.
 */

// ─── Configuración ────────────────────────────────────────────────────────────
export const ADS_CONFIG = {
  // Cambiar a true cuando tengas cuenta de AdMob
  enabled: false,

  // IDs de AdMob (reemplazar con los reales)
  admob: {
    banner:       'ca-app-pub-xxxxxxxxxxxxxx/yyyyyyyyyy',
    interstitial: 'ca-app-pub-xxxxxxxxxxxxxx/zzzzzzzzzz',
    rewarded:     'ca-app-pub-xxxxxxxxxxxxxx/wwwwwwwwww',
  },

  // Límites de frecuencia
  interstitialEveryNMeasurements: 3, // Cada 3 mediciones
  maxBannerRefreshMs: 60000,         // No refrescar más de 1 vez por minuto
};

// ─── Estado de sesión ─────────────────────────────────────────────────────────
let interstitialCount = 0;
let lastInterstitialTime = 0;

// ─── Inicializar anuncios ────────────────────────────────────────────────────
export function initAds() {
  if (!ADS_CONFIG.enabled) {
    console.log('[Ads] Anuncios desactivados (modo desarrollo)');
    return;
  }
  try {
    // Aquí se inicializaría react-native-google-mobile-ads
    // const mobileAds = require('react-native-google-mobile-ads').default;
    // mobileAds().initialize();
    console.log('[Ads] Inicializado correctamente');
  } catch (e) {
    console.warn('[Ads] Error al inicializar:', e.message);
  }
}

// ─── Mostrar banner (no hace nada si desactivado) ────────────────────────────
export function shouldShowBanner() {
  return ADS_CONFIG.enabled;
}

// ─── Mostrar intersticial ───────────────────────────────────────────────────
export function maybeShowInterstitial() {
  if (!ADS_CONFIG.enabled) return false;
  interstitialCount++;

  if (interstitialCount >= ADS_CONFIG.interstitialEveryNMeasurements) {
    const now = Date.now();
    if (now - lastInterstitialTime < 120000) return false; // Min 2 min entre anuncios

    interstitialCount = 0;
    lastInterstitialTime = now;
    try {
      // Aquí se mostraría el intersticial real
      // const InterstitialAd = require('react-native-google-mobile-ads').InterstitialAd;
      // const ad = InterstitialAd.createForAdRequest(ADS_CONFIG.admob.interstitial);
      // ad.show();
      console.log('[Ads] Mostrando intersticial (placeholder)');
      return true;
    } catch (e) {
      console.warn('[Ads] Error mostrando intersticial:', e.message);
      return false;
    }
  }
  return false;
}

// ─── Resetear contador de intersticiales ────────────────────────────────────
export function resetAdCounters() {
  interstitialCount = 0;
  lastInterstitialTime = 0;
}