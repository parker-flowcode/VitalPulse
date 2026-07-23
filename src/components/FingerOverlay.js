import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';

/**
 * FingerOverlay – muestra una guía visual circular que indica la posición del dedo
 * sobre la cámara trasera. El círculo representa la lente con un borde animado
 * que refleja la calidad de la señal PPG:
 *   • Verde  – calidad alta (> 0.6)
 *   • Naranja – calidad media (> 0.3)
 *   • Rojo   – calidad baja (≤ 0.3)
 * Se muestra en la parte superior central (posición típica de la cámara trasera)
 * con un indicador de flash y texto de ayuda cuando la calidad es baja.
 */
export default function FingerOverlay({ quality }) {
  const { width } = useWindowDimensions();
  const circleSize = Math.min(width * 0.5, 160);

  let borderColor = '#EF4444';
  let bgOpacity = '22';
  if (quality > 0.6) { borderColor = '#10B981'; bgOpacity = '33'; }
  else if (quality > 0.3) { borderColor = '#F59E0B'; bgOpacity = '33'; }

  return (
    <View style={styles.overlayContainer} pointerEvents="none">
      {/* Posición de la cámara trasera (superior central) */}
      <View style={styles.cameraArea}>
        {/* Flash indicator */}
        <View style={styles.flashIndicator}>
          <Text style={styles.flashText}>⚡</Text>
        </View>
        {/* Círculo guía que simula la lente */}
        <View style={[styles.lensCircle, {
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          borderColor: borderColor,
        }]}>
          <View style={[styles.lensInner, {
            width: circleSize * 0.6,
            height: circleSize * 0.6,
            borderRadius: (circleSize * 0.6) / 2,
            borderColor: borderColor,
            backgroundColor: borderColor + bgOpacity,
          }]}>
            <Text style={styles.lensIcon}>📷</Text>
          </View>
        </View>
        {/* Texto de ayuda */}
        {quality <= 0.3 && (
          <Text style={styles.hintText}>Coloca el dedo cubriendo la cámara</Text>
        )}
        {quality > 0.6 && (
          <Text style={styles.okText}>✅ Señal detectada</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  cameraArea: {
    marginTop: 50,
    alignItems: 'center',
    gap: 8,
  },
  flashIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  flashText: {
    fontSize: 14,
  },
  lensCircle: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  lensInner: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lensIcon: {
    fontSize: 24,
    opacity: 0.8,
  },
  hintText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(239,68,68,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  okText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
});
