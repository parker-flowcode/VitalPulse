/**
 * designTokens.js — VitalPulse v5.0
 *
 * Sistema de diseno dual: light + dark.
 * Compatible con ThemeContext para cambio dinamico de tema.
 */

// ─── Paleta Claro ────────────────────────────────────────────────────────────
export const lightColors = {
  bg:               '#FFFFFF',
  bgCard:           '#F8F9FA',
  bgSecondary:      '#F0F4F8',
  bgElevated:       '#FFFFFF',

  primary:          '#38BDF8',
  primaryLight:     '#7DD3FC',
  primaryDark:      '#0EA5E9',
  primarySubtle:    '#F0F9FF',
  primaryMuted:     '#BAE6FD',

  secondary:        '#0EA5E9',
  secondaryLight:   '#38BDF8',

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

  textPrimary:      '#1E293B',
  textSecondary:    '#64748B',
  textMuted:        '#94A3B8',
  textOnPrimary:    '#FFFFFF',

  border:           '#E2E8F0',
  borderLight:      '#F1F5F9',
  divider:          '#F1F5F9',

  chartBPM:         '#38BDF8',
  chartSystolic:    '#38BDF8',
  chartDiastolic:   '#0EA5E9',
  chartHRV:         '#10B981',
  chartGrid:        '#F1F5F9',

  tabBarBg:         '#FFFFFF',
  tabBarBorder:     '#E2E8F0',
  tabActive:        '#38BDF8',
  tabInactive:      '#94A3B8',

};

// ─── Paleta Oscuro ───────────────────────────────────────────────────────────
export const darkColors = {
  bg:               '#0F172A',
  bgCard:           '#1E293B',
  bgSecondary:      '#334155',
  bgElevated:       '#1E293B',

  primary:          '#38BDF8',
  primaryLight:     '#7DD3FC',
  primaryDark:      '#0EA5E9',
  primarySubtle:    '#0C4A6E',
  primaryMuted:     '#0369A1',

  secondary:        '#38BDF8',
  secondaryLight:   '#7DD3FC',

  success:          '#34D399',
  successLight:     '#064E3B',
  successDark:      '#059669',
  warning:          '#FBBF24',
  warningLight:     '#78350F',
  danger:           '#F87171',
  dangerLight:      '#7F1D1D',
  dangerDark:       '#DC2626',
  info:             '#818CF8',
  infoLight:        '#312E81',

  textPrimary:      '#F8FAFC',
  textSecondary:    '#CBD5E1',
  textMuted:        '#94A3B8',
  textOnPrimary:    '#FFFFFF',

  border:           '#334155',
  borderLight:      '#1E293B',
  divider:          '#334155',

  chartBPM:         '#38BDF8',
  chartSystolic:    '#38BDF8',
  chartDiastolic:   '#7DD3FC',
  chartHRV:         '#34D399',
  chartGrid:        '#334155',

  tabBarBg:         '#1E293B',
  tabBarBorder:     '#334155',
  tabActive:        '#38BDF8',
  tabInactive:      '#64748B',

};

// ─── Espaciado ───────────────────────────────────────────────────────────────
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

// ─── Bordes redondeados ──────────────────────────────────────────────────────
export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 };

// ─── Sombras ─────────────────────────────────────────────────────────────────
export const SHADOWS = {
  card:    { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 2 },
  elevated:{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4 },
  none:    { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
};

// ─── Tipografia (usa COLORS dinamicamente) ───────────────────────────────────
export const TYPOGRAPHY = {
  h1:     { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  h2:     { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  h3:     { fontSize: 17, fontWeight: '600' },
  body:   { fontSize: 15, lineHeight: 22 },
  caption:{ fontSize: 12 },
  label:  { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
};
