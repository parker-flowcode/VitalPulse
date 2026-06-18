import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY       = '@vitalpulse_history';
const CALIBRATION_KEY   = '@vitalpulse_calibration';
const PROFILE_KEY       = '@vitalpulse_profile';
const ONBOARDING_KEY    = '@vitalpulse_onboarding_done';

// ---------- Helper utilities ----------
const MAX_RETRIES = 3;

/** Simple checksum based on a 32‑bit hash of the JSON string */
function computeChecksum(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32‑bit integer
  }
  return hash.toString();
}

async function withRetry(fn, ...args) {
  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      return await fn(...args);
    } catch (e) {
      attempt++;
      if (attempt >= MAX_RETRIES) throw e;
      // Exponential back‑off (100 ms, 200 ms, 400 ms)
      await new Promise(res => setTimeout(res, 100 * Math.pow(2, attempt)));
    }
  }
}

async function setItemWithChecksum(key, value) {
  await withRetry(AsyncStorage.setItem, key, value);
  const checksum = computeChecksum(value);
  await withRetry(AsyncStorage.setItem, `${key}_checksum`, checksum);
}

async function getItemWithChecksum(key) {
  const [data, storedChecksum] = await Promise.all([
    withRetry(AsyncStorage.getItem, key),
    withRetry(AsyncStorage.getItem, `${key}_checksum`),
  ]);
  if (data && storedChecksum) {
    const computed = computeChecksum(data);
    if (computed !== storedChecksum) {
      console.warn(`Checksum mismatch for ${key}`);
      return null;
    }
  }
  return data;
}

async function removeItemWithChecksum(key) {
  await withRetry(AsyncStorage.removeItem, key);
  await withRetry(AsyncStorage.removeItem, `${key}_checksum`);
}

const useHealthStore = create((set, get) => ({
  // ─── Estado ────────────────────────────────────────────────────────────────
  history:           [],
  calibration:       null,   // { points: [{realSystolic, realDiastolic, morphology, bpm, sdnn, date}] }
  onboardingDone:    false,

  // Perfil del usuario
  userProfile: {
    name:      '',
    age:       null,
    sex:       null,         // 'male' | 'female'
    weight:    null,         // kg
    height:    null,         // cm
    isActive:  false,        // hace deporte regularmente
    smoker:    false,
    diabetic:  false,
  },

  settings: {
    alertBPMHigh: 100,
    alertBPMLow:  50,
    // Preferir usar el método de calibración por regresión cuando haya suficientes puntos y perfil completo
    preferRegression: true,
  },

  // Términos y privacidad
  termsAccepted: false,

  // ─── Onboarding ────────────────────────────────────────────────────────────
  setOnboardingDone: async () => {
    set({ onboardingDone: true });
    await setItemWithChecksum(ONBOARDING_KEY, 'true');
  },

  setTermsAccepted: async (value) => {
    set({ termsAccepted: value });
    await setItemWithChecksum('@vitalpulse_terms', JSON.stringify({ accepted: value }));
  },

  // ─── Perfil ────────────────────────────────────────────────────────────────
  updateUserProfile: async (profileData) => {
    const updated = { ...get().userProfile, ...profileData };
    set({ userProfile: updated });
    await setItemWithChecksum(PROFILE_KEY, JSON.stringify(updated));
  },

  // ─── Calibración multi-punto ───────────────────────────────────────────────
  addCalibrationPoint: async ({ realSystolic, realDiastolic, morphology, bpm, sdnn }) => {
    const current = get().calibration || { points: [] };
    const newPoint = {
      realSystolic,
      realDiastolic,
      morphology: morphology || { ptt: 0, risingSlope: 0, augmentationIndex: 0, pulseWidth: 0, dicroticNotch: 0 },
      bpm:        bpm || 70,
      sdnn:       sdnn || 0,
      date:       new Date().toISOString(),
    };
    // Máximo 20 puntos de calibración; los más recientes reemplazan los más viejos
    const points = [...current.points, newPoint].slice(-20);
    const updated = { points };
    set({ calibration: updated });
    await setItemWithChecksum(CALIBRATION_KEY, JSON.stringify(updated));
  },

  clearCalibration: async () => {
    set({ calibration: null });
    await removeItemWithChecksum(CALIBRATION_KEY);
  },

  // ─── Obtener conteo de mediciones de hoy ──────────────────────────────────
  getTodayMeasurementCount: () => {
    const { history } = get();
    const today = new Date().toDateString();
    return history.filter((h) => {
      try {
        return new Date(h.timestamp).toDateString() === today;
      } catch {
        return false;
      }
    }).length;
  },

  // ─── Mediciones ────────────────────────────────────────────────────────────
  addMeasurement: async (measurement) => {
    const entry = {
      ...measurement,
      id:        Date.now().toString(),
      timestamp: new Date().toISOString(),
    };
    const updated = [entry, ...get().history].slice(0, 200);
    set({ history: updated });
    try {
      await setItemWithChecksum(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Error guardando medición:', e);
    }
  },

  // ─── Carga inicial ─────────────────────────────────────────────────────────
  loadAll: async () => {
    try {
    const [historyRaw, calRaw, profileRaw, onboardingRaw] = await Promise.all([
      getItemWithChecksum(STORAGE_KEY),
      getItemWithChecksum(CALIBRATION_KEY),
      getItemWithChecksum(PROFILE_KEY),
      getItemWithChecksum(ONBOARDING_KEY),
    ]);

      const updates = {};
      if (historyRaw)    updates.history        = JSON.parse(historyRaw);
      if (calRaw)        updates.calibration     = JSON.parse(calRaw);
      if (profileRaw)    updates.userProfile     = { ...get().userProfile, ...JSON.parse(profileRaw) };
      if (onboardingRaw) updates.onboardingDone  = true;
      set(updates);
    } catch (e) {
      console.warn('Error cargando datos:', e);
    }
  },

  updateSettings: (newSettings) =>
    set((state) => ({ settings: { ...state.settings, ...newSettings } })),

  deleteMeasurement: async (id) => {
    const updated = get().history.filter((h) => h.id !== id);
    set({ history: updated });
    try {
      await setItemWithChecksum(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Error eliminando medición:', e);
    }
  },

  clearHistory: async () => {
    set({ history: [] });
    await removeItemWithChecksum(STORAGE_KEY);
  },

  clearAllData: async () => {
    set({
      history:        [],
      calibration:    null,
      onboardingDone: false,
      userProfile: {
        name: '', age: null, sex: null, weight: null,
        height: null, isActive: false, smoker: false, diabetic: false,
      },
    });
    await Promise.all([
      removeItemWithChecksum(STORAGE_KEY),
      removeItemWithChecksum(CALIBRATION_KEY),
      removeItemWithChecksum(PROFILE_KEY),
      removeItemWithChecksum(ONBOARDING_KEY),
    ]);
  },
}));

export default useHealthStore;
