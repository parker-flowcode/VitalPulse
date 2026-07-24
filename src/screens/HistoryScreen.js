/**
 * HistoryScreen.js — VitalPulse v5.0
 *
 * Historial premium con fondo blanco, acentos sky blue (#38BDF8),
 * valores BPM / PA con clasificación prominente, agrupación por fecha,
 * búsqueda, deslizar para eliminar y temas dinámicos.
 */
import React, { useCallback, useRef, useMemo, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet, Alert,
  Animated, RefreshControl, PanResponder, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import useHealthStore from '../store/healthstore';
import { classifyBPM, classifyBP } from '../utils/bpEstimator';
import BannerAd from '../components/BannerAd';
import LegalDisclaimer from '../components/LegalDisclaimer';
import { SPACING, RADIUS, SHADOWS } from '../theme/designTokens';

const SWIPE_THRESHOLD = -80;
const SECTION_ORDER = ['Hoy', 'Ayer', 'Esta semana', 'Este mes', 'Anteriores'];
const BPM_CLASS_ORDER = {
  'Bradicardia severa': 0,
  'Bradicardia': 1,
  'Normal': 2,
  'Taquicardia leve': 3,
  'Taquicardia': 4,
  'Taquicardia severa': 5,
};

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

function SwipeableItem({ item, onDelete, colors }) {
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

  // --- BPM ---
  const bpm = item.bpm || 0;
  const bpmClass = classifyBPM(bpm);
  const bpmColor = bpmClass?.color || colors.textMuted;
  const bpmRisk = BPM_CLASS_ORDER[bpmClass?.label] != null
    ? BPM_CLASS_ORDER[bpmClass.label]
    : 2;

  // --- BP ---
  const hasBp = item.bp?.systolic && item.bp?.diastolic;
  const bpClass = hasBp ? classifyBP(item.bp.systolic, item.bp.diastolic) : null;
  const bpColor = bpClass?.color || colors.textMuted;

  // Dates
  const timeStr = (() => {
    try {
      return new Date(item.timestamp).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '--:--';
    }
  })();
  const dateStr = (() => {
    try {
      return new Date(item.timestamp).toLocaleDateString('es-ES', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      });
    } catch {
      return 'Fecha desconocida';
    }
  })();

  return (
    <View style={styles.swipeContainer}>
      <TouchableOpacity
        style={[styles.deleteAction, { backgroundColor: colors.dangerLight }]}
        onPress={handleDelete}
        activeOpacity={0.8}
      >
        <Text style={[styles.deleteActionIcon, { color: colors.danger }]}>🗑</Text>
        <Text style={[styles.deleteActionLabel, { color: colors.danger }]}>Eliminar</Text>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.item,
          SHADOWS.card,
          {
            transform: [{ translateX }],
            backgroundColor: colors.bg,
            borderColor: colors.borderLight,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Sky blue left accent bar */}
        <View style={styles.accentBarWrap}>
          <View
            style={[
              styles.accentBar,
              { backgroundColor: colors.primary },
            ]}
          />
          {/* Risk indicator strip */}
          <View
            style={[
              styles.riskStrip,
              {
                backgroundColor:
                  bpmRisk >= 4
                    ? colors.danger
                    : bpmRisk >= 3
                    ? colors.warning
                    : colors.primary,
              },
            ]}
          />
        </View>

        {/* Main content area */}
        <View style={styles.itemContent}>
          {/* Timestamp row */}
          <View style={styles.itemTopRow}>
            <Text style={[styles.itemDate, { color: colors.textMuted }]}>{dateStr}</Text>
            <Text style={[styles.itemTime, { color: colors.textSecondary }]}>{timeStr}</Text>
          </View>

          {/* Metrics row: BPM | BP */}
          <View style={styles.metricsRow}>
            {/* ─── BPM block ─────────────────────────────── */}
            <View style={styles.metricBlock}>
              <View style={styles.metricValueRow}>
                <Text style={[styles.bpmValue, { color: bpmColor }]}>
                  {bpm}
                </Text>
                <Text style={[styles.bpmUnit, { color: colors.textMuted }]}>
                  BPM
                </Text>
              </View>
              <View
                style={[
                  styles.classBadge,
                  { backgroundColor: bpmColor ? bpmColor + '18' : colors.bgCard },
                ]}
              >
                <View
                  style={[styles.classDot, { backgroundColor: bpmColor }]}
                />
                <Text
                  style={[styles.classText, { color: bpmColor }]}
                  numberOfLines={1}
                >
                  {bpmClass?.label || '--'}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.metricsDivider, { backgroundColor: colors.border }]} />

            {/* ─── BP block ──────────────────────────────── */}
            <View style={styles.metricBlock}>
              <View style={styles.metricValueRow}>
                <Text style={[styles.bpValue, { color: colors.textPrimary }]}>
                  {hasBp
                    ? `${item.bp.systolic}/${item.bp.diastolic}`
                    : '--/--'}
                </Text>
                <Text style={[styles.bpUnit, { color: colors.textMuted }]}>
                  mmHg
                </Text>
              </View>
              {bpClass ? (
                <View
                  style={[
                    styles.classBadge,
                    { backgroundColor: bpColor ? bpColor + '18' : colors.bgCard },
                  ]}
                >
                  <View
                    style={[styles.classDot, { backgroundColor: bpColor }]}
                  />
                  <Text
                    style={[styles.classText, { color: bpColor }]}
                    numberOfLines={1}
                  >
                    {bpClass.label}
                  </Text>
                </View>
              ) : (
                <View style={[styles.classBadge, { backgroundColor: colors.bgCard }]}>
                  <Text style={[styles.classText, { color: colors.textMuted }]}>
                    Sin PA
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function SearchBar({ value, onChangeText, colors }) {
  return (
    <View style={styles.searchOuter}>
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: colors.bg,
            borderColor: value.trim()
              ? colors.primary
              : colors.borderLight,
          },
        ]}
      >
        {/* Search icon */}
        <View style={[styles.searchIconWrap, { backgroundColor: colors.primarySubtle }]}>
          <Text style={[styles.searchIcon, { color: colors.primary }]}>🔍</Text>
        </View>
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Buscar por fecha o BPM..."
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => onChangeText('')}
            style={styles.searchClearHit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={[styles.clearBtnWrap, { backgroundColor: colors.primarySubtle }]}>
              <Text style={[styles.clearBtnIcon, { color: colors.primary }]}>✕</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const { history, clearHistory, deleteMeasurement, loadAll } = useHealthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const listRef = useRef(null);

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

  // ─── Build sections with search filtering ──────────────────────────
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
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Historial
          </Text>
          {hasData && (
            <Text style={[styles.headerCount, { color: colors.textMuted }]}>
              {history.length} {history.length === 1 ? 'medicion' : 'mediciones'}
            </Text>
          )}
        </View>
        {hasData && (
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.clearBtn, { backgroundColor: colors.dangerLight }]}
          >
            <Text style={[styles.clearBtnText, { color: colors.danger }]}>
              Borrar
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Search Bar ─────────────────────────────────────────────── */}
      <SearchBar value={search} onChangeText={setSearch} colors={colors} />

      {/* ── Empty State ────────────────────────────────────────────── */}
      {!hasData && !isSearching ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.primarySubtle }]}>
            <Text style={styles.emptyIcon}>❤️</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Sin mediciones guardadas
          </Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Las mediciones apareceran aqui automaticamente despues de cada
            lectura.
          </Text>
        </View>
      ) : !hasFilteredData ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.primarySubtle }]}>
            <Text style={styles.emptyIcon}>🔍</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Sin resultados
          </Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Intenta con otro termino de busqueda.
          </Text>
        </View>
      ) : (
        /* ── Section List ───────────────────────────────────────── */
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => item.id || item.timestamp}
          renderItem={({ item }) => (
            <SwipeableItem item={item} onDelete={handleDeleteItem} colors={colors} />
          )}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader]}>
              <View
                style={[
                  styles.sectionHeaderAccent,
                  { backgroundColor: colors.primary },
                ]}
              />
              <View
                style={[
                  styles.sectionHeaderContent,
                  { backgroundColor: colors.primarySubtle },
                ]}
              >
                <Text
                  style={[styles.sectionHeaderText, { color: colors.primaryDark }]}
                >
                  {section.title.toUpperCase()}
                </Text>
                <View
                  style={[
                    styles.sectionCountWrap,
                    { backgroundColor: colors.primaryMuted },
                  ]}
                >
                  <Text
                    style={[styles.sectionCountText, { color: colors.primaryDark }]}
                  >
                    {section.data.length}
                  </Text>
                </View>
              </View>
            </View>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={() => (
            <View style={styles.footer}>
              <LegalDisclaimer />
              <BannerAd compact />
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary, colors.primaryDark]}
              progressBackgroundColor={colors.bg}
            />
          }
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Static layout styles (no color references) ─────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  /* ── Header ───────────────────────────────────────────────────────────── */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerCount: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 1,
  },
  clearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* ── Search ───────────────────────────────────────────────────────────── */
  searchOuter: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1.5,
    ...SHADOWS.card,
  },
  searchIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  searchIcon: {
    fontSize: 13,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    fontWeight: '400',
  },
  searchClearHit: {
    padding: 6,
    marginLeft: 4,
  },
  clearBtnWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnIcon: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* ── Section list ─────────────────────────────────────────────────────── */
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 16,
    marginBottom: 10,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  sectionHeaderAccent: {
    width: 4,
    borderTopLeftRadius: RADIUS.sm,
    borderBottomLeftRadius: RADIUS.sm,
  },
  sectionHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionCountWrap: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Swipe item ───────────────────────────────────────────────────────── */
  swipeContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 90,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  deleteActionLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  item: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    minHeight: 88,
    overflow: 'hidden',
  },
  accentBarWrap: {
    width: 6,
  },
  accentBar: {
    width: 4,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    height: '50%',
  },
  riskStrip: {
    width: 4,
    height: '50%',
  },
  itemContent: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 14,
    paddingLeft: 10,
    justifyContent: 'center',
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemDate: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 8,
  },
  itemTime: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* ── Metrics row ──────────────────────────────────────────────────────── */
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricBlock: {
    flex: 1,
  },
  metricsDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 12,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  bpmValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  bpmUnit: {
    fontSize: 12,
    fontWeight: '600',
  },
  bpValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  bpUnit: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* ── Classification badge ─────────────────────────────────────────────── */
  classBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    marginTop: 4,
  },
  classDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 5,
  },
  classText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* ── Footer ───────────────────────────────────────────────────────────── */
  footer: {
    marginTop: 8,
    paddingBottom: 20,
  },

  /* ── Empty states ─────────────────────────────────────────────────────── */
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
});
