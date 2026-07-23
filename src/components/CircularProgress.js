/**
 * CircularProgress.js — VitalPulse
 *
 * Barra de progreso circular animada.
 * Útil para mostrar el tiempo restante de medición de forma visual.
 */
import React from 'react';
import Svg, { Circle } from 'react-native-svg';

export default function CircularProgress({
  size = 120,
  strokeWidth = 6,
  progress = 0,      // 0.0 a 1.0
  color = '#2563EB',
  bgColor = '#E2E8F0',
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <Svg width={size} height={size}>
      {/* Círculo de fondo */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={bgColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Círculo de progreso */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}
