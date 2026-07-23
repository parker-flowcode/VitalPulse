/**
 * ads.js — VitalPulse
 *
 * Sistema de anuncios con tres modalidades:
 * 1. Banner inferior (no intrusivo)
 * 2. Intersticial después de cada medición
 * 3. Recompensado: ver anuncio para obtener 1 medición extra
 *
 * AHORA CON ANUNCIOS REALES DE AdMob 🎉
 * react-native-google-mobile-ads instalado y configurado.
 */

import { Platform } from 'react-native';
import mobileAds, {
  InterstitialAd,
  RewardedAd,
  BannerAdSize,
  AdEventType,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

// ─── Configuración ────────────────────────────────────────────────────────────
export const ADS_CONFIG = {
  enabled: true,

  // Tus IDs reales de AdMob
  admob: {
    appId:        'ca-app-pub-1345413513424965~8898482663',
    banner:       'ca-app-pub-1345413513424965/7023008227',
    interstitial: 'ca-app-pub-1345413513424965/6647723840',
    rewarded:     'ca-app-pub-1345413513424965/5074787725',
  },

  // IDs de prueba de Google (se usan automáticamente en dispositivos de test)
  testIds: {
    banner:       TestIds.BANNER,
    interstitial: TestIds.INTERSTITIAL,
    rewarded:     TestIds.REWARDED,
  },
};

// ─── Estado de sesión ─────────────────────────────────────────────────────────
let _measurementCount = 0;
let _lastInterstitialTime = 0;
let _extraMeasurements = 0;

// ─── Inicializar AdMob ────────────────────────────────────────────────────────
export function initAds() {
  try {
    mobileAds().initialize();
    console.log('[Ads] ✅ AdMob inicializado correctamente');
  } catch (e) {
    console.warn('[Ads] Error al inicializar AdMob:', e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  1. BANNER INFERIOR
// ═════════════════════════════════════════════════════════════════════════════

export function shouldShowBanner() {
  return true;
}

export function getBannerAdSize() {
  return Platform.OS === 'ios' ? BannerAdSize.ADAPTIVE_BANNER : BannerAdSize.ANCHORED_ADAPTIVE_BANNER;
}

export function getBannerUnitId() {
  return ADS_CONFIG.admob.banner;
}

// ═════════════════════════════════════════════════════════════════════════════
//  2. INTERSTICIAL — después de cada medición
// ═════════════════════════════════════════════════════════════════════════════

export async function showInterstitialAd() {
  try {
    const now = Date.now();
    if (now - _lastInterstitialTime < 30000) return false;

    _lastInterstitialTime = now;
    _measurementCount++;

    // Suprimir cada 3er anuncio
    if (_measurementCount % 3 === 0) return false;

    const interstitial = InterstitialAd.createForAdRequest(ADS_CONFIG.admob.interstitial);

    return new Promise((resolve) => {
      const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        interstitial.show();
      });
      const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        unsubscribeLoaded();
        unsubscribeClosed();
        resolve(true);
      });
      const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
        unsubscribeLoaded();
        unsubscribeClosed();
        unsubscribeError();
        resolve(false);
      });
      interstitial.load();
    });
  } catch (e) {
    console.warn('[Ads] Error interstitial:', e.message);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  3. RECOMPENSADO — ver anuncio para obtener 1 medición extra
// ═════════════════════════════════════════════════════════════════════════════

export async function showRewardedAd() {
  try {
    const rewarded = RewardedAd.createForAdRequest(ADS_CONFIG.admob.rewarded);

    return new Promise((resolve) => {
      const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        rewarded.show();
      });
      const unsubscribeEarned = rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          _extraMeasurements++;
          resolve(true);
        }
      );
      const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        unsubscribeLoaded();
        unsubscribeEarned();
        unsubscribeClosed();
        resolve(false);
      });
      const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
        unsubscribeLoaded();
        unsubscribeEarned();
        unsubscribeClosed();
        unsubscribeError();
        resolve(false);
      });
      rewarded.load();
    });
  } catch (e) {
    console.warn('[Ads] Error rewarded:', e.message);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  UTILIDADES
// ═════════════════════════════════════════════════════════════════════════════

export function getExtraMeasurements() {
  return _extraMeasurements;
}

export function useExtraMeasurement() {
  if (_extraMeasurements > 0) {
    _extraMeasurements--;
    return true;
  }
  return false;
}

export function resetAdCounters() {
  _measurementCount = 0;
  _lastInterstitialTime = 0;
  _extraMeasurements = 0;
}

export function canWatchAdForMeasurement() {
  return true;
}