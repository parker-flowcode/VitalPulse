# 💚 VitalPulse

**Monitor cardiovascular personal** — Mide tu pulso y estima tu presión arterial usando la cámara de tu móvil.

[![Expo SDK](https://img.shields.io/badge/Expo_SDK-54-000020?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react)](https://reactnative.dev)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Version](https://img.shields.io/badge/Version-4.0.0-blue)](package.json)

---

## ✨ Características

- ❤️ **Medición de frecuencia cardíaca** mediante fotopletismografía (PPG) con la cámara trasera
- 🩸 **Estimación de presión arterial** sistólica/diastólica
- 📊 **Variabilidad cardíaca (HRV)** — métrica SDNN
- 🔬 **Calibración multi-punto** con tensiómetro real para mayor precisión
- 📈 **Historial y tendencias** con gráficas detalladas
- 📤 **Exportación CSV** compatible con Excel y Google Sheets
- 🚫 **Sin servidores** — todos los datos se guardan localmente en el dispositivo
- 💚 **VitalPulse Pro** — mediciones ilimitadas, sin anuncios, calibración avanzada

## 📱 Capturas de pantalla

| Pantalla | Descripción |
|----------|-------------|
| 🏠 Inicio | Botón de medición, última medición, stats rápidas |
| ❤️ Medición | Timer circular,波形, calidad de señal en tiempo real |
| 📊 Resultados | BPM, PA estimada, HRV, calidad, calibración |
| 📋 Historial | Lista con swipe para eliminar y pull-to-refresh |
| ⚙️ Ajustes | Perfil, calibración, alertas, exportación CSV, upgrade Pro |

## 🚀 Cómo empezar

### Requisitos

- Node.js 18+
- Expo CLI
- Una cuenta en [EAS Build](https://expo.dev/eas) (para builds de producción)

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/PoleyDev/VitalPulse.git
cd VitalPulse

# Instalar dependencias
npm install

# Iniciar en desarrollo
npx expo start
```

### Build para producción

```bash
# APK para distribución directa
npm run build:android:apk

# AAB para Google Play Store
npm run build:android:prod

# Subir a Play Console
npm run submit:android
```

## 🏗️ Arquitectura del proyecto

```
VitalPulse/
├── App.js                    # Entry point
├── app.json                  # Configuración Expo
├── assets/                   # Iconos y splash
├── src/
│   ├── components/           # Componentes reutilizables
│   │   ├── BannerAd.js       # Placeholder de anuncios AdMob
│   │   ├── CircularProgress.js # Timer circular animado
│   │   ├── ErrorBoundary.js  # Captura de errores global
│   │   ├── FingerOverlay.js  # Guía visual para el dedo
│   │   ├── LegalDisclaimer.js # Aviso médico
│   │   └── WaveformChart.js  # Gráfica de onda PPG
│   ├── navigation/
│   │   └── AppNavigator.js   # Stack + Tab navigator
│   ├── screens/              # Pantallas de la app
│   │   ├── HomeScreen.js     # Inicio
│   │   ├── MeasureScreen.js  # Medición PPG
│   │   ├── ResultsScreen.js  # Resultados
│   │   ├── HistoryScreen.js  # Historial
│   │   ├── AnalyticsScreen.js# Tendencias
│   │   ├── SettingsScreen.js # Ajustes
│   │   ├── UpgradeScreen.js  # Suscripción Pro
│   │   ├── TutorialScreen.js # Modo tutorial
│   │   ├── CalibrationScreen.js # Calibración guiada
│   │   ├── OnboardingScreen.js  # Primer uso
│   │   ├── PrivacyPolicyScreen.js
│   │   └── TermsScreen.js
│   ├── services/             # Servicios
│   │   ├── ads.js            # Anuncios AdMob
│   │   ├── subscriptions.js  # Suscripciones IAP
│   │   └── exportService.js  # Exportación CSV/Share
│   ├── store/
│   │   └── healthstore.js    # Estado global (Zustand + AsyncStorage)
│   └── utils/
│       ├── bpEstimator.js    # Algoritmo de estimación de PA
│       ├── ppgProcessor.js   # Procesamiento de señal PPG
│       └── __tests__/        # Tests unitarios
```

## 🧪 Tests

```bash
npm test
```

## ⚠️ Aviso médico

Esta aplicación **NO es un dispositivo médico certificado** por la FDA ni la EMA. Los valores mostrados son estimaciones orientativas. Consulte siempre a su médico para diagnóstico o tratamiento.

## 📄 Licencia

MIT — [PoleyDev](https://github.com/PoleyDev)

## 🙏 Agradecimientos

- [react-native-vision-camera](https://github.com/mrousavy/react-native-vision-camera)
- [victory-native](https://github.com/FormidableLabs/victory-native)
- [Expo](https://expo.dev)