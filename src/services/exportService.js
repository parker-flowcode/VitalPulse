/**
 * exportService.js — VitalPulse
 *
 * Servicio de exportación de datos: CSV, texto plano y Share API.
 */
import { Share, Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { classifyBPM, classifyBP } from '../utils/bpEstimator';

// ─── Generar CSV del historial completo ─────────────────────────────────────
export function generateCSV(history) {
  const header = [
    'Fecha',
    'Hora',
    'BPM',
    'BPM_FFT',
    'BPM_Picos',
    'PA_Sistólica',
    'PA_Diastólica',
    'PA_Calibrada',
    'HRV_SDNN_ms',
    'Calidad_Señal',
    'Confianza',
    'SNR_dB',
    'Estabilidad',
    'Saturada',
    'Latidos_Detectados',
    'Frames_Capturados',
  ];

  const rows = history.map((m) => {
    const date = new Date(m.timestamp);
    return [
      date.toLocaleDateString('es-ES'),
      date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      m.bpm ?? '',
      m.bpmFFT ?? '',
      m.bpmPeaks ?? '',
      m.bp?.systolic ?? '',
      m.bp?.diastolic ?? '',
      m.bp?.isCalibrated ? 'Sí' : 'No',
      m.sdnn ? Math.round(m.sdnn) : '',
      m.quality ? Math.round(m.quality * 100) + '%' : '',
      m.confidence ? Math.round(m.confidence * 100) + '%' : '',
      m.snr ? m.snr.toFixed(1) : '',
      m.stability ? Math.round(m.stability * 100) + '%' : '',
      m.saturated ? 'Sí' : 'No',
      m.rrIntervals?.length ?? '',
      m.signalLength ?? '',
    ];
  });

  const csvLines = [header.join(';'), ...rows.map((r) => r.join(';'))];
  return csvLines.join('\n');
}

// ─── Generar resumen de texto para compartir ────────────────────────────────
export function generateSummary(measurement) {
  const date = new Date(measurement.timestamp || Date.now());
  const dateStr = date.toLocaleString('es-ES', {
    weekday: 'long', day: '2-digit', month: 'long',
    hour: '2-digit', minute: '2-digit',
  });

  const lines = [
    `🫀 VitalPulse — Resultado de medición`,
    `📅 ${dateStr}`,
    ``,
    `❤️ Frecuencia cardíaca: ${measurement.bpm} BPM`,
  ];

  if (measurement.bp) {
    lines.push(`🩸 Presión arterial: ${measurement.bp.systolic}/${measurement.bp.diastolic} mmHg`);
    lines.push(`   ${measurement.bp.isCalibrated ? '✅ Calibrado' : '⚡ Sin calibración (orientativo)'}`);
  }

  if (measurement.sdnn) {
    lines.push(`📊 HRV (SDNN): ${Math.round(measurement.sdnn)} ms`);
  }

  if (measurement.quality) {
    lines.push(`📶 Calidad de señal: ${Math.round(measurement.quality * 100)}%`);
  }

  const bpmClass = classifyBPM(measurement.bpm);
  lines.push(`🏷️ Clasificación FC: ${bpmClass.label}`);
  if (measurement.bp) {
    const bpClass = classifyBP(measurement.bp.systolic, measurement.bp.diastolic);
    lines.push(`🏷️ Clasificación PA: ${bpClass.label}`);
  }

  lines.push(``);
  lines.push(`— Generado por VitalPulse`);
  lines.push(`⚠️ Esta app no es un dispositivo médico. Consulte a su médico.`);

  return lines.join('\n');
}

// ─── Compartir CSV usando la API de Share ───────────────────────────────────
export async function shareCSV(csvContent, filename = 'vitalpulse_historial.csv') {
  try {
    if (await Sharing.isAvailableAsync()) {
      // Guardar archivo temporal y compartir
      const fileUri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Compartir historial de VitalPulse',
      });
      return true;
    } else {
      // Fallback: Share API de React Native
      await Share.share({
        message: csvContent,
        title: 'Historial VitalPulse',
      });
      return true;
    }
  } catch (e) {
    console.warn('[Export] Error al compartir CSV:', e.message);
    return false;
  }
}

// ─── Compartir resumen de medición como texto ──────────────────────────────
export async function shareMeasurementSummary(measurement) {
  const text = generateSummary(measurement);
  try {
    await Share.share({
      message: text,
      title: 'Resultado VitalPulse',
    });
    return true;
  } catch (e) {
    console.warn('[Export] Error al compartir resumen:', e.message);
    return false;
  }
}

// ─── Obtener nombre de archivo con fecha ────────────────────────────────────
export function getExportFilename(prefix = 'vitalpulse', extension = 'csv') {
  const now = new Date();
  const dateStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return `${prefix}_${dateStr}.${extension}`;
}