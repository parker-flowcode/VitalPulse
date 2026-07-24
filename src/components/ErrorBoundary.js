/**
 * ErrorBoundary.js — VitalPulse v5.0
 *
 * Componente Error Boundary que captura errores no manejados en el árbol
 * de React y muestra una pantalla de error amigable.
 */
import React, { Component } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors } from '../theme/designTokens';

const C = lightColors;

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.warn('[ErrorBoundary] Error capturado:', error?.message || error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleClearAndRestart = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const vitalKeys = keys.filter(k => k.startsWith('@vitalpulse_'));
      await AsyncStorage.multiRemove(vitalKeys);
    } catch (e) {
      console.warn('[ErrorBoundary] Error al limpiar datos:', e);
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Error desconocido';
      const errorStack = this.state.error?.stack || '';

      return (
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>Algo salió mal</Text>
            <Text style={styles.subtitle}>Se ha producido un error inesperado en VitalPulse.</Text>

            {__DEV__ && (
              <View style={styles.debugBox}>
                <Text style={styles.debugLabel}>DEBUG:</Text>
                <Text style={styles.debugText}>{errorMsg}</Text>
                {errorStack ? <Text style={styles.debugStack} numberOfLines={8}>{errorStack}</Text> : null}
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardText}>
                Todos tus datos están almacenados solo en este dispositivo y no se han perdido.
              </Text>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={this.handleRetry}>
              <Text style={styles.primaryBtnText}>🔄 Reintentar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dangerBtn} onPress={this.handleClearAndRestart}>
              <Text style={styles.dangerBtnText}>🗑️ Borrar datos locales y reiniciar</Text>
            </TouchableOpacity>

            <Text style={styles.hint}>
              Si el error persiste, prueba a borrar los datos locales con el botón superior.
            </Text>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: C.bg },
  container:       { padding: 24, paddingBottom: 48, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  icon:            { fontSize: 64, marginBottom: 20 },
  title:           { color: C.danger, fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle:        { color: C.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  debugBox:        { backgroundColor: C.bgCard, borderRadius: 12, padding: 14, marginBottom: 20, width: '100%', borderWidth: 1, borderColor: C.danger + '33' },
  debugLabel:      { color: C.danger, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  debugText:       { color: C.warning, fontSize: 13, fontFamily: 'monospace', marginBottom: 8 },
  debugStack:      { color: C.textMuted, fontSize: 10, fontFamily: 'monospace', lineHeight: 14 },
  card:            { backgroundColor: C.bgCard, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: C.border, width: '100%' },
  cardText:        { color: C.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  primaryBtn:      { backgroundColor: C.primary, borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 12, width: '100%' },
  primaryBtnText:  { color: '#fff', fontSize: 17, fontWeight: '700' },
  dangerBtn:       { backgroundColor: 'transparent', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.danger, width: '100%' },
  dangerBtnText:   { color: C.danger, fontSize: 15, fontWeight: '600' },
  hint:            { color: C.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
