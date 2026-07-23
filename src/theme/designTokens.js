/**
 * designTokens.js — VitalPulse v5.0
 *
 * Sistema de diseño minimalista premium (blanco + azul médico).
 * Todas las pantallas y componentes importan desde aquí.
 */

// ─── Colores ─────────────────────────────────────────────────────────────────
export const COLORS = {
  // Fondos
  bg:               '#FFFFFF',
  bgCard:           '#F8F9FA',
  bgSecondary:      '#F0F4F8',
  bgElevated:       '#FFFFFF',

  // Primario — Azul médico
  primary:          '#2563EB',
  primaryLight:     '#3B82F6',
  primaryDark:      '#1D4ED8',
  primarySubtle:    '#EFF6FF',
  primaryMuted:     '#BFDBFE',

  // Secundario
  secondary:        '#0EA5E9',
  secondaryLight:   '#38BDF8',

  // Semánticos
  success:          '#10B981',
  successLight:     '#D1FAE5',
  successDark:      '#059669',
  warning:          '#F59E0B',
  warningLight:     '#FEF3C7',
  danger:           '#EF4444',
  dangerLight:      '#FEE2E2',
  dangerDark:       '#DC2626',
  info:             '#6366F1',
  infoLight:        '#E0E7FF',

  // Texto
  textPrimary:      '#1E293B',
  textSecondary:    '#64748B',
  textMuted:        '#94A3B8',
  textOnPrimary:    '#FFFFFF',

  // Bordes y divisores
  border:           '#E2E8F0',
  borderLight:      '#F1F5F9',
  divider:          '#F1F5F9',

  // Gráficos
  chartBPM:         '#2563EB',
  chartSystolic:    '#2563EB',
  chartDiastolic:   '#0EA5E9',
  chartHRV:         '#10B981',
  chartGrid:        '#F1F5F9',

  // Modo oscuro (solo para MeasureScreen)
  darkBg:           '#0F172A',
  darkCard:         '#1E293B',
  darkBorder:       '#334155',
  darkText:         '#F8FAFC',
  darkMuted:        '#94A3B8',

  // Tab Bar
  tabBarBg:         '#FFFFFF',
  tabBarBorder:     '#E2E8F0',
  tabActive:        '#2563EB',
  tabInactive:      '#94A3B8',
};

// ─── Espaciado ───────────────────────────────────────────────────────────────
export const SPACING = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
};

// ─── Bordes redondeados ──────────────────────────────────────────────────────
export const RADIUS = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  full: 999,
};

// ─── Sombras ─────────────────────────────────────────────────────────────────
export const SHADOWS = {
  card: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius:  8,
    elevation:     2,
  },
  elevated: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius:  12,
    elevation:     4,
  },
  none: {
    shadowColor:   'transparent',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius:  0,
    elevation:     0,
  },
};

// ─── Tipografía ──────────────────────────────────────────────────────────────
export const TYPOGRAPHY = {
  h1: {
    fontSize:       28,
    fontWeight:     '700',
    color:          COLORS.textPrimary,
    letterSpacing:  -0.5,
  },
  h2: {
    fontSize:       22,
    fontWeight:     '700',
    color:          COLORS.textPrimary,
    letterSpacing:  -0.3,
  },
  h3: {
    fontSize:       17,
    fontWeight:     '600',
    color:          COLORS.textPrimary,
  },
  body: {
    fontSize:       15,
    color:          COLORS.textSecondary,
    lineHeight:     22,
  },
  caption: {
    fontSize:       12,
    color:          COLORS.textMuted,
  },
  label: {
    fontSize:       11,
    fontWeight:     '600',
    color:          COLORS.textMuted,
    letterSpacing:  0.5,
    textTransform:  'uppercase',
  },
};
