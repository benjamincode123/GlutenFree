import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  BarcodeScanningResult,
  useCameraPermissions,
} from 'expo-camera';
import { Link, useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthContext';
import { ScannerCamera } from '../src/components/ScannerCamera';
import { useI18n } from '../src/i18n/I18nContext';
import { useTheme } from '../src/theme/ThemeContext';

export default function ScannerScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, authEnabled } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();

  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [holdingToScan, setHoldingToScan] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);

  // Prevents the camera from firing many navigations for one physical scan.
  const lockRef = useRef(false);
  const holdingRef = useRef(false);
  const isFocusedRef = useRef(true);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('nav.scanner') });
  }, [navigation, t]);

  // Keep CameraView mounted; only pause the session while another screen is open.
  useFocusEffect(
    useCallback(() => {
      lockRef.current = false;
      holdingRef.current = false;
      isFocusedRef.current = true;
      setHoldingToScan(false);
      setIsFocused(true);
      return () => {
        lockRef.current = true;
        holdingRef.current = false;
        isFocusedRef.current = false;
        setHoldingToScan(false);
        setIsFocused(false);
      };
    }, [])
  );

  const goToResult = useCallback(
    (barcode: string) => {
      const trimmed = barcode.trim();
      if (!trimmed) return;
      router.push({ pathname: '/result', params: { barcode: trimmed } });
    },
    [router]
  );

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (!isFocusedRef.current || !holdingRef.current || lockRef.current) return;
      const value = result.data?.trim();
      if (!value) return;
      lockRef.current = true;
      holdingRef.current = false;
      setHoldingToScan(false);
      setLastBarcode(value);
      goToResult(value);
    },
    [goToResult]
  );

  const handleCameraReady = useCallback(() => {
    setCameraReady(true);
  }, []);

  const startHolding = useCallback(() => {
    if (lockRef.current || !isFocusedRef.current) return;
    holdingRef.current = true;
    setHoldingToScan(true);
  }, []);

  const stopHolding = useCallback(() => {
    holdingRef.current = false;
    setHoldingToScan(false);
  }, []);

  if (!permission) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          {t('scanner.checkingPermission')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {permission.granted ? (
        <View style={styles.cameraWrapper}>
          <ScannerCamera
            active={isFocused}
            onCameraReady={handleCameraReady}
            // Keep scanning attached after ready — toggling this prop blacks the preview.
            onBarcodeScanned={cameraReady ? handleBarcodeScanned : undefined}
          />
          <View style={styles.overlay} pointerEvents="box-none">
            <View
              style={[styles.hintWrap, { top: Math.max(insets.top, 8) + 10 }]}
              pointerEvents="none"
            >
              <View
                style={[
                  styles.hintPill,
                  holdingToScan && styles.hintPillActive,
                ]}
              >
                <MaterialCommunityIcons
                  name={holdingToScan ? 'line-scan' : 'gesture-tap-hold'}
                  size={16}
                  color={holdingToScan ? '#E4F6E9' : 'rgba(255,255,255,0.92)'}
                />
                <Text
                  style={[
                    styles.hintText,
                    holdingToScan && styles.hintTextActive,
                  ]}
                >
                  {holdingToScan ? t('scanner.scanning') : t('scanner.holdToScan')}
                </Text>
              </View>
            </View>

            <View style={styles.scanFrame} pointerEvents="none">
              <View
                style={[
                  styles.scanCorner,
                  styles.scanCornerTL,
                  holdingToScan && styles.scanCornerActive,
                ]}
              />
              <View
                style={[
                  styles.scanCorner,
                  styles.scanCornerTR,
                  holdingToScan && styles.scanCornerActive,
                ]}
              />
              <View
                style={[
                  styles.scanCorner,
                  styles.scanCornerBL,
                  holdingToScan && styles.scanCornerActive,
                ]}
              />
              <View
                style={[
                  styles.scanCorner,
                  styles.scanCornerBR,
                  holdingToScan && styles.scanCornerActive,
                ]}
              />
            </View>

            <View style={styles.scanButtonWrap}>
              <Pressable
                onPressIn={startHolding}
                onPressOut={stopHolding}
                accessibilityRole="button"
                accessibilityLabel={t('scanner.holdA11y')}
                style={({ pressed }) => [
                  styles.scanButton,
                  (pressed || holdingToScan) && styles.scanButtonActive,
                ]}
              >
                <MaterialCommunityIcons
                  name="barcode-scan"
                  size={36}
                  color="#fff"
                />
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.cameraWrapper}>
          <View style={[styles.centered, styles.noCamera]}>
            <Text style={styles.noCameraTitle}>{t('scanner.cameraNeeded')}</Text>
            <Text style={styles.infoText}>{t('scanner.cameraHint')}</Text>
            <Pressable style={styles.primaryButton} onPress={requestPermission}>
              <Text style={styles.primaryButtonText}>{t('scanner.grantCamera')}</Text>
            </Pressable>
            {Platform.OS === 'ios' && (
              <Text style={styles.simulatorNote}>{t('scanner.simulatorNote')}</Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.devPanel}>
        <Text style={styles.devLabel}>{t('scanner.lastScanned')}</Text>
        <Text style={styles.devValue}>{lastBarcode ?? '—'}</Text>
      </View>

      <View
        style={[
          styles.bottomPanel,
          {
            paddingBottom: insets.bottom + 16,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View style={styles.linksRow}>
          {authEnabled && user && (
            <Link
              href="/add"
              style={[styles.linkButton, { borderColor: colors.primary }]}
            >
              <Text style={[styles.linkButtonText, { color: colors.primary }]}>
                {t('scanner.addProduct')}
              </Text>
            </Link>
          )}
          <Link
            href="/products"
            style={[styles.linkButton, { borderColor: colors.primary }]}
          >
            <Text style={[styles.linkButtonText, { color: colors.primary }]}>
              {t('scanner.searchProducts')}
            </Text>
          </Link>
        </View>

        <View style={[styles.iconNavRow, { borderTopColor: colors.border }]}>
          <Link href="/user" asChild>
            <Pressable
              style={styles.iconNavButton}
              accessibilityRole="button"
              accessibilityLabel={t('scanner.profile')}
              hitSlop={8}
            >
              <MaterialCommunityIcons
                name="account-circle-outline"
                size={28}
                color={colors.primary}
              />
              <Text style={[styles.iconNavLabel, { color: colors.textSecondary }]}>
                {t('scanner.profile')}
              </Text>
            </Pressable>
          </Link>
          <Link href="/leaderboard" asChild>
            <Pressable
              style={styles.iconNavButton}
              accessibilityRole="button"
              accessibilityLabel={t('scanner.leaderboard')}
              hitSlop={8}
            >
              <MaterialCommunityIcons
                name="trophy-outline"
                size={28}
                color={colors.primary}
              />
              <Text style={[styles.iconNavLabel, { color: colors.textSecondary }]}>
                {t('scanner.leaderboard')}
              </Text>
            </Pressable>
          </Link>
          <Link href="/settings" asChild>
            <Pressable
              style={styles.iconNavButton}
              accessibilityRole="button"
              accessibilityLabel={t('scanner.settings')}
              hitSlop={8}
            >
              <MaterialCommunityIcons
                name="cog-outline"
                size={28}
                color={colors.primary}
              />
              <Text style={[styles.iconNavLabel, { color: colors.textSecondary }]}>
                {t('scanner.settings')}
              </Text>
            </Pressable>
          </Link>
        </View>

        <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
          {t('scanner.disclaimer')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1115',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cameraWrapper: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#0F1115',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 5,
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 17, 21, 0.62)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  hintPillActive: {
    backgroundColor: 'rgba(27, 127, 59, 0.82)',
    borderColor: 'rgba(228, 246, 233, 0.55)',
  },
  hintText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  hintTextActive: {
    color: '#E4F6E9',
  },
  // Large guide — scanning uses the full camera frame, not only this box.
  scanFrame: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '14%',
    bottom: '24%',
  },
  scanCorner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: 'rgba(255,255,255,0.88)',
  },
  scanCornerActive: {
    borderColor: '#4CD787',
  },
  scanCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 10,
  },
  scanCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 10,
  },
  scanCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 10,
  },
  scanCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 10,
  },
  scanButtonWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: 'center',
  },
  scanButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(27, 127, 59, 0.92)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  scanButtonActive: {
    backgroundColor: '#149A45',
    transform: [{ scale: 0.94 }],
    borderColor: '#fff',
  },
  noCamera: {
    backgroundColor: '#1A1D22',
  },
  noCameraTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoText: {
    color: '#C7CBD1',
    fontSize: 14,
    textAlign: 'center',
  },
  simulatorNote: {
    marginTop: 16,
    color: '#8A9099',
    fontSize: 12,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#1B7F3B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  devPanel: {
    backgroundColor: '#181B20',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2E35',
  },
  devLabel: {
    color: '#8A9099',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devValue: {
    color: '#4CD787',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  bottomPanel: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 0,
  },
  linkButton: {
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    textAlign: 'center',
    fontWeight: '700',
    overflow: 'hidden',
  },
  linkButtonText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  iconNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconNavButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
    paddingVertical: 4,
  },
  iconNavLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  disclaimer: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    opacity: 0.9,
  },
});
