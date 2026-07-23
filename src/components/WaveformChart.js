/**
 * WaveformChart.js — VitalPulse v4.3
 *
 * Gráfico de línea PPG en tiempo real. Corregido v4.3:
 * - SVG clipPath real (no CSS overflow) para que la línea NUNCA se salga
 * - View contenedor con overflow hidden + borderRadius
 * - Desplazamiento suave: sliding window que escala X de 0 a width
 *   manteniendo los datos viejos a la izquierda y los nuevos a la derecha
 * - Eliminado Rect "clip" que no funcionaba (no hace clip en react-native-svg)
 */
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Defs, ClipPath, Rect } from 'react-native-svg';

// ─── Constantes ──────────────────────────────────────────────────────────────
const PADDING_RATIO = 0.10;       // 10% de padding vertical
const PIXELS_PER_POINT = 3;       // 1 punto cada 3px (windowing)
const STROKE_WIDTH = 2;
const LINE_COLOR = '#2BBFA4';
const EMPTY_LINE_COLOR = '#2A4A47';

// ─── Calcular cuántos puntos mostrar según el ancho ──────────────────────────
function calcWindowSize(width) {
  return Math.max(10, Math.floor(width / PIXELS_PER_POINT));
}

// ─── Comparador personalizado para React.memo ────────────────────────────────
// Compara profundamente el array data para evitar re-renders innecesarios
function areEqual(prevProps, nextProps) {
  if (prevProps.width !== nextProps.width) return false;
  if (prevProps.height !== nextProps.height) return false;
  const prevData = prevProps.data;
  const nextData = nextProps.data;
  if (prevData.length !== nextData.length) return false;
  for (let i = 0; i < prevData.length; i++) {
    if (prevData[i] !== nextData[i]) return false;
  }
  return true;
}

// ─── Componente memoizado con comparador profundo ────────────────────────────
const WaveformChart = React.memo(function WaveformChart({
  data = [],
  width = 300,
  height = 80,
}) {
  // ─── Windowing: tomar solo los últimos N puntos que caben ──────────────────
  const windowSize = useMemo(() => calcWindowSize(width), [width]);
  const displayData = useMemo(() => {
    if (data.length < 2) return [];
    return data.slice(-windowSize);
  }, [data, windowSize]);

  // ─── Calcular coordenadas con padding interno ──────────────────────────────
  const pointsStr = useMemo(() => {
    if (displayData.length < 2) return '';

    const minVal = Math.min(...displayData);
    const maxVal = Math.max(...displayData);
    const range = maxVal - minVal;
    const safeRange = range < 0.001 ? 1 : range;

    const padding = Math.max(4, height * PADDING_RATIO);
    const usableHeight = height - padding * 2;
    const count = displayData.length;

    return displayData
      .map((val, i) => {
        const x = (i / (count - 1)) * width;
        const y = padding + usableHeight - ((val - minVal) / safeRange) * usableHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [displayData, width, height]);

  // ID único para el clipPath (evita conflictos si hay múltiples charts)
  const clipId = useMemo(() => `clip-${Math.random().toString(36).slice(2, 8)}`, []);

  // ─── Sin datos: línea plana ────────────────────────────────────────────────
  if (displayData.length < 2) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Defs>
            <ClipPath id={clipId}>
              <Rect x={-2} y={-2} width={width + 4} height={height + 4} />
            </ClipPath>
          </Defs>
          <Rect
            x={0} y={0} width={width} height={height}
            fill="transparent"
          />
          <Line
            x1={0} y1={height / 2}
            x2={width} y2={height / 2}
            stroke={EMPTY_LINE_COLOR}
            strokeWidth={STROKE_WIDTH}
            opacity="0.3"
            strokeLinecap="round"
          />
        </Svg>
      </View>
    );
  }

  // ─── Con datos: polyline con clipPath real ─────────────────────────────────
  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Rect x={-2} y={-2} width={width + 4} height={height + 4} />
          </ClipPath>
        </Defs>
        {/* Grupo con clipPath — la línea JAMÁS se sale de estos límites */}
        <Polyline
          points={pointsStr}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth={STROKE_WIDTH}
          strokeLinejoin="round"
          strokeLinecap="round"
          clipPath={`url(#${clipId})`}
        />
      </Svg>
    </View>
  );
});

// ─── Estilos ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F1F1E', // Mismo fondo que la card padre
    overflow: 'hidden',
    borderRadius: 8,
  },
});

export default WaveformChart;
