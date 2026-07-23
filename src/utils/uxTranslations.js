/**
 * uxTranslations.js — VitalPulse v5.0
 *
 * Traduce métricas técnicas (SNR dB, SDNN ms, etc.) a mensajes UX
 * amigables, siguiendo una jerarquía: resultado principal → calidad → HRV.
 *
 * Actualizado con la paleta de diseño v5 (blanco minimalista).
 */

// ─── Calidad de señal desde SNR ─────────────────────────────────────────────
export function translateSNR(snr) {
  if (snr == null || snr <= 0) return { label: 'Sin datos',    color: '#94A3B8', icon: '📡', order: 0 };
  if (snr >= 15)             return { label: 'Excelente',      color: '#10B981', icon: '🟢', order: 4 };
  if (snr >= 10)             return { label: 'Buena',          color: '#2563EB', icon: '🟡', order: 3 };
  if (snr >= 5)              return { label: 'Aceptable',      color: '#F59E0B', icon: '🟠', order: 2 };
  return                        { label: 'Pobre — recoloca el dedo', color: '#EF4444', icon: '🔴', order: 1 };
}

// ─── Calidad de señal compuesta (desde quality 0-1) ─────────────────────────
export function translateSignalQuality(quality) {
  if (quality == null || quality <= 0)   return { label: 'Esperando señal...',   color: '#94A3B8', icon: '⏳' };
  if (quality >= 0.8)                     return { label: 'Excelente',            color: '#10B981', icon: '🟢' };
  if (quality >= 0.6)                     return { label: 'Buena',                color: '#2563EB', icon: '🟡' };
  if (quality >= 0.3)                     return { label: 'Regular',              color: '#F59E0B', icon: '🟠' };
  return                                    { label: 'Débil — ajusta el dedo',   color: '#EF4444', icon: '🔴' };
}

// ─── Confianza en la medición ───────────────────────────────────────────────
export function translateConfidence(confidence) {
  if (confidence == null || confidence <= 0) return { label: 'Sin evaluar',     color: '#94A3B8' };
  if (confidence >= 0.8)                      return { label: 'Alta',            color: '#10B981' };
  if (confidence >= 0.5)                      return { label: 'Media',           color: '#F59E0B' };
  return                                        { label: 'Baja',               color: '#EF4444' };
}

// ─── HRV (SDNN) traducido ───────────────────────────────────────────────────
export function translateHRV(sdnn, rrCount) {
  // Datos insuficientes
  if (!rrCount || rrCount < 10) {
    return {
      label: 'Medición incompleta',
      description: 'Solo se detectaron ' + (rrCount || 0) + ' latidos. Mantén el dedo 60 segundos completos.',
      color: '#F59E0B',
      icon: '⚠️',
      score: 0,
      showValues: false,
    };
  }
  if (sdnn == null) {
    return { label: 'Sin datos', description: '', color: '#94A3B8', icon: '📡', score: 0, showValues: false };
  }

  let label, description, score, color, icon;
  if (sdnn >= 100) {
    label = 'Excelente variabilidad';
    description = 'Tu sistema nervioso autónomo responde bien. Asociado a mejor salud cardiovascular.';
    score = 4; color = '#059669'; icon = '🌟';
  } else if (sdnn >= 50) {
    label = 'Variabilidad normal';
    description = 'Dentro del rango esperado para adultos sanos.';
    score = 3; color = '#10B981'; icon = '✅';
  } else if (sdnn >= 20) {
    label = 'Variabilidad baja';
    description = 'Puede indicar estrés, fatiga o necesidad de recuperación. Considera descansar.';
    score = 2; color = '#F59E0B'; icon = '⚠️';
  } else {
    label = 'Variabilidad muy baja';
    description = 'Valores bajos sostenidos pueden requerir evaluación médica. Consulta a tu doctor.';
    score = 1; color = '#EF4444'; icon = '🔴';
  }

  return { label, description, color, icon, score, showValues: true, sdnnMs: Math.round(sdnn), latidos: rrCount };
}

// ─── Estabilidad ────────────────────────────────────────────────────────────
export function translateStability(stability) {
  if (stability == null) return { label: '—', color: '#94A3B8' };
  if (stability >= 0.8)  return { label: 'Estable',    color: '#10B981' };
  if (stability >= 0.5)  return { label: 'Moderada',   color: '#F59E0B' };
  return                    { label: 'Inestable',    color: '#EF4444' };
}

// ─── Estado de saturación ───────────────────────────────────────────────────
export function translateSaturated(saturated) {
  if (!saturated) return null; // no mostrar si no hay saturación
  return {
    label: 'Señal saturada',
    description: 'La cámara recibió demasiada o muy poca luz. Ajusta la presión del dedo.',
    color: '#EF4444',
    icon: '💡',
  };
}

// ─── Validación de medición completa ─────────────────────────────────────────
export function validateMeasurement(measurement) {
  const issues = [];

  // 1. Suficientes latidos
  const rrCount = measurement?.rrIntervals?.length || 0;
  if (rrCount < 10) {
    issues.push({
      type: 'error',
      icon: '⏱️',
      title: 'Medición incompleta',
      message: `Solo se detectaron ${rrCount} latidos. Para un resultado fiable, mantén el dedo quieto sobre la cámara durante los 60 segundos completos.`,
    });
  }

  // 2. Calidad de señal mínima
  const quality = measurement?.quality || 0;
  if (quality < 0.3 && measurement?.signalLength > 95) {
    issues.push({
      type: 'warning',
      icon: '👆',
      title: 'Señal débil',
      message: 'La calidad de la señal fue baja. Asegúrate de cubrir completamente la cámara y el flash con el dedo, sin apretar demasiado.',
    });
  }

  // 3. Saturación
  if (measurement?.saturated) {
    issues.push({
      type: 'warning',
      icon: '💡',
      title: 'Señal saturada',
      message: 'El sensor recibió demasiada luz. Prueba con menos presión del dedo sobre la cámara.',
    });
  }

  // 4. Sin calibración
  if (measurement?.bp && !measurement.bp.isCalibrated) {
    issues.push({
      type: 'info',
      icon: '📏',
      title: 'Sin calibración',
      message: 'La presión arterial es una estimación sin calibrar. Para mayor precisión, usa un tensiómetro y calibra desde la pantalla de resultados.',
    });
  }

  return issues;
}
