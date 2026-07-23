/**
 * ppgProcessor.js — VitalPulse v4.3
 *
 * Procesador de señal PPG optimizado para señal de cámara móvil.
 *
 * CORREGIDO v4.3:
 * - Finger detection: evalúa R_mean + desviación estándar para distinguir
 *   "Sin dedo", "Saturado (demasiada presión)" y "Señal válida"
 * - detectRawSaturation devuelve 3 estados en lugar de boolean
 * - Detrend mejorado: elimina DC + tendencia lineal EN DOS PASOS
 *   (primero resta media, luego pendiente) para que no quede offset residual
 * - detectPeaks con umbral reducido al 10% y pre-normalización por z-score
 *   para evitar que el offset residual mate la detección
 * - Eliminado detectSaturation sobre señal filtrada (era redundante y confuso)
 */

// ─── Constantes ──────────────────────────────────────────────────────────────
const MIN_SNR_DB = 3;
const SAT_HIGH = 240;  // umbral de saturación raw alto
const SAT_LOW  = 15;   // umbral de saturación raw bajo

// ─── Detrend mejorado: 2 pasos ──────────────────────────────────────────────
// Primero resta la media (DC), luego elimina la tendencia lineal residual.
// Esto evita que quede offset que el Butterworth no puede eliminar del todo.
export function detrend(signal) {
  if (signal.length === 0) return [];
  const n = signal.length;

  // Paso 1: Restar media (componente DC)
  const mean = signal.reduce((a, b) => a + b, 0) / n;
  const centered = signal.map(v => v - mean);

  // Paso 2: Eliminar tendencia lineal residual
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += centered[i];
    sumXY += i * centered[i]; sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-12) return centered;
  const slope = (n * sumXY - sumX * sumY) / denom;
  return centered.map((v, i) => v - slope * i);
}

// ─── Media móvil ─────────────────────────────────────────────────────────────
function movingAverage(signal, windowSize) {
  const result = new Array(signal.length).fill(0);
  for (let i = 0; i < signal.length; i++) {
    let sum = 0, count = 0;
    for (let j = Math.max(0, i - windowSize); j <= Math.min(signal.length - 1, i + windowSize); j++) {
      sum += signal[j]; count++;
    }
    result[i] = sum / count;
  }
  return result;
}

// ─── Filtro Butterworth de 2º orden ──────────────────────────────────────────
export function bandpassFilter(signal, fps = 19) {
  if (signal.length < 10) return signal;
  if (fps < 8) return signal;

  let workSignal = signal;
  let workFps = fps;
  if (fps < 12 && fps >= 8) {
    workSignal = [];
    for (let i = 0; i < signal.length - 1; i++) {
      workSignal.push(signal[i]);
      workSignal.push((signal[i] + signal[i + 1]) / 2);
    }
    workSignal.push(signal[signal.length - 1]);
    workFps = fps * 2;
  }

  const nyquist = workFps / 2;
  const fcLowNorm = (workFps < 15 ? 3.0 : 4.0) / nyquist;
  const fcHighNorm = 0.5 / nyquist;

  // Paso alto Butterworth 2º orden
  const w0H = Math.tan(Math.PI * fcHighNorm);
  const kH = w0H * w0H + Math.SQRT2 * w0H + 1;
  const bH = [1 / kH, -2 / kH, 1 / kH];
  const aH = [1, (2 * (w0H * w0H - 1)) / kH, (w0H * w0H - Math.SQRT2 * w0H + 1) / kH];

  const hp = new Array(workSignal.length).fill(0);
  let w1H = 0, w2H = 0;
  for (let i = 0; i < workSignal.length; i++) {
    const w = workSignal[i] - aH[1] * w1H - aH[2] * w2H;
    hp[i] = bH[0] * w + bH[1] * w1H + bH[2] * w2H;
    w2H = w1H;
    w1H = w;
  }

  // Paso bajo Butterworth 2º orden
  const w0L = Math.tan(Math.PI * fcLowNorm);
  const kL = w0L * w0L + Math.SQRT2 * w0L + 1;
  const bL = [w0L * w0L / kL, 2 * w0L * w0L / kL, w0L * w0L / kL];
  const aL = [1, (2 * (w0L * w0L - 1)) / kL, (w0L * w0L - Math.SQRT2 * w0L + 1) / kL];

  const lp = new Array(workSignal.length).fill(0);
  let w1L = 0, w2L = 0;
  for (let i = 0; i < workSignal.length; i++) {
    const w = hp[i] - aL[1] * w1L - aL[2] * w2L;
    lp[i] = bL[0] * w + bL[1] * w1L + bL[2] * w2L;
    w2L = w1L;
    w1L = w;
  }

  if (workSignal !== signal) {
    const decimated = [];
    for (let i = 0; i < signal.length; i++) decimated.push(lp[i * 2]);
    return decimated;
  }
  return lp;
}

// ─── Detección de saturación RAW (3 estados) ────────────────────────────────
/**
 * Analiza la señal RAW (0-255) y devuelve:
 *   'saturated_high' → R_mean > 240 (demasiada presión, luz blanca)
 *   'saturated_low'  → R_mean < 15  (sin dedo, sin luz)
 *   'ok'             → señal dentro de rango
 *
 * La saturación alta es el caso más común: el usuario presiona tanto que
 * la sangre es expulsada del tejido y el flash ilumina directamente el
 * sensor → la señal se aplana y NO hay pulso AC detectable.
 */
export function detectRawSaturation(rawSignal) {
  if (!Array.isArray(rawSignal) || rawSignal.length < 10) {
    return { state: 'unknown', mean: 0, std: 0 };
  }

  const n = rawSignal.length;
  const mean = rawSignal.reduce((a, b) => a + b, 0) / n;
  const variance = rawSignal.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  let state = 'ok';
  if (mean >= SAT_HIGH) {
    state = 'saturated_high';
  } else if (mean <= SAT_LOW) {
    state = 'saturated_low';
  }

  return { state, mean: Math.round(mean), std: Math.round(std * 100) / 100 };
}

// ─── Detección de dedo (finger detection) ────────────────────────────────────
/**
 * Evalúa si hay un dedo correctamente colocado sobre la cámara.
 *
 * Condiciones para "dedo válido":
 * 1. R_mean entre 30 y 230 (ni muy oscuro ni saturado de luz)
 * 2. Desviación estándar > 0.5 (hay variación AC = pulso)
 * 3. Si std es muy baja pero R_mean es alta → SATURADO (presiona menos)
 * 4. Si std es muy baja y R_mean muy baja → SIN DEDO
 *
 * @param {number[]} rawSignal - Señal RAW en escala 0-255
 * @returns {object} { fingerPresent, state, message }
 */
export function detectFinger(rawSignal) {
  if (!Array.isArray(rawSignal) || rawSignal.length < 5) {
    return { fingerPresent: false, state: 'waiting', message: 'Esperando datos...' };
  }

  const n = rawSignal.length;
  const mean = rawSignal.reduce((a, b) => a + b, 0) / n;
  const variance = rawSignal.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  // Señal plana con R_mean alto → saturación por exceso de presión
  if (mean >= SAT_HIGH) {
    return {
      fingerPresent: false,
      state: 'saturated_high',
      message: '🔴 Presionas demasiado fuerte — reduce la presión del dedo',
      mean: Math.round(mean),
      std: Math.round(std * 100) / 100,
    };
  }

  // Señal plana con R_mean bajo → sin dedo o muy oscuro
  if (mean <= SAT_LOW) {
    return {
      fingerPresent: false,
      state: 'no_finger',
      message: '👆 Coloca el dedo cubriendo completamente la cámara y el flash',
      mean: Math.round(mean),
      std: Math.round(std * 100) / 100,
    };
  }

  // R_mean en rango pero sin variación AC → hay dedo pero señal plana
  if (std < 0.5) {
    return {
      fingerPresent: false,
      state: 'low_ac',
      message: '⚠️ Señal plana — ajusta la presión del dedo',
      mean: Math.round(mean),
      std: Math.round(std * 100) / 100,
    };
  }

  // R_mean en rango + variación AC suficiente → DEDO VÁLIDO
  return {
    fingerPresent: true,
    state: 'valid',
    message: '✅ Señal detectada',
    mean: Math.round(mean),
    std: Math.round(std * 100) / 100,
  };
}

// ─── FFT ──────────────────────────────────────────────────────────────────────
function fft(signal) {
  const N = signal.length;
  if (N <= 1) return signal.map(x => ({ re: x, im: 0 }));
  let size = 1;
  while (size < N) size <<= 1;
  const padded = new Array(size).fill(0);
  for (let i = 0; i < N; i++) padded[i] = signal[i];
  const out = padded.map(x => ({ re: x, im: 0 }));
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const t = out[i]; out[i] = out[j]; out[j] = t; }
  }
  for (let len = 2; len <= size; len <<= 1) {
    const ang = (2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = -Math.sin(ang);
    for (let i = 0; i < size; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = out[i + j].re, ui = out[i + j].im;
        const vr = out[i + j + len / 2].re * cr - out[i + j + len / 2].im * ci;
        const vi = out[i + j + len / 2].re * ci + out[i + j + len / 2].im * cr;
        out[i + j].re = ur + vr; out[i + j].im = ui + vi;
        out[i + j + len / 2].re = ur - vr; out[i + j + len / 2].im = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
  return out;
}

// ─── Ventana Hanning ──────────────────────────────────────────────────────────
function hanningWindow(signal) {
  return signal.map((v, i) => v * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (signal.length - 1))));
}

// ─── SNR ──────────────────────────────────────────────────────────────────────
export function computeSNR(signal, fps) {
  if (!Array.isArray(signal) || signal.length < 2) return 0;
  const windowed = hanningWindow(signal);
  const spectrum = fft(windowed);
  const N = spectrum.length;
  const freqRes = fps / N;
  const minBin = Math.floor(0.5 / freqRes);
  const maxBin = Math.ceil(4.0 / freqRes);
  let bandPower = 0, totalPower = 0;
  for (let i = 0; i < N / 2; i++) {
    const power = spectrum[i].re ** 2 + spectrum[i].im ** 2;
    totalPower += power;
    if (i >= minBin && i <= maxBin) bandPower += power;
  }
  const noisePower = totalPower - bandPower;
  if (noisePower <= 0) return 0;
  return 10 * Math.log10(bandPower / noisePower);
}

// ─── Filtro de Kalman ────────────────────────────────────────────────────────
let kalmanState = { x: 0, P: 1 };
export function resetKalman() { kalmanState = { x: 0, P: 1 }; }
export function kalmanUpdate(measurement, Q = 0.01, R = 1) {
  if (kalmanState.x === 0 && kalmanState.P === 1) {
    kalmanState.x = measurement;
    kalmanState.P = 0.5;
    return measurement;
  }
  const xPred = kalmanState.x;
  const PPred = kalmanState.P + Q;
  const K = PPred / (PPred + R);
  const xNew = xPred + K * (measurement - xPred);
  const PNew = (1 - K) * PPred;
  kalmanState.x = xNew;
  kalmanState.P = PNew;
  return xNew;
}

// ─── BPM por FFT ─────────────────────────────────────────────────────────────
export function estimateBPMFromFFT(signal, fps = 19) {
  if (signal.length < fps * 5) return 0;
  const windowed = signal.map((v, i) => v * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (signal.length - 1))));
  const spectrum = fft(windowed);
  const N = spectrum.length;
  const freqRes = fps / N;
  const minBin = Math.max(1, Math.ceil(0.67 / freqRes));
  const maxBin = Math.floor(3.33 / freqRes);

  const peaks = [];
  for (let i = minBin; i <= maxBin && i < N / 2; i++) {
    const power = spectrum[i].re ** 2 + spectrum[i].im ** 2;
    peaks.push({ bin: i, power });
  }
  peaks.sort((a, b) => b.power - a.power);
  if (peaks.length === 0) return 0;

  const topBin = peaks[0].bin;
  const topBPM = Math.round(topBin * freqRes * 60);

  if (peaks.length > 1) {
    const doubleBin = topBin * 2;
    const doublePower = doubleBin < N / 2
      ? (spectrum[doubleBin].re ** 2 + spectrum[doubleBin].im ** 2) : 0;
    const doubleBPM = Math.round(doubleBin * freqRes * 60);
    if (doublePower > peaks[0].power * 0.35 && doubleBPM >= 40 && doubleBPM <= 180) {
      return doubleBPM;
    }
  }
  return topBPM >= 40 && topBPM <= 200 ? topBPM : 0;
}

// ─── Detección de picos con pre-normalización z-score ────────────────────────
/**
 * MEJORADO v4.3: Antes de buscar picos, normaliza la señal por z-score
 * para que el umbral adaptativo del 10% funcione aunque haya offset residual.
 * Esto evita el caso donde 5 latidos en 1800 frames se perdían por offset DC.
 */
export function detectPeaks(signal, fps = 19) {
  if (signal.length < 10) return [];

  // Pre-normalización z-score para eliminar cualquier offset residual
  const n = signal.length;
  const mean = signal.reduce((a, b) => a + b, 0) / n;
  const variance = signal.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  if (std < 0.001) return []; // señal plana → sin picos
  const normalized = signal.map(v => (v - mean) / std);

  // Rango dinámico post-normalización
  const maxVal = Math.max(...normalized);
  const minVal = Math.min(...normalized);
  const signalRange = maxVal - minVal;
  if (signalRange < 0.01) return [];

  // Derivada
  const derivative = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    derivative[i] = normalized[i] - normalized[i - 1];
  }

  const peaks = [];
  const minDist = Math.max(2, Math.floor(fps * 0.2));
  // Umbral adaptativo REDUCIDO al 10% del rango dinámico (antes 15%)
  const amplitudeThreshold = signalRange * 0.10;

  for (let i = 1; i < derivative.length - 1; i++) {
    if (derivative[i] > 0 && derivative[i + 1] <= 0) {
      const idx = i + 1;
      const peakVal = normalized[idx];
      let valleyVal = peakVal;
      for (let j = idx - 1; j >= Math.max(0, idx - Math.floor(fps * 0.5)); j--) {
        if (normalized[j] < valleyVal) valleyVal = normalized[j];
      }
      const peakAmplitude = peakVal - valleyVal;
      if (peakAmplitude < amplitudeThreshold) continue;
      if (peaks.length === 0 || idx - peaks[peaks.length - 1] >= minDist) {
        peaks.push(idx);
      }
    }
  }
  return peaks;
}

// ─── BPM desde picos ─────────────────────────────────────────────────────────
export function calculateBPMFromPeaks(peaks, fps = 19) {
  if (peaks.length < 3) return { bpm: 0, rrIntervals: [], confidence: 0, sdnn: 0 };
  const rrRaw = [];
  for (let i = 1; i < peaks.length; i++) {
    const ms = ((peaks[i] - peaks[i - 1]) / fps) * 1000;
    if (ms >= 300 && ms <= 1800) rrRaw.push(ms);
  }
  if (rrRaw.length < 2) return { bpm: 0, rrIntervals: [], confidence: 0, sdnn: 0 };
  const sorted = [...rrRaw].sort((a, b) => a - b);
  const medianRR = sorted[Math.floor(sorted.length / 2)];
  const rrFiltered = rrRaw.filter(rr => Math.abs(rr - medianRR) / medianRR < 0.4);
  if (rrFiltered.length < 2) return { bpm: 0, rrIntervals: [], confidence: 0, sdnn: 0 };
  const meanRR = rrFiltered.reduce((a, b) => a + b, 0) / rrFiltered.length;
  const bpm = Math.round(60000 / meanRR);
  if (bpm < 40 || bpm > 200) return { bpm: 0, rrIntervals: rrFiltered, confidence: 0, sdnn: 0 };
  const sdnn = Math.sqrt(rrFiltered.reduce((s, rr) => s + (rr - meanRR) ** 2, 0) / rrFiltered.length);
  const confidence = Math.min(1, (rrFiltered.length / 8) * Math.max(0.3, 1 - sdnn / 200));
  return { bpm, rrIntervals: rrFiltered, confidence, sdnn };
}

// ─── Calidad de señal ─────────────────────────────────────────────────────────
export function signalQuality(signal, peaks, fps = 19) {
  if (signal.length < 10) return 0;
  const amplitude = Math.max(...signal) - Math.min(...signal);
  if (amplitude < 0.1) return 0;
  const amplitudeScore = Math.min(1, amplitude / 5);
  const snr = computeSNR(signal, fps);
  const snrScore = Math.min(1, snr / 20);
  const baseScore = (amplitudeScore + snrScore) / 2;
  if (peaks.length < 3) return baseScore * 0.3;
  const intervals = peaks.slice(1).map((p, i) => p - peaks[i]);
  const meanInt = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const cv = meanInt > 0
    ? Math.sqrt(intervals.reduce((s, v) => s + (v - meanInt) ** 2, 0) / intervals.length) / meanInt
    : 1;
  return Math.min(1, baseScore * 0.5 + Math.max(0, 1 - cv) * 0.5);
}

// ─── Morfología de onda ───────────────────────────────────────────────────────
export function extractWaveMorphology(signal, peaks, fps = 19, snr = 0) {
  if (peaks.length < 3) {
    return { ptt: 0, risingSlope: 0, augmentationIndex: 0, pulseWidth: 0, dicroticNotch: 0 };
  }
  const enableAdvancedFeatures = snr >= 10;
  const morphologies = peaks.slice(0, -1).map((peakIdx, i) => {
    const nextPeak = peaks[i + 1];
    const beat = signal.slice(peakIdx, nextPeak);
    if (beat.length < 4) return null;
    const peakVal = Math.max(...beat);
    const valleyVal = Math.min(...beat);
    const amp = peakVal - valleyVal || 1;
    const peakPos = beat.indexOf(peakVal);
    const riseTime = Math.max(1, peakPos) / fps;

    const searchStart = Math.floor(beat.length * 0.5);
    const searchEnd = Math.floor(beat.length * 0.9);
    let notchVal = peakVal;
    for (let j = searchStart; j < Math.min(searchEnd, beat.length); j++) {
      if (beat[j] < notchVal) notchVal = beat[j];
    }

    let augmentationIndex = 0;
    if (enableAdvancedFeatures) {
      const shoulderStart = Math.floor(beat.length * 0.2);
      const shoulderEnd = Math.floor(beat.length * 0.5);
      for (let j = shoulderStart; j < Math.min(shoulderEnd, beat.length); j++) {
        if (beat[j] < beat[j - 1] && beat[j] < beat[j + 1]) {
          augmentationIndex = (peakVal - beat[j]) / amp;
          break;
        }
      }
    }
    const notchDepth = enableAdvancedFeatures ? (peakVal - notchVal) / amp : 0;
    return { ptt: riseTime * 1000, risingSlope: amp / riseTime, augmentationIndex, pulseWidth: (beat.length / fps) * 1000, dicroticNotch: notchDepth };
  }).filter(Boolean);
  if (morphologies.length === 0) {
    return { ptt: 0, risingSlope: 0, augmentationIndex: 0, pulseWidth: 0, dicroticNotch: 0 };
  }
  const avg = key => morphologies.reduce((a, b) => a + b[key], 0) / morphologies.length;
  return { ptt: avg('ptt'), risingSlope: avg('risingSlope'), augmentationIndex: avg('augmentationIndex'), pulseWidth: avg('pulseWidth'), dicroticNotch: avg('dicroticNotch') };
}

// ─── Proceso completo ─────────────────────────────────────────────────────────
export function processPPGSignal(rawValues, fpsPassed = 19) {
  const fps = rawValues.length > 60
    ? Math.round(rawValues.length / 60)
    : fpsPassed;

  if (rawValues.length < fps * 5) {
    return { ready: false, reason: `Insuficiente: ${rawValues.length} frames` };
  }

  // --- Detrend mejorado (2 pasos) ---
  const detrended = detrend(rawValues);

  // --- Suavizado ---
  const smoothed = movingAverage(detrended, 1);

  // --- Butterworth bandpass ---
  const filtered = bandpassFilter(smoothed, fps);

  // --- Detección de picos con pre-normalización z-score ---
  const peaks = detectPeaks(filtered, fps);

  // --- Métricas ---
  const snr = computeSNR(filtered, fps);
  const satInfo = detectRawSaturation(rawValues);
  const saturated = satInfo.state !== 'ok';

  // Validación SNR mínima
  if (snr < MIN_SNR_DB && rawValues.length > fps * 10) {
    return {
      ready: false, reason: `SNR demasiado baja: ${snr.toFixed(1)} dB`,
      snr, saturated, saturationState: satInfo.state,
      stability: 0, quality: 0, confidence: 0, bpm: 0, bpmFFT: 0, bpmPeaks: 0,
    };
  }

  const peaksResult = calculateBPMFromPeaks(peaks, fps);
  const bpmFFT = estimateBPMFromFFT(filtered, fps);
  const stability = peaksResult.sdnn ? Math.max(0, 1 - peaksResult.sdnn / 200) : 0;

  let bpm = 0, confidence = 0;
  if (bpmFFT >= 40 && bpmFFT <= 200 && peaksResult.bpm >= 40 && peaksResult.bpm <= 200) {
    const diff = Math.abs(bpmFFT - peaksResult.bpm);
    if (diff <= 10) {
      bpm = Math.round(bpmFFT * 0.6 + peaksResult.bpm * 0.4);
      confidence = Math.min(1, peaksResult.confidence + 0.2);
    } else {
      bpm = bpmFFT;
      confidence = 0.5;
    }
  } else if (bpmFFT >= 40 && bpmFFT <= 200) {
    bpm = bpmFFT;
    confidence = 0.5;
  } else if (peaksResult.bpm >= 40 && peaksResult.bpm <= 200) {
    bpm = peaksResult.bpm;
    confidence = peaksResult.confidence;
  }

  const kalmanBPM = kalmanUpdate(bpm);
  bpm = Math.round(kalmanBPM);
  const quality = signalQuality(filtered, peaks, fps);
  const morphology = peaks.length >= 3
    ? extractWaveMorphology(filtered, peaks, fps, snr)
    : { ptt: 0, risingSlope: 0, augmentationIndex: 0, pulseWidth: 0, dicroticNotch: 0 };

  return {
    ready: bpm >= 40 && bpm <= 200,
    bpm, kalmanBPM, bpmFFT, bpmPeaks: peaksResult.bpm,
    rrIntervals: peaksResult.rrIntervals || [],
    sdnn: peaksResult.sdnn || 0,
    confidence, quality, snr, saturated,
    saturationState: satInfo.state,
    saturationMean: satInfo.mean,
    stability, morphology,
    filteredSignal: filtered, peaks,
  };
}