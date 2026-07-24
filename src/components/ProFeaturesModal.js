/**
 * ProFeaturesModal.js — VitalPulse v5.0
 *
 * Professional modal that shows when the user has exhausted free measurements.
 * Displays Pro feature list with green checkmarks and two action buttons.
 * Uses theme system for all colors.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Feature list ────────────────────────────────────────────────────────────────
const PRO_FEATURES = [
  'Mediciones ilimitadas',
  'Sin anuncios',
  'Calibracion avanzada',
  'Exportar datos CSV',
  'Graficas detalladas',
  'Metricas SNR avanzadas',
];

/**
 * ProFeaturesModal
 *
 * @param {object}   props
 * @param {boolean}  props.visible   - Controls modal visibility
 * @param {function} props.onClose   - Dismiss callback
 * @param {function} props.onWatchAd - Watch an ad for +1 free measurement
 * @param {function} props.onUpgrade - Navigate to upgrade/Pro purchase
 */
export default function ProFeaturesModal({ visible, onClose, onWatchAd, onUpgrade }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="dark-content" />

      {/* ─── Overlay backdrop ─── */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Prevent taps inside the sheet from closing */}
        <TouchableOpacity
          style={styles.sheet}
          activeOpacity={1}
          onPress={() => {}}
        >
          {/* ── Handle bar ── */}
          <View style={styles.handleBar} />

          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <Text style={styles.headerEmoji}>{'💎'}</Text>
            <Text style={styles.headerTitle}>VitalPulse Pro</Text>
          </View>
          <Text style={styles.headerDesc}>
            Desbloquea todas las funcionalidades avanzadas y elimina los limites
            del plan gratuito.
          </Text>

          {/* ── Divider ── */}
          <View style={styles.divider} />

          {/* ── Feature list ── */}
          <Text style={styles.sectionLabel}>INCLUYE</Text>
          {PRO_FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Text style={styles.checkmark}>{'✅ '}</Text>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}

          {/* ── Divider ── */}
          <View style={styles.divider} />

          {/* ── Action buttons ── */}
          <TouchableOpacity
            style={styles.watchAdBtn}
            onPress={onWatchAd}
            activeOpacity={0.8}
          >
            <Text style={styles.watchAdBtnText}>
              {'🎬 Ver anuncio (+1 gratis)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={onUpgrade}
            activeOpacity={0.85}
          >
            <Text style={styles.upgradeBtnText}>Activar Pro</Text>
          </TouchableOpacity>

          {/* ── Dismiss link ── */}
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissText}>Ahora no</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Dynamic styles factory ─────────────────────────────────────────────────────
function createStyles(colors) {
  return StyleSheet.create({
    // ── Overlay ──
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },

    // ── Bottom sheet ──
    sheet: {
      backgroundColor: colors.bgElevated,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 36,
      maxHeight: SCREEN_HEIGHT * 0.85,
    },

    // ── Handle bar ──
    handleBar: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 16,
    },

    // ── Header ──
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    headerEmoji: {
      fontSize: 28,
      marginRight: 8,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: -0.5,
    },
    headerDesc: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 4,
    },

    // ── Divider ──
    divider: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: 16,
    },

    // ── Section label ──
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 12,
    },

    // ── Feature rows ──
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    checkmark: {
      fontSize: 16,
      marginRight: 10,
    },
    featureText: {
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '500',
    },

    // ── Watch ad button (amber) ──
    watchAdBtn: {
      backgroundColor: colors.warningLight,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.warning + '30',
    },
    watchAdBtnText: {
      color: '#92400E',
      fontSize: 16,
      fontWeight: '700',
    },

    // ── Upgrade button (blue solid) ──
    upgradeBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      marginBottom: 12,
    },
    upgradeBtnText: {
      color: colors.textOnPrimary,
      fontSize: 16,
      fontWeight: '700',
    },

    // ── Dismiss text link ──
    dismissBtn: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    dismissText: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '500',
    },
  });
}
