import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, { Polyline, Line } from 'react-native-svg';

export default function WaveformChart({ data = [], width = 300, height = 80 }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const animRef = useRef(null);

  useEffect(() => {
    // BUG FIX: guardar referencia al loop para poder detenerlo al desmontar
    animRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    animRef.current.start();

    return () => {
      animRef.current?.stop();
    };
  }, []);

  // Línea plana cuando no hay datos
  if (data.length < 2) {
    return (
      <Animated.View style={[styles.container, { width, height, opacity }]}>
        <Svg width={width} height={height}>
          <Line
            x1={0}
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="#2BBFA4"
            strokeWidth="1.5"
            opacity="0.3"
          />
        </Svg>
      </Animated.View>
    );
  }

  const displayData = data.slice(-80);
  const minVal = Math.min(...displayData);
  const maxVal = Math.max(...displayData);
  const range = maxVal - minVal;

  // BUG FIX: evitar división por cero cuando la señal es constante
  const safeRange = range < 0.001 ? 1 : range;
  const padding = 6;
  const usableHeight = height - padding * 2;

  const points = displayData
    .map((val, i) => {
      const x = (i / (displayData.length - 1)) * width;
      const y = padding + usableHeight - ((val - minVal) / safeRange) * usableHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <Animated.View style={[styles.container, { width, height, opacity }]}>
      <Svg width={width} height={height}>
        <Polyline
          points={points}
          fill="none"
          stroke="#2BBFA4"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
});
