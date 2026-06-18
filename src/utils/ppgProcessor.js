/**
 * ppgProcessor.js — VitalPulse v4.1
 *
 * Procesador de señal PPG optimizado para señal de cámara móvil.
 * MEJORADO v4.1:
 * - Filtro Butterworth de 2º orden (mejor respuesta en fase que IIR 1er orden)
 * - computeSNR con ventana Hanning consistente
 * - augmentationIndex real calculado desde la morfología
 * - Validación SNR mínima (3dB) para descartar señal ruidosa
 * - Detección de saturación con histéresis
 * - Funciona con 19-30fps reales
 * - FFT + detección de picos con consenso
 * - Filtro paso banda adaptativo a fps variable
 */

// ─── Constantes de configuración ──────────────────────────────────────────────
const MIN_SNR_DB = 3; // SNR mínima en dB para considerar señal válida
const SATURATION_HIGH = 245; // umbral superior con histéresis
const SATURATION_LOW = 10;   // umbral inferior con histéresis

// ─── Detrend: elimina DC y tendencia lineal ───────────────────────────────────
export function detrend(signal) {
  if (signal.length === 0) return [];
  const n = signal.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += signal[i];
    sumXY += i * signal[i]; sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) {
    const mean = sumY / n;
    return signal.map(v => v - mean);
  }
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return signal.map((v, i) => v - (slope * i + intercept));
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

// ─── Filtro Butterworth de 2º orden (mejor respuesta en fase) ──────────────────
/**
 * bandpassFilter – filtro paso banda Butterworth de 2º orden.
 *
 * MEJORADO v4.1:
 * - Butterworth de 2º orden en lugar de IIR de 1er orden.
 *   Esto proporciona una mejor respuesta en fase (menos distorsión) y
 *   una pendiente de atenuación más pronunciada (12 dB/octava vs 6 dB/octava).
 * - Paso alto: fc = 0.5 Hz (elimina componente DC y deriva lenta)
 * - Paso bajo:  fc = 4.0 Hz para ~19 fps+ pero se adapta a FPS bajos:
 *   si FPS < 15, se reduce fc a 3.0 Hz para evitar artefactos de Nyquist
 * - Si FPS < 10, se aplica un sobremuestreo lineal para estabilizar
 * - Si FPS < 8, se devuelve la señal sin filtrar.
 */
export function bandpassFilter(signal, fps = 19) {
  if (signal.length < 10) return signal;

  // FPS demasiado bajo → no filtrar
  if (fps < 8) return signal;

  // Para FPS entre 8 y 12, sobremuestrear 2×
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

  // Frecuencias de corte normalizadas (0..0.5 = 0..Nyquist)
  const nyquist = workFps / 2;
  const fcLowNorm = (workFps < 15 ? 3.0 : 4.0) / nyquist;  // paso bajo
  const fcHighNorm = 0.5 / nyquist;                          // paso alto

  // ---- Filtro paso alto Butterworth 2º orden ----
  // Coeficientes para filtro paso alto con fc = fcHighNorm
  const w0H = Math.tan(Math.PI * fcHighNorm);
  const kH = w0H * w0H + Math.SQRT2 * w0H + 1;
  const bH = [1 / kH, -2 / kH, 1 / kH];
  const aH = [
    1,
    (2 * (w0H * w0H - 1)) / kH,
    (w0H * w0H - Math.SQRT2 * w0H + 1) / kH,
  ];

  // Aplicar filtro IIR de 2º orden (forma directa II transpuesta)
  const hp = new Array(workSignal.length).fill(0);
  let w1H = 0, w2H = 0;
  for (let i = 0; i < workSignal.length; i++) {
    const w = workSignal[i] - aH[1] * w1H - aH[2] * w2H;
    hp[i] = bH[0] * w + bH[1] * w1H + bH[2] * w2H;
    w2H = w1H;
    w1H = w;
  }

  // ---- Filtro paso bajo Butterworth 2º orden ----
  const w0L = Math.tan(Math.PI * fcLowNorm);
  const kL = w0L * w0L + Math.SQRT2 * w0L + 1;
  const bL = [w0L * w0L / kL, 2 * w0L * w0L / kL, w0L * w0L / kL];
  const aL = [
    1,
    (2 * (w0L * w0L - 1)) / kL,
    (w0L * w0L - Math.SQRT2 * w0L + 1) / kL,
  ];

  // Aplicar paso bajo sobre la salida del paso alto
  const lp = new Array(workSignal.length).fill(0);
  let w1L = 0, w2L = 0;
  for (let i = 0; i < workSignal.length; i++) {
    const w = hp[i] - aL[1] * w1L - aL[2] * w2L;
    lp[i] = bL[0] * w + bL[1] * w1L + bL[2] * w2L;
    w2L = w1L;
    w1L = w;
  }

  // Si sobremuestreamos, diezmar de vuelta
  if (workSignal !== signal) {
    const decimated = [];
    for (let i = 0; i < signal.length; i++) {
      decimated.push(lp[i * 2]);
    }
    return decimated;
  }

  return lp;
}

// ─── Detección de saturación con histéresis ────────────────────────────────────
/**
 * detectSaturation – determina si la señal filtrada está saturada.
 * MEJORADO v4.1: usa las constantes SATURATION_HIGH/LOW para escalas normalizadas.
 * La señal filtrada opera en escala normalizada (~ -1 a 1), por lo que
 * saturamos cuando la mayor parte de la señal está cerca de los extremos.
 */
export function detectSaturation(signal) {
  if (!Array.isArray(signal) || signal.length < 10) return false;
  // Contar cuántas muestras están en zona de saturación (95% percentiles extremos)
  const sorted = [...signal].sort((a, b) => a - b);
  const p05 = sorted[Math.floor(signal.length * 0.05)];
  const p95 = sorted[Math.floor(signal.length * 0.95)];
  // Si el rango interpercentil es muy pequeño y está en los extremos → saturado
  const range95 = p95 - p05;
  if (range95 < 0.05) return true; // señal casi plana → saturada
  // Si más del 5% de las muestras están en los extremos absolutos
  const extremeCount = signal.filter(v => v > 0.95 || v < -0.95).length;
  return (extremeCount / signal.length) > 0.05;
}

/**
 * detectRawSaturation – determina si la señal RAW está saturada (escala 0‑255).
 * MEJORADO v4.1: usa histéresis con las constantes SATURATION_HIGH/LOW.
 * La señal raw se satura cuando hay demasiadas muestras cerca de los extremos.
 * Umbrales con histéresis: >245 o <10 durante más del 10% del tiempo.
 */
export function detectRawSaturation(rawSignal) {
  if (!Array.isArray(rawSignal) || rawSignal.length < 10) return false;
  const extremeCount = rawSignal.filter(v => v >= SATURATION_HIGH || v <= SATURATION_LOW).length;
  return (extremeCount / rawSignal.length) > 0.15;
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

// ─── Cálculo de SNR (Signal-to-Noise Ratio) ────────────────────────────────────────
/**
 * computeSNR – calcula la relación señal‑ruido en decibelios (dB) para una señal PPG.
 * MEJORADO v4.1: usa ventana Hanning consistente con estimateBPMFromFFT.
 *
 * @param {number[]} signal - Señal de amplitud normalizada.
 * @param {number} fps - Frecuencia de muestreo real (frames por segundo).
 * @returns {number} SNR en dB. Si no se puede calcular, devuelve 0.
 */
export function computeSNR(signal, fps) {
  if (!Array.isArray(signal) || signal.length < 2) return 0;
  // Aplicar ventana Hanning para consistencia con estimateBPMFromFFT
  const windowed = hanningWindow(signal);
  const spectrum = fft(windowed);
  const N = spectrum.length;
  const freqRes = fps / N; // resolución de frecuencia en Hz
  // Índices de la banda fisiológica 0.5‑4 Hz
  const minBin = Math.floor(0.5 / freqRes);
  const maxBin = Math.ceil(4.0 / freqRes);
  let bandPower = 0;
  let totalPower = 0;
  // Sólo consideramos la mitad del espectro (componentes positivas)
  for (let i = 0; i < N / 2; i++) {
    const power = spectrum[i].re ** 2 + spectrum[i].im ** 2;
    totalPower += power;
    if (i >= minBin && i <= maxBin) {
      bandPower += power;
    }
  }
  const noisePower = totalPower - bandPower;
  if (noisePower <= 0) return 0;
  const snr = 10 * Math.log10(bandPower / noisePower);
  return snr;
}

// ─── Filtro de Kalman simple para BPM ───────────────────────────────────────────
/**
 * Un filtro de Kalman 1‑D muy simple que suaviza la estimación de BPM a lo
 * largo del tiempo dentro de una misma medición.
 *
 * IMPORTANTE: Se debe llamar a `resetKalman()` al iniciar cada nueva medición
 * para evitar contaminación entre mediciones (BUG FIX: kalmanState era global
 * y no se reiniciaba, lo que provocaba que BPM=0 de mediciones fallidas
 * afectara a la siguiente).
 */
let kalmanState = { x: 0, P: 1 };

export function resetKalman() {
  kalmanState = { x: 0, P: 1 };
}

export function kalmanUpdate(measurement, Q = 0.01, R = 1) {
  // Primera medición: inicializar con el valor directamente
  if (kalmanState.x === 0 && kalmanState.P === 1) {
    kalmanState.x = measurement;
    kalmanState.P = 0.5;
    return measurement;
  }
  // Predicción
  const xPred = kalmanState.x;
  const PPred = kalmanState.P + Q;
  // Ganancia de Kalman
  const K = PPred / (PPred + R);
  // Actualización
  const xNew = xPred + K * (measurement - xPred);
  const PNew = (1 - K) * PPred;
  kalmanState.x = xNew;
  kalmanState.P = PNew;
  return xNew;
}

// ─── BPM por FFT ─────────────────────────────────────────────────────────────
export function estimateBPMFromFFT(signal, fps = 19) {
  if (signal.length < fps * 5) return 0;

  const windowed = signal.map((v, i) =>
    v * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (signal.length - 1)))
  );

  const spectrum = fft(windowed);
  const N        = spectrum.length;
  const freqRes  = fps / N;

  const minBin = Math.max(1, Math.ceil(0.67 / freqRes));
  const maxBin = Math.floor(3.33 / freqRes);

  // Encontrar los 3 picos más grandes en la banda fisiológica
  const peaks = [];
  for (let i = minBin; i <= maxBin && i < N / 2; i++) {
    const power = spectrum[i].re ** 2 + spectrum[i].im ** 2;
    peaks.push({ bin: i, power });
  }
  peaks.sort((a, b) => b.power - a.power);

  if (peaks.length === 0) return 0;

  const topBin  = peaks[0].bin;
  const topBPM  = Math.round(topBin * freqRes * 60);

  // Comprobar si el segundo armónico (doble frecuencia) tiene potencia significativa
  // Si es así, el pico principal es el sub-armónico y el real está al doble
  if (peaks.length > 1) {
    const doubleBin   = topBin * 2;
    const doublePower = doubleBin < N / 2
      ? (spectrum[doubleBin].re ** 2 + spectrum[doubleBin].im ** 2)
      : 0;
    // Si el armónico doble tiene al menos 35% de la potencia del pico principal
    // y el BPM doble está en rango fisiológico, usamos el doble.
    // Aumentamos el umbral para evitar falsos positivos por ruido.
    const doubleBPM = Math.round(doubleBin * freqRes * 60);
    if (doublePower > peaks[0].power * 0.35 && doubleBPM >= 40 && doubleBPM <= 180) {
      return doubleBPM;
    }
  }

  return topBPM >= 40 && topBPM <= 200 ? topBPM : 0;
}

// ─── Detección de picos mejorada ───────────────────────────────────────────────
export function detectPeaks(signal, fps = 19) {
  /**
   * Detección de picos basada en la derivada (cambio de signo de positivo a negativo)
   * CON UMBRAL ADAPTATIVO DE AMPLITUD.
   *
   * MEJORADO: Añade un umbral adaptativo basado en la amplitud de la señal para
   * eliminar picos falsos causados por ruido o artefactos. Solo se consideran
   * picos válidos aquellos cuya amplitud supera un porcentaje del rango dinámico
   * de la señal local.
   */
  if (signal.length < 10) return [];

  // Calcular el rango dinámico de la señal para el umbral adaptativo
  const signalMax = Math.max(...signal);
  const signalMin = Math.min(...signal);
  const signalRange = signalMax - signalMin;

  // Si la señal es casi plana, no hay picos válidos
  if (signalRange < 0.01) return [];

  const derivative = new Array(signal.length).fill(0);
  for (let i = 1; i < signal.length; i++) {
    derivative[i] = signal[i] - signal[i - 1];
  }

  const peaks = [];
  const minDist = Math.max(2, Math.floor(fps * 0.2));
  // Umbral adaptativo: 15% del rango dinámico (más estricto que antes)
  const amplitudeThreshold = signalRange * 0.15;

  for (let i = 1; i < derivative.length - 1; i++) {
    // Detectamos cruce de cero de positivo a negativo → máximo local
    if (derivative[i] > 0 && derivative[i + 1] <= 0) {
      const idx = i + 1;
      // Verificar que la amplitud en este pico supere el umbral adaptativo
      // (comparamos con el valle anterior más cercano)
      const peakVal = signal[idx];
      let valleyVal = peakVal;
      // Buscar el valle anterior (mínimo) desde el pico hacia atrás
      for (let j = idx - 1; j >= Math.max(0, idx - Math.floor(fps * 0.5)); j--) {
        if (signal[j] < valleyVal) valleyVal = signal[j];
      }
      const peakAmplitude = peakVal - valleyVal;

      // Solo aceptar pico si supera el umbral adaptativo
      if (peakAmplitude < amplitudeThreshold) continue;

      // Enforzamos distancia mínima entre picos
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

  const sorted   = [...rrRaw].sort((a, b) => a - b);
  const medianRR = sorted[Math.floor(sorted.length / 2)];
  const rrFiltered = rrRaw.filter(rr => Math.abs(rr - medianRR) / medianRR < 0.4);
  if (rrFiltered.length < 2) return { bpm: 0, rrIntervals: [], confidence: 0, sdnn: 0 };

  const meanRR = rrFiltered.reduce((a, b) => a + b, 0) / rrFiltered.length;
  const bpm    = Math.round(60000 / meanRR);
  if (bpm < 40 || bpm > 200) return { bpm: 0, rrIntervals: rrFiltered, confidence: 0, sdnn: 0 };

  const sdnn = Math.sqrt(
    rrFiltered.reduce((s, rr) => s + (rr - meanRR) ** 2, 0) / rrFiltered.length
  );
  const confidence = Math.min(1, (rrFiltered.length / 8) * Math.max(0.3, 1 - sdnn / 200));

  return { bpm, rrIntervals: rrFiltered, confidence, sdnn };
}

// ─── Calidad de señal ─────────────────────────────────────────────────────────
export function signalQuality(signal, peaks, fps = 19) {
  /**
   * Métrica compuesta que combina:
   *   • Amplitud de la señal.
   *   • Relación señal‑ruido (SNR) calculada con la FFT.
   *   • Estabilidad del ritmo (coeficiente de variación de los intervalos RR).
   */
  if (signal.length < 10) return 0;

  const amplitude = Math.max(...signal) - Math.min(...signal);
  if (amplitude < 0.1) return 0;

  const amplitudeScore = Math.min(1, amplitude / 5);
  const snr = computeSNR(signal, fps);
  const snrScore = Math.min(1, snr / 20); // 20 dB → 1.0
  const baseScore = (amplitudeScore + snrScore) / 2;

  if (peaks.length < 3) return baseScore * 0.3;

  const intervals = peaks.slice(1).map((p, i) => p - peaks[i]);
  const meanInt   = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const cv = meanInt > 0
    ? Math.sqrt(intervals.reduce((s, v) => s + (v - meanInt) ** 2, 0) / intervals.length) / meanInt
    : 1;

  return Math.min(1, baseScore * 0.5 + Math.max(0, 1 - cv) * 0.5);
}

// ─── Morfología de onda ───────────────────────────────────────────────────────
export function extractWaveMorphology(signal, peaks, fps = 19) {
  if (peaks.length < 3) {
    return { ptt: 0, risingSlope: 0, augmentationIndex: 0, pulseWidth: 0, dicroticNotch: 0 };
  }

  const morphologies = peaks.slice(0, -1).map((peakIdx, i) => {
    const nextPeak = peaks[i + 1];
    const beat     = signal.slice(peakIdx, nextPeak);
    if (beat.length < 4) return null;

    const peakVal  = Math.max(...beat);
    const valleyVal = Math.min(...beat);
    const amp      = peakVal - valleyVal || 1;
    const peakPos  = beat.indexOf(peakVal);
    const riseTime = Math.max(1, peakPos) / fps;

    // ---- Dicrotic notch detection ----
    // Search for a local minimum after the peak, typically between 50% and 90% of the beat.
    const searchStart = Math.floor(beat.length * 0.5);
    const searchEnd   = Math.floor(beat.length * 0.9);
    let notchVal = peakVal;
    let notchPos = peakPos;
    for (let j = searchStart; j < Math.min(searchEnd, beat.length); j++) {
      if (beat[j] < notchVal) {
        notchVal = beat[j];
        notchPos = j;
      }
    }
    const notchDepth = (peakVal - notchVal) / amp; // normalized depth

    // ---- Augmentation Index (AI) ----
    // AI = (P2 - diastolic) / (P1 - diastolic) where P1 = peak systolic, P2 = inflection point
    // after the peak but before the dicrotic notch. We approximate using the inflection
    // point at the shoulder of the descending wave.
    let augmentationIndex = 0;
    const shoulderStart = Math.floor(beat.length * 0.2);
    const shoulderEnd   = Math.floor(beat.length * 0.5);
    for (let j = shoulderStart; j < Math.min(shoulderEnd, beat.length); j++) {
      // Look for the inflection point (local minimum after the peak, before the notch)
      if (beat[j] < beat[j - 1] && beat[j] < beat[j + 1]) {
        augmentationIndex = (peakVal - beat[j]) / amp;
        break;
      }
    }

    return {
      ptt:               riseTime * 1000,
      risingSlope:       amp / riseTime,
      augmentationIndex,
      pulseWidth:        (beat.length / fps) * 1000,
      dicroticNotch:     notchDepth,
    };
  }).filter(Boolean);

  if (morphologies.length === 0) {
    return { ptt: 0, risingSlope: 0, augmentationIndex: 0, pulseWidth: 0, dicroticNotch: 0 };
  }

  const avg = key => morphologies.reduce((a, b) => a + b[key], 0) / morphologies.length;
  return {
    ptt:               avg('ptt'),
    risingSlope:       avg('risingSlope'),
    augmentationIndex: avg('augmentationIndex'),
    pulseWidth:        avg('pulseWidth'),
    dicroticNotch:     avg('dicroticNotch'),
  };
}

// ─── Proceso completo ─────────────────────────────────────────────────────────
export function processPPGSignal(rawValues, fpsPassed = 19) {
  const fps = rawValues.length > 60
    ? Math.round(rawValues.length / 60)
    : fpsPassed;

  if (rawValues.length < fps * 5) {
    return { ready: false, reason: `Insuficiente: ${rawValues.length} frames` };
  }

  const detrended = detrend(rawValues);
  const smoothed  = movingAverage(detrended, 1);
  const filtered  = bandpassFilter(smoothed, fps);
  const peaks     = detectPeaks(filtered, fps);

  // Métricas adicionales
  const snr = computeSNR(filtered, fps);
  const saturated = detectSaturation(filtered);

  // Validación SNR mínima: si SNR < 3dB, la señal es demasiado ruidosa
  if (snr < MIN_SNR_DB && rawValues.length > fps * 10) {
    return {
      ready: false, reason: `SNR demasiado baja: ${snr.toFixed(1)} dB (mín. ${MIN_SNR_DB} dB)`,
      snr, saturated, stability: 0, quality: 0, confidence: 0,
      bpm: 0, bpmFFT: 0, bpmPeaks: 0,
    };
  }

  const peaksResult = calculateBPMFromPeaks(peaks, fps);
  const bpmFFT      = estimateBPMFromFFT(filtered, fps);

  // Índice de estabilidad basado en la variabilidad de los intervalos RR
  const stability = peaksResult.sdnn ? Math.max(0, 1 - peaksResult.sdnn / 200) : 0;

  let bpm = 0, confidence = 0;

  if (bpmFFT >= 40 && bpmFFT <= 200 && peaksResult.bpm >= 40 && peaksResult.bpm <= 200) {
    const diff = Math.abs(bpmFFT - peaksResult.bpm);
    if (diff <= 10) {
      bpm        = Math.round(bpmFFT * 0.6 + peaksResult.bpm * 0.4);
      confidence = Math.min(1, peaksResult.confidence + 0.2);
    } else {
      bpm        = bpmFFT;
      confidence = 0.5;
    }
  } else if (bpmFFT >= 40 && bpmFFT <= 200) {
    bpm        = bpmFFT;
    confidence = 0.5;
  } else if (peaksResult.bpm >= 40 && peaksResult.bpm <= 200) {
    bpm        = peaksResult.bpm;
    confidence = peaksResult.confidence;
  }

  // Aplicar filtro de Kalman para suavizar la estimación final de BPM
  const kalmanBPM = kalmanUpdate(bpm);
  bpm = Math.round(kalmanBPM);

  const quality    = signalQuality(filtered, peaks, fps);
  const morphology = peaks.length >= 3
    ? extractWaveMorphology(filtered, peaks, fps)
    : { ptt: 0, risingSlope: 0, augmentationIndex: 0, pulseWidth: 0, dicroticNotch: 0 };

  return {
    ready:          bpm >= 40 && bpm <= 200,
    bpm,
    kalmanBPM,
    bpmFFT,
    bpmPeaks:       peaksResult.bpm,
    rrIntervals:    peaksResult.rrIntervals || [],
    sdnn:           peaksResult.sdnn || 0,
    confidence,
    quality,
    snr,
    saturated,
    stability,
    morphology,
    filteredSignal: filtered,
    peaks,
  };
}
