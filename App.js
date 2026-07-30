import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { ThemeProvider } from './src/theme/ThemeContext';
import { LanguageProvider } from './src/theme/LanguageContext';
import { initAds } from './src/services/ads';
import { initIAP } from './src/services/subscriptions';

export default function App() {
  useEffect(() => {
    initAds();
    initIAP();
  }, []);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <ErrorBoundary>
            <AppNavigator />
          </ErrorBoundary>
        </SafeAreaProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
