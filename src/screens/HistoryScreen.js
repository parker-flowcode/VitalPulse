/**
 * HistoryScreen.js — VitalPulse v9.0
 *
 * Glassmorphism compact design with:
 * - Horizontal pill filter tabs (Hoy / Semana / Mes / Todo)
 * - 60–65px compact cards with colored dot, BPM + badge, BP value
 * - Inline expand on tap (LayoutAnimation) instead of Alert
 * - Swipe-to-delete with red reveal
 * - Section headers (28px, uppercase, subtle bg)
 * - Glass search bar (40px height)
 * - Light/dark theme via useTheme
 */
import React, { useCallback, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  RefreshControl,
  PanResponder,
  TextInput,
  Platform,
  ScrollView,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import useHealthStore from '../store/healthstore';
import { classifyBPM, classifyBP } from '../utils/bpEstimator';
import BannerAd from '../components/BannerAd';
import LegalDisclaimer from '../components/LegalDisclaimer';
import { SPACING, RADIUS, SHADOWS } from '../theme/designTokens';

// ─── Enable LayoutAnimation on Android ──────────────────────────────────────────
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Constants ──────────────────────────────────────────────────────────────────
const SWIPE_THRESHOLD = -80;
const FILTER_TABS = ['Hoy', 'Semana', 'Mes', 'Todo'];

// ─── BPM Classification descriptions (Spanish) ───────────────────────────────
function getBpmDescription(label) {
  const map = {
    'Normal':             'Ritmo cardiaco normal en reposo (60-100 BPM).',
    'Bradicardia':        'Frecuencia cardiaca baja (50-59 BPM). Comun en atletas.',
    'Bradicardia severa': 'Frecuencia peligrosamente baja (<50 BPM). Consulte medico.',
    'Taquicardia leve':   'Frecuencia ligeramente elevada (100-110 BPM).',
    'Taquicardia':        'Frecuencia cardiaca elevada (110-130 BPM). Monitoree.',
    'Taquicardia severa': 'Frecuencia muy elevada (>130 BPM). Consulte medico.',
  };
  return map[label] || '';
}

// ─── BP Classification descriptions (Spanish) ────────────────────────────────
function getBpDescription(label) {
  const map = {
    'Optima':       'Presion arterial optima. Mantenga este nivel.',
    'Normal':       'Presion arterial normal. Continue con habitos saludables.',
    'Normal-Alta':  'Presion ligeramente elevada. Monitoree regularmente.',
    'HTA Grado 1':  'Hipertension grado 1. Consulte a su medico.',
    'HTA Grado 2':  'Hipertension grado 2. Requiere atencion medica.',
    'HTA Grado 3':  'Hipertension grado 3. Busque atencion medica urgente.',
  };
  return map[label] || '';
}

// ─── Filter data by active tab ─────────────────────────────────────────────────
function filterByTab(data, tab) {
  if (tab === 'Todo') return data;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return data.filter((item) => {
    const d = new Date(item.timestamp);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((today - day) / (1000 * 60 * 60 * 24));

    if (tab === 'Hoy')    return diff === 0;
    if (tab === 'Semana') return diff >= 0 && diff < 7;
    if (tab === 'Mes')    return diff >= 0 && diff < 30;
    return true;
  });
}

// ─── Derive section title from timestamp ──────────────────────────────────────
function getSectionTitle(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((today - itemDay) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';

  // Same week?
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(monday.getDate() + mondayOffset);

  if (itemDay >= monday) {
    const days = ['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];
    const month = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    return days[date.getDay()] + ' ' + month;
  }

  // Same month?
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  if (itemDay >= monthStart) {
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });
  }

  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── FilterTabs: horizontal pill buttons ─────────────────────────────────────
function FilterTabs({ activeTab, onTabChange, colors }) {
  return (
    <View style={styles.filterTabsOuter}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTabsContent}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => onTabChange(tab)}
              activeOpacity={0.7}
              style={[
                styles.filterTab,
                {
                  borderColor: isActive ? colors.primary : colors.border,
                  backgroundColor: isActive ? colors.primary : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: isActive ? colors.textOnPrimary : colors.textSecondary },
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── SearchBar: compact (40px) with glass background ────────────────────────
function SearchBar({ value, onChangeText, colors }) {
  return (
    <View style={styles.searchOuter}>
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: colors.glassBg,
            borderColor: value.trim() ? colors.primary : colors.glassBorder,
          },
        ]}
      >
        <Text style={[styles.searchIcon, { color: colors.textMuted }]}>{'🔍'}</Text>
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.searchClear, { color: colors.textMuted }]}>{'✕'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── SwipeableItem: compact card with inline expand ──────────────────────────
function SwipeableItem({ item, onDelete, colors, isExpanded, onToggleExpand }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isSwipedOpen = useRef(false);

  // ─── BPM ──────────────────────────────────────────────────────────────────
  const bpm = item.bpm || 0;
  const bpmClass = classifyBPM(bpm);
  const bpmColor = bpmClass?.color || colors.textMuted;

  // ─── BP ───────────────────────────────────────────────────────────────────
  const hasBp = Boolean(item.bp?.systolic && item.bp?.diastolic);
  const bpClass = hasBp ? classifyBP(item.bp.systolic, item.bp.diastolic) : null;
  const bpColor = bpClass?.color || colors.textMuted;

  // ─── Formatted date/time strings (memoised) ─────────────────────────────
  const timeStr = useMemo(() => {
    try {
      return new Date(item.timestamp).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '--:--';
    }
  }, [item.timestamp]);

  const dateStr = useMemo(() => {
    try {
      return new Date(item.timestamp).toLocaleDateString('es-ES', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      });
    } catch {
      return '--';
    }
  }, [item.timestamp]);

  const fullDateStr = useMemo(() => {
    try {
      return new Date(item.timestamp).toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return 'Fecha desconocida';
    }
  }, [item.timestamp]);

  // ─── PanResponder for swipe-to-delete ─────────────────────────────────────
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
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
      }),
    [translateX],
  );

  const resetPosition = (animated = true) => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: animated ? 200 : 0,
      useNativeDriver: true,
    }).start();
    isSwipedOpen.current = false;
  };

  // ─── Delete confirmation ──────────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert(
      'Eliminar medicion',
      'Eliminar la medicion del ' +
        new Date(item.timestamp).toLocaleDateString('es-ES') +
        '?',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resetPosition() },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => onDelete(item.id),
        },
      ],
    );
  };

  // ─── Tap handler: toggle inline expand ────────────────────────────────────
  const handlePress = () => {
    if (isSwipedOpen.current) {
      resetPosition();
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onToggleExpand(item.id);
    }
  };

  return (
    <View style={styles.swipeContainer}>
      {/* ── Delete action (revealed behind card on swipe) ── */}
      <View style={[styles.deleteAction, { backgroundColor: colors.dangerLight }]}>
        <TouchableOpacity
          onPress={handleDelete}
          style={styles.deleteActionInner}
          activeOpacity={0.8}
        >
          <Text style={[styles.deleteActionIcon, { color: colors.danger }]}>{'🗑'}</Text>
          <Text style={[styles.deleteActionLabel, { color: colors.danger }]}>
            Eliminar
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Main card with glassmorphism ── */}
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: colors.glassBg,
            borderColor: colors.glassBorder,
            ...SHADOWS.glass,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
          {/* ── Compact row (target: 58–65px) ── */}
          <View style={styles.cardRow}>
            {/* Colored accent dot (6px diameter) */}
            <View style={[styles.accentDot, { backgroundColor: bpmColor }]} />

            {/* Date + Time stacked */}
            <View style={styles.dateTimeCol}>
              <Text style={[styles.cardDate, { color: colors.textMuted }]} numberOfLines={1}>
                {dateStr}
              </Text>
              <Text style={[styles.cardTime, { color: colors.textSecondary }]} numberOfLines={1}>
                {timeStr}
              </Text>
            </View>

            {/* BPM value + classification badge */}
            <View style={styles.bpmSection}>
              <Text style={[styles.bpmValue, { color: bpmColor }]}>{bpm}</Text>
              <View style={[styles.badge, { backgroundColor: bpmColor + '18' }]}>
                <Text style={[styles.badgeText, { color: bpmColor }]} numberOfLines={1}>
                  {bpmClass?.label || '--'}
                </Text>
              </View>
            </View>

            {/* BP value */}
            <View style={styles.bpSection}>
              <Text style={[styles.bpValue, { color: bpColor }]}>
                {hasBp ? item.bp.systolic + '/' + item.bp.diastolic : '--/--'}
              </Text>
            </View>

            {/* Expand indicator */}
            <Text style={[styles.expandIcon, { color: colors.textMuted }]}>
              {isExpanded ? '▲' : '▼'}
            </Text>
          </View>

          {/* ── Expanded detail (toggled inline, no Alert) ── */}
          {isExpanded && (
            <View
              style={[
                styles.expandedContent,
                { borderTopColor: colors.border },
              ]}
            >
              {/* Full date/time */}
              <Text style={[styles.expandDate, { color: colors.textSecondary }]}>
                {fullDateStr} — {timeStr}
              </Text>

              {/* BPM row + description */}
              <View style={styles.expandRow}>
                <Text style={[styles.expandLabel, { color: colors.textMuted }]}>
                  {'❤️ BPM:'}
                </Text>
                <Text style={[styles.expandValue, { color: bpmColor }]}>
                  {bpm} — {bpmClass?.label || '--'}
                </Text>
              </View>
              <Text style={[styles.expandDesc, { color: colors.textMuted }]}>
                {getBpmDescription(bpmClass?.label || '')}
              </Text>

              {/* BP row + description */}
              {hasBp && (
                <>
                  <View style={styles.expandRow}>
                    <Text style={[styles.expandLabel, { color: colors.textMuted }]}>
                      {'🩸 PA:'}
                    </Text>
                    <Text style={[styles.expandValue, { color: bpColor }]}>
                      {item.bp.systolic}/{item.bp.diastolic} — {bpClass?.label}
                    </Text>
                  </View>
                  <Text style={[styles.expandDesc, { color: colors.textMuted }]}>
                    {getBpDescription(bpClass?.label || '')}
                  </Text>
                </>
              )}

              {/* HRV */}
              {item.sdnn > 0 && (
                <View style={styles.expandRow}>
                  <Text style={[styles.expandLabel, { color: colors.textMuted }]}>
                    {'📊 HRV:'}
                  </Text>
                  <Text style={[styles.expandValue, { color: colors.info }]}>
                    {Math.round(item.sdnn * 10) / 10} ms
                  </Text>
                </View>
              )}

              {/* Quality */}
              <View style={styles.expandRow}>
                <Text style={[styles.expandLabel, { color: colors.textMuted }]}>
                  {'✅ Calidad:'}
                </Text>
                <Text style={[styles.expandValue, { color: colors.success }]}>
                  {item.quality || 'Buena'}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Main Screen Component ─────────────────────────────────────────────────────
export default function HistoryScreen() {
  const { colors } = useTheme();
  const { history, clearHistory, deleteMeasurement, loadAll } = useHealthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('Todo');
  const [expandedId, setExpandedId] = useState(null);
  const listRef = useRef(null);

  // ─── Clear all history ─────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    Alert.alert(
      'Borrar historial',
      'Seguro que quieres eliminar todas las mediciones? Esta accion no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar todo', style: 'destructive', onPress: clearHistory },
      ],
    );
  }, [clearHistory]);

  // ─── Delete single item ────────────────────────────────────────────────────
  const handleDeleteItem = useCallback(
    async (id) => {
      await deleteMeasurement(id);
      // Collapse if the deleted item was expanded
      setExpandedId((prev) => (prev === id ? null : prev));
    },
    [deleteMeasurement],
  );

  // ─── Toggle inline expand ──────────────────────────────────────────────────
  const handleToggleExpand = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // ─── Switch filter tab (collapses any expanded card) ───────────────────────
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setExpandedId(null);
  }, []);

  // ─── Pull-to-refresh ──────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // ─── Build sections: search -> filter -> group -> sort ─────────────────────
  const sections = useMemo(() => {
    // 1. Apply search filter
    const searched = search.trim()
      ? history.filter((item) => {
          const ds = new Date(item.timestamp).toLocaleDateString('es-ES');
          const bpmStr = String(item.bpm || '');
          const q = search.toLowerCase();
          return ds.toLowerCase().includes(q) || bpmStr.includes(search);
        })
      : [...history];

    // 2. Apply time-based filter tab
    const filtered = filterByTab(searched, activeTab);

    // 3. Group by date section
    const groups = {};
    filtered.forEach((item) => {
      const title = getSectionTitle(item.timestamp);
      if (!groups[title]) groups[title] = [];
      groups[title].push(item);
    });

    // 4. Sort sections chronologically (most recent first)
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const dateA = new Date(groups[a][0].timestamp);
      const dateB = new Date(groups[b][0].timestamp);
      return dateB - dateA;
    });

    return sortedKeys.map((key) => ({
      title: key,
      data: groups[key],
    }));
  }, [history, search, activeTab]);

  const hasData = history.length > 0;
  const hasFilteredData = sections.some((s) => s.data.length > 0);
  const isSearching = search.trim().length > 0;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
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

      {/* ── Filter tabs (horizontal pills) ─────────────────────────────── */}
      <FilterTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        colors={colors}
      />

      {/* ── Glass search bar ───────────────────────────────────────────── */}
      <SearchBar value={search} onChangeText={setSearch} colors={colors} />

      {/* ── Empty state: no measurements at all ────────────────────────── */}
      {!hasData && !isSearching ? (
        <View style={styles.empty}>
          <View
            style={[
              styles.emptyIconWrap,
              { backgroundColor: colors.primarySubtle },
            ]}
          >
            <Text style={styles.emptyIcon}>{'❤️'}</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Sin mediciones guardadas
          </Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Las mediciones apareceran aqui automaticamente despues de cada
            lectura.
          </Text>
        </View>
      ) : // ── Empty state: filtered results ─────────────────────────────────
      !hasFilteredData ? (
        <View style={styles.empty}>
          <View
            style={[
              styles.emptyIconWrap,
              { backgroundColor: colors.primarySubtle },
            ]}
          >
            <Text style={styles.emptyIcon}>{'🔍'}</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Sin resultados
          </Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Intenta con otro termino de busqueda o filtro.
          </Text>
        </View>
      ) : (
        // ── SectionList with grouped measurements ──────────────────────────
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => item.id || item.timestamp}
          renderItem={({ item }) => (
            <SwipeableItem
              item={item}
              onDelete={handleDeleteItem}
              colors={colors}
              isExpanded={expandedId === item.id}
              onToggleExpand={handleToggleExpand}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View
              style={[
                styles.sectionHeader,
                { backgroundColor: colors.bgSecondary },
              ]}
            >
              <Text
                style={[
                  styles.sectionHeaderText,
                  { color: colors.textSecondary },
                ]}
              >
                {section.title.toUpperCase()}
              </Text>
              <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
                {section.data.length}
              </Text>
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
              colors={[colors.primary]}
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

// ─── Static Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  /* ── Safe area ───────────────────────────────────────────────────────────── */
  safe: { flex: 1 },

  /* ── Header ──────────────────────────────────────────────────────────── */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerCount: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
  },
  clearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Filter tabs ─────────────────────────────────────────────────────── */
  filterTabsOuter: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  filterTabsContent: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* ── Search bar (40px height) ────────────────────────────────────────── */
  searchOuter: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 40,
    borderWidth: 1,
  },
  searchIcon: {
    fontSize: 13,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
    fontWeight: '400',
  },
  searchClear: {
    fontSize: 14,
    fontWeight: '600',
    paddingLeft: 8,
  },

  /* ── Section list content padding ────────────────────────────────────── */
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  /* ── Section headers (compact ~28px) ─────────────────────────────────── */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 8,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* ── Swipe container ─────────────────────────────────────────────────── */
  swipeContainer: {
    position: 'relative',
    marginBottom: 4,
  },

  /* ── Delete action (hidden behind card) ──────────────────────────────── */
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 90,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionInner: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  deleteActionIcon: {
    fontSize: 16,
    marginBottom: 1,
  },
  deleteActionLabel: {
    fontSize: 10,
    fontWeight: '700',
  },

  /* ── Glass card ──────────────────────────────────────────────────────── */
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },

  /* ── Compact row (target 58–65px total height) ───────────────────────── */
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 58,
  },

  /* ── Accent dot (6px diameter) ───────────────────────────────────────── */
  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
  },

  /* ── Date/time column ────────────────────────────────────────────────── */
  dateTimeCol: {
    marginRight: 10,
    minWidth: 72,
  },
  cardDate: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardTime: {
    fontSize: 10,
    marginTop: 2,
  },

  /* ── BPM section (centered in available space) ───────────────────────── */
  bpmSection: {
    flex: 1,
    alignItems: 'center',
  },
  bpmValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
  },

  /* ── BP section (right-aligned) ──────────────────────────────────────── */
  bpSection: {
    flex: 0.7,
    alignItems: 'flex-end',
  },
  bpValue: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* ── Expand indicator ────────────────────────────────────────────────── */
  expandIcon: {
    fontSize: 9,
    marginLeft: 8,
  },

  /* ── Expanded detail area ────────────────────────────────────────────── */
  expandedContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  expandDate: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 6,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  expandLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 68,
  },
  expandValue: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  expandDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 6,
    marginLeft: 68,
    paddingRight: 8,
  },

  /* ── Footer (LegalDisclaimer + BannerAd) ─────────────────────────────── */
  footer: {
    marginTop: 8,
    paddingBottom: 20,
  },

  /* ── Empty states ────────────────────────────────────────────────────── */
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
