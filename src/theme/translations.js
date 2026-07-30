/**
 * translations.js — VitalPulse v9.0
 *
 * Centralized translation strings for Spanish and English.
 * Usage: import { translations } from './translations';
 *        translations[lang].home.title
 */
export const translations = {
  es: {
    home: {
      title: 'VitalPulse',
      subtitle: 'Monitor cardiovascular personal',
      available: 'disponibles hoy',
      startMeasurement: 'Iniciar Medición',
      lastMeasurement: 'Última medición',
      noMeasurements: 'Sin mediciones',
      watchAd: 'Ver anuncio (+1)',
      pro: 'VitalPulse Pro',
      tutorial: 'Modo Tutorial',
    },
    measure: {
      title: 'Midiendo pulso',
      instructions: 'Cómo medir correctamente',
      start: 'Iniciar medición',
      cancel: 'Cancelar',
      detecting: 'Detectando...',
      bpmDetected: 'BPM detectado',
      quality: 'Calidad de la señal',
      motion: 'Movimiento — mantén quieto el móvil',
    },
    results: {
      heartRate: 'Frecuencia Cardíaca',
      bloodPressure: 'Presión Arterial',
      quality: 'Calidad de la medición',
      share: 'Compartir resultado',
      calibrate: 'Calibrar con tensiómetro',
      newMeasurement: 'Nueva medición',
      home: 'Inicio',
    },
    history: {
      title: 'Historial',
      search: 'Buscar...',
      deleteAll: 'Borrar todo',
      noMeasurements: 'Sin mediciones guardadas',
    },
    settings: {
      title: 'Ajustes',
      theme: 'Tema',
      language: 'Idioma / Language',
      profile: 'Perfil personal',
      calibration: 'Calibración de PA',
      alerts: 'Alertas de BPM',
      export: 'Exportar datos',
      dataManagement: 'Gestión de datos',
      danger: 'Zona de peligro',
      about: 'Acerca de VitalPulse',
    },
    tabs: {
      home: 'Inicio',
      history: 'Historial',
      analytics: 'Análisis',
      settings: 'Ajustes',
    },
  },
  en: {
    home: {
      title: 'VitalPulse',
      subtitle: 'Personal cardiovascular monitor',
      available: 'available today',
      startMeasurement: 'Start Measurement',
      lastMeasurement: 'Last measurement',
      noMeasurements: 'No measurements',
      watchAd: 'Watch ad (+1)',
      pro: 'VitalPulse Pro',
      tutorial: 'Tutorial Mode',
    },
    measure: {
      title: 'Measuring pulse',
      instructions: 'How to measure correctly',
      start: 'Start measurement',
      cancel: 'Cancel',
      detecting: 'Detecting...',
      bpmDetected: 'BPM detected',
      quality: 'Signal quality',
      motion: 'Movement — keep phone still',
    },
    results: {
      heartRate: 'Heart Rate',
      bloodPressure: 'Blood Pressure',
      quality: 'Measurement Quality',
      share: 'Share result',
      calibrate: 'Calibrate with BP cuff',
      newMeasurement: 'New measurement',
      home: 'Home',
    },
    history: {
      title: 'History',
      search: 'Search...',
      deleteAll: 'Delete all',
      noMeasurements: 'No measurements saved',
    },
    settings: {
      title: 'Settings',
      theme: 'Theme',
      language: 'Language',
      profile: 'Personal Profile',
      calibration: 'BP Calibration',
      alerts: 'BPM Alerts',
      export: 'Export data',
      dataManagement: 'Data Management',
      danger: 'Danger Zone',
      about: 'About VitalPulse',
    },
    tabs: {
      home: 'Home',
      history: 'History',
      analytics: 'Analytics',
      settings: 'Settings',
    },
  },
};

export default translations;
