import React, { useCallback, useRef, useMemo, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet, Alert,
  Animated, RefreshControl, PanResponder, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useHealthStore from '../store/healthstore';
import { classifyBPM, classifyBP } from '../utils/bpEstimator';
import BannerAd from '../components/BannerAd';
import { COLORS, SHADOWS, SPACING, RADIUS } from '../theme/designTokens';

const SWIPE_THRESHOLD = -80;

const SECTION_ORDER = ['Hoy', 'Ayer', 'Esta semana', 'Este mes', 'Anteriores'];

function getDateGroup(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today - dateStart) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';

  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(monday.getDate() + mondayOffset);
  if (dateStart >= monday) return 'Esta semana';

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  if (dateStart >= monthStart) return 'Este mes';

  return 'Anteriores';
}

function SwipeableItem({ item, onDelete }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isSwipedOpen = useRef(false);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
    onPanResponderGrant: () => {},
    onPanResponderMove: (_, gs) => {
      const clamped = Math.max(-120, Math.min(0, gs.dx));
      translateX.setValue(clamped);
      isSwipedOpen.current = clamped < SWIPE_THRESHOLD;
    },
    onPanResponderRelease: () => {
      if (isSwipedOpen.current) {
        Animated.timing(translateX, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(translateX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
        isSwipedOpen.current = false;
      }
    },
    onPanResponderTerminate: () => {
      Animated.timing(translateX, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      isSwipedOpen.current = false;
    },
  }), [translateX]);

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
      'Eliminar medicion',
      'Eliminar la medicion de ' +
        new Date(item.timestamp).toLocaleDateString('es-ES') +
        '?',
      [
        { text: 'Cancelar', style: 'cancel', onPress: resetPosition },
        { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(item.id) },
      ]
    );
  };

  const bpm = item.bpm || 0;
  const bpmClass = classifyBPM(bpm);
  const bpClass =
    item.bp?.systolic && item.bp?.diastolic
      ? classifyBP(item.bp.systolic, item.bp.diastolic)
      : null;

  let dateStr = '';
  try {
    dateStr = new Date(item.timestamp).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    dateStr = 'Fecha desconocida';
  }

  const dotColor = bpmClass?.color || COLORS.textMuted;
  const badgeBg = bpmClass?.color ? bpmClass.color + '18' : COLORS.border;

  return (
    <View style={styles.swipeContainer}>
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={handleDelete}
        activeOpacity={0.8}
      >
        <Text style={styles.deleteActionIcon}>🗑</Text>
        <Text style={styles.deleteActionLabel}>Eliminar</Text>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.item,
          SHADOWS.card,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.itemContent}>
          <View style={styles.itemTopRow}>
            <View style={styles.dotWrapper}>
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
            </View>
            <Text style={styles.itemDate}>{dateStr}</Text>
          </View>
          <View style={styles.itemBottomRow}>
            <View style={styles.metricsBlock}>
              <Text style={[styles.bpmValue, { color: bpmClass?.color || COLORS.textPrimary }]}>
                {bpm}
              </Text>
              <Text style={styles.bpmUnit}>BPM</Text>
            </View>
            {bpClass && item.bp && (
              <View style={styles.bpBlock}>
                <Text style={[styles.bpValue, { color: COLORS.textSecondary }]}>
                  {item.bp.systolic}/{item.bp.diastolic}
                </Text>
                <Text style={styles.bpUnit}>mmHg</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.itemRightSection}>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: bpmClass?.color || COLORS.textSecondary }]}>
              {bpmClass?.label || '--'}
            </Text>
          </View>
          {bpClass && (
            <Text style={[styles.bpCategory, { color: bpClass.color }]}>
              {bpClass.label}
            </Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

function SearchBar({ value, onChangeText }) {
  return (
    <View style={styles.searchOuter}>
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por fecha o BPM..."
          placeholderTextColor={COLORS.textMuted}
          value={value}
          onChangeText={onChangeText}
          returnKeyType="search"
          autoCorrect={false}
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => onChangeText('')}
            style={styles.searchClearHit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.searchClearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const { history, clearHistory, deleteMeasurement, loadAll } = useHealthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const handleScrollBeginDrag = useCallback(() => {}, []);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Borrar historial',
      'Seguro que quieres eliminar todas las mediciones? Esta accion no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar todo', style: 'destructive', onPress: clearHistory },
      ]
    );
  }, [clearHistory]);

  const handleDeleteItem = useCallback(
    async (id) => {
      await deleteMeasurement(id);
    },
    [deleteMeasurement]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const sections = useMemo(() => {
    const base = search.trim()
      ? history.filter((item) => {
          const dateStr = new Date(item.timestamp).toLocaleDateString('es-ES');
          const bpmStr = String(item.bpm || '');
          const q = search.toLowerCase();
          return dateStr.toLowerCase().includes(q) || bpmStr.includes(search);
        })
      : [...history];

    const groups = {};
    base.forEach((item) => {
      const group = getDateGroup(item.timestamp);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });

    return SECTION_ORDER.filter((key) => groups[key]?.length > 0).map((key) => ({
      title: key,
      data: groups[key],
    }));
  }, [history, search]);

  const hasData = history.length > 0;
  const hasFilteredData = sections.some((s) => s.data.length > 0);
  const isSearching = search.trim().length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Historial</Text>
        {hasData && (
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.clearBtn}>Borrar todo</Text>
          </TouchableOpacity>
        )}
      </View>

      <SearchBar value={search} onChangeText={setSearch} />

      {!hasData && !isSearching ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Sin mediciones guardadas</Text>
          <Text style={styles.emptySub}>
            Las mediciones apareceran aqui automaticamente
          </Text>
        </View>
      ) : !hasFilteredData ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptySub}>
            Intenta con otra busqueda
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id || item.timestamp}
          renderItem={({ item }) => (
            <SwipeableItem item={item} onDelete={handleDeleteItem} />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>
                {section.title.toUpperCase()}
              </Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={handleScrollBeginDrag}
          ListFooterComponent={() => (
            <View style={styles.footer}>
              <BannerAd compact />
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
              progressBackgroundColor={COLORS.bg}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  clearBtn: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  searchOuter: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  searchClearHit: {
    padding: 4,
    marginLeft: 4,
  },
  searchClearIcon: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    marginTop: 12,
    marginBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  swipeContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 90,
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  deleteActionLabel: {
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dotWrapper: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
    overflow: 'hidden',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemDate: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 16,
  },
  metricsBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  bpmValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  bpmUnit: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  bpBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  bpValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  bpUnit: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  itemRightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bpCategory: {
    fontSize: 10,
    fontWeight: '600',
  },
  separator: {
    height: 0,
  },
  footer: {
    marginTop: 12,
    paddingBottom: 20,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
