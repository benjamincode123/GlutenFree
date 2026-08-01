import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  BarcodeScanningResult,
  useCameraPermissions,
} from 'expo-camera';
import { Link, useFocusEffect, useNavigation, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthContext';
import { ScannerCamera } from '../src/components/ScannerCamera';
import { useI18n } from '../src/i18n/I18nContext';
import { useTheme } from '../src/theme/ThemeContext';

type MenuIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

export default function ScannerScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { user, authEnabled, refreshUser } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useI18n();
  const scanInk = colors.primary;
  const scanOnInk = colors.onPrimary;
  const [permission, requestPermission] = useCameraPermissions();

  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [holdingToScan, setHoldingToScan] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const drawerWidth = screenWidth * 0.25;
  const menuProgress = useRef(new Animated.Value(0)).current;

  // Prevents the camera from firing many navigations for one physical scan.
  const lockRef = useRef(false);
  const holdingRef = useRef(false);
  const isFocusedRef = useRef(true);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    Animated.timing(menuProgress, {
      toValue: menuOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [menuOpen, menuProgress]);

  const toggleMenu = useCallback(() => {
    setMenuOpen((open) => !open);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const goMenuLink = useCallback(
    (href: '/add' | '/products' | '/user' | '/leaderboard' | '/settings') => {
      setMenuOpen(false);
      router.push(href);
    },
    [router]
  );

  const menuItems = useMemo(() => {
    const items: {
      href: '/add' | '/products' | '/user' | '/leaderboard' | '/settings';
      icon: MenuIcon;
      labelKey:
        | 'scanner.searchProducts'
        | 'scanner.addProduct'
        | 'scanner.profile'
        | 'scanner.leaderboard'
        | 'scanner.settings';
      requireAuth?: boolean;
    }[] = [
      {
        href: '/products',
        icon: 'magnify',
        labelKey: 'scanner.searchProducts',
      },
      {
        href: '/add',
        icon: 'plus-circle-outline',
        labelKey: 'scanner.addProduct',
        requireAuth: true,
      },
      {
        href: '/user',
        icon: 'account-circle-outline',
        labelKey: 'scanner.profile',
      },
      {
        href: '/leaderboard',
        icon: 'trophy-outline',
        labelKey: 'scanner.leaderboard',
      },
      {
        href: '/settings',
        icon: 'cog-outline',
        labelKey: 'scanner.settings',
      },
    ];
    return items.filter((item) => !item.requireAuth || (authEnabled && user));
  }, [authEnabled, user]);

  const shellTranslateX = menuProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0],
  });

  // Keep CameraView mounted; only pause the session while another screen is open.
  useFocusEffect(
    useCallback(() => {
      lockRef.current = false;
      holdingRef.current = false;
      isFocusedRef.current = true;
      setHoldingToScan(false);
      setIsFocused(true);
      if (authEnabled) {
        void refreshUser().catch(() => undefined);
      }
      return () => {
        lockRef.current = true;
        holdingRef.current = false;
        isFocusedRef.current = false;
        setHoldingToScan(false);
        setIsFocused(false);
      };
    }, [authEnabled, refreshUser])
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

  const headerIconButton = (
    name: MenuIcon,
    label: string,
    onPress: () => void
  ) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.headerIconButton}
    >
      <MaterialCommunityIcons name={name} size={24} color={colors.text} />
    </Pressable>
  );

  return (
    <View
      style={[styles.shellRoot, { backgroundColor: colors.background }]}
    >
      <Animated.View
        style={[
          styles.shellRow,
          {
            width: screenWidth + drawerWidth,
            transform: [{ translateX: shellTranslateX }],
          },
        ]}
      >
        <View
          style={[
            styles.drawer,
            {
              width: drawerWidth,
              backgroundColor: colors.surface,
              borderRightColor: colors.border,
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          {menuItems.map((item) => (
            <Pressable
              key={item.href}
              onPress={() => goMenuLink(item.href)}
              accessibilityRole="button"
              accessibilityLabel={t(item.labelKey)}
              style={styles.drawerItem}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={28}
                color={colors.primary}
              />
            </Pressable>
          ))}
        </View>

        <View style={[styles.mainColumn, { width: screenWidth }]}>
          <View
            style={[
              styles.headerRoot,
              {
                backgroundColor: colors.background,
                paddingTop: insets.top,
              },
            ]}
          >
            <View style={styles.headerBar}>
              {headerIconButton(
                menuOpen ? 'close' : 'menu',
                t('scanner.menuA11y'),
                toggleMenu
              )}
              <Text
                style={[styles.headerTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {t('nav.scanner')}
              </Text>
              <Pressable
                onPress={() => {
                  if (!authEnabled || !user) {
                    router.push('/login');
                    return;
                  }
                  router.push('/notifications');
                }}
                accessibilityRole="button"
                accessibilityLabel={t('scanner.notificationsA11y')}
                style={styles.headerIconButton}
              >
                <MaterialCommunityIcons
                  name="bell-outline"
                  size={24}
                  color={colors.text}
                />
                {(user?.unreadMessages?.length ?? 0) > 0 ? (
                  <View
                    style={[
                      styles.bellBadge,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text style={[styles.bellBadgeText, { color: colors.onPrimary }]}>
                      {(user?.unreadMessages?.length ?? 0) > 9
                        ? '9+'
                        : String(user?.unreadMessages?.length ?? 0)}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          </View>

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
              style={[styles.hintWrap, { top: 10 }]}
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
                  color={holdingToScan ? scanOnInk : 'rgba(255,255,255,0.92)'}
                />
                <Text
                  style={[
                    styles.hintText,
                    holdingToScan && { color: scanOnInk },
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
                  holdingToScan && { borderColor: scanInk },
                ]}
              />
              <View
                style={[
                  styles.scanCorner,
                  styles.scanCornerTR,
                  holdingToScan && { borderColor: scanInk },
                ]}
              />
              <View
                style={[
                  styles.scanCorner,
                  styles.scanCornerBL,
                  holdingToScan && { borderColor: scanInk },
                ]}
              />
              <View
                style={[
                  styles.scanCorner,
                  styles.scanCornerBR,
                  holdingToScan && { borderColor: scanInk },
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
                  {
                    backgroundColor: scanInk,
                    borderColor: isDark ? 'rgba(15,17,21,0.35)' : 'rgba(255,255,255,0.85)',
                  },
                  (pressed || holdingToScan) && styles.scanButtonActive,
                ]}
              >
                <MaterialCommunityIcons
                  name="barcode-scan"
                  size={36}
                  color={scanOnInk}
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
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={requestPermission}
            >
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                {t('scanner.grantCamera')}
              </Text>
            </Pressable>
            {Platform.OS === 'ios' && (
              <Text style={styles.simulatorNote}>{t('scanner.simulatorNote')}</Text>
            )}
          </View>
        </View>
      )}

      <View
        style={[
          styles.devPanel,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View style={styles.lastScanRow}>
          <View style={styles.lastScanText}>
            <Text style={[styles.devLabel, { color: colors.textSecondary }]}>
              {t('scanner.lastScanned')}
            </Text>
            <Text
              style={[styles.devValue, { color: colors.text }]}
              numberOfLines={1}
            >
              {lastBarcode ?? '—'}
            </Text>
          </View>
          {lastBarcode ? (
            <Pressable
              style={[
                styles.openLastButton,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              onPress={() => goToResult(lastBarcode)}
              accessibilityRole="button"
              accessibilityLabel={t('scanner.openLastScanned')}
              hitSlop={8}
            >
              <MaterialCommunityIcons
                name="package-variant"
                size={22}
                color={colors.primary}
              />
            </Pressable>
          ) : null}
        </View>
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
              style={[
                styles.linkButton,
                {
                  borderColor: colors.primary,
                  backgroundColor: colors.primary,
                },
              ]}
            >
              <Text style={[styles.linkButtonText, { color: colors.onPrimary }]}>
                {t('scanner.addProduct')}
              </Text>
            </Link>
          )}
          <Link
            href="/products"
            style={[
              styles.linkButton,
              {
                borderColor: colors.primary,
                backgroundColor: colors.background,
              },
            ]}
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
      </View>

          {menuOpen ? (
            <Pressable
              style={styles.menuDismiss}
              onPress={closeMenu}
              accessibilityRole="button"
              accessibilityLabel={t('scanner.menuA11y')}
            />
          ) : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shellRoot: {
    flex: 1,
    overflow: 'hidden',
  },
  shellRow: {
    flex: 1,
    flexDirection: 'row',
  },
  drawer: {
    height: '100%',
    borderRightWidth: StyleSheet.hairlineWidth,
    alignItems: 'stretch',
    gap: 4,
    paddingHorizontal: 6,
  },
  drawerItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  mainColumn: {
    flex: 1,
    height: '100%',
  },
  menuDismiss: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  headerRoot: {
    width: '100%',
  },
  headerBar: {
    height: Platform.OS === 'ios' ? 44 : 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Platform.OS === 'ios' ? 17 : 20,
    fontWeight: '700',
  },
  headerIconButton: {
    width: 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 4 : 8,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
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
    backgroundColor: 'rgba(15, 17, 21, 0.88)',
    borderColor: 'rgba(255,255,255,0.45)',
  },
  hintText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
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
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  scanButtonActive: {
    transform: [{ scale: 0.94 }],
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  devPanel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  lastScanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lastScanText: {
    flex: 1,
    minWidth: 0,
  },
  openLastButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devValue: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  bottomPanel: {
    paddingHorizontal: 16,
    paddingTop: 16,
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
});
