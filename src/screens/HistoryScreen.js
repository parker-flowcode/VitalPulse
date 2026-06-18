import React, { useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
  Animated, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useHealthStore from '../store/healthstore';
import { classifyBPM, classifyBP } from '../utils/bpEstimator';

const SWIPE_THRESHOLD = -80;

function SwipeableItem({ item, onDelete }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const panRef = useRef(null);
  const isSwipedOpen = useRef(false);

  const resetPosition = (animated = true) => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: animated ? 200 : 0,
      useNativeDriver: true,
    }).start();
    isSwipedOpen.current = false;
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar medición',
      `¿Eliminar la medición de ${new Date(item.timestamp).toLocaleDateString('es-ES')}?`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: resetPosition },
        { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(item.id) },
      ]
    );
  };

  // BPM data
  const bpm = item.bpm || 0;
  const bpmClass = classifyBPM(bpm);
  const bpClass =
    item.bp?.systolic && item.bp?.diastolic
      ? classifyBP(item.bp.systolic, item.bp.diastolic)
      : null;

  let dateStr = '';
  try {
    dateStr = new Date(item.timestamp).toLocaleString('es-ES', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    dateStr = 'Fecha desconocida';
  }

  const onTouchStart = (evt) => {
    panRef.current = { startX: evt.nativeEvent.pageX, startY: evt.nativeEvent.pageY };
  };

  const onTouchMove = (evt) => {
    if (!panRef.current) return;
    const dx = evt.nativeEvent.pageX - panRef.current.startX;
    const dy = evt.nativeEvent.pageY - panRef.current.startY;
    // Only horizontal swipes
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      const clamped = Math.max(-120, Math.min(0, dx));
      translateX.setValue(clamped);
      isSwipedOpen.current = clamped < SWIPE_THRESHOLD;
    }
  };

  const onTouchEnd = () => {
    if (isSwipedOpen.current) {
      Animated.timing(translateX, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      resetPosition();
    }
    panRef.current = null;
  };

  return (
    <View style={styles.swipeContainer}>
      {/* Delete button behind */}
      <TouchableOpacity style={styles.deleteAction} onPress={handleDelete}>
        <Text style={styles.deleteActionText}>🗑️</Text>
        <Text style={styles.deleteActionLabel}>Eliminar</Text>
      </TouchableOpacity>

      {/* Foreground item */}
      <Animated.View
        style={[styles.item, { transform: [{ translateX }] }]}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <View style={styles.itemLeft}>
          <Text style={styles.itemDate}>{dateStr}</Text>
          <View style={styles.itemMetrics}>
            <Text style={[styles.bpm, { color: bpmClass.color }]}>{bpm} BPM</Text>
            {bpClass && item.bp && (
              <Text style={[styles.bp, { color: bpClass.color }]}>
                {item.bp.systolic}/{item.bp.diastolic} mmHg
              </Text>
            )}
          </View>
        </View>
        <View style={styles.itemRight}>
          <View style={[styles.statusDot, { backgroundColor: bpmClass.color }]} />
          <Text style={[styles.statusLabel, { color: bpmClass.color }]}>
            {bpmClass.label}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function HistoryScreen() {
  const { history, clearHistory, deleteMeasurement, loadAll } = useHealthStore();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Borrar historial',
      '¿Seguro que quieres eliminar todas las mediciones? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar todo', style: 'destructive', onPress: clearHistory },
      ]
    );
  }, [clearHistory]);

  const handleDeleteItem = useCallback(async (id) => {
    await deleteMeasurement(id);
  }, [deleteMeasurement]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Historial</Text>
        {history.length > 0 && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.clearBtn}>Borrar todo</Text>
          </TouchableOpacity>
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>Sin mediciones guardadas</Text>
          <Text style={styles.emptySub}>
            Las mediciones aparecerán aquí automáticamente
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id || item.timestamp}
          renderItem={({ item }) => (
            <SwipeableItem item={item} onDelete={handleDeleteItem} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2BBFA4"
              colors={['#2BBFA4']}
              progressBackgroundColor="#132220"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D1918' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 20, paddingBottom: 12,
  },
  title: { color: '#fff', fontSize: 26, fontWeight: '700' },
  clearBtn: { color: '#F25C54', fontSize: 15 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  swipeContainer: { position: 'relative' },
  item: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#132220', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#1A7F6E22',
  },
  itemLeft: { flex: 1 },
  itemDate: { color: '#4A6A67', fontSize: 12, marginBottom: 8 },
  itemMetrics: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  bpm: { fontSize: 20, fontWeight: '700' },
  bp: { fontSize: 15, fontWeight: '600' },
  itemRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: '#F25C5422',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F25C5433',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionText: { fontSize: 20 },
  deleteActionLabel: { color: '#F25C54', fontSize: 11, fontWeight: '600', marginTop: 2 },
  separator: { height: 8 },
  empty: {
    flex: 1, justifyContent: 'center',
    alignItems: 'center', padding: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptySub: {
    color: '#4A6A67', fontSize: 14,
    textAlign: 'center', marginTop: 8,
  },
});