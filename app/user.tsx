import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../src/auth/AuthContext';
import {
  getCachedXpProfileSync,
  loadCachedXpProfile,
  saveCachedXpProfile,
} from '../src/auth/profileCache';
import { getAuthToken } from '../src/auth/session';
import { ErrorText } from '../src/components/ErrorText';
import { SmoothSwitch } from '../src/components/SmoothSwitch';
import * as adminApi from '../src/data/adminApi';
import * as authApi from '../src/data/authApi';
import type { XpHistoryItem, XpProfile } from '../src/data/authApi';
import { isAppError } from '../src/errors/appError';
import { userFacingError } from '../src/errors/userFacingError';
import { useI18n } from '../src/i18n/I18nContext';
import type { TranslationKey } from '../src/i18n/translations';
import { askPickProfileImage } from '../src/media/pickProductImage';
import { useReliableBackHeader } from '../src/navigation/useReliableBackHeader';
import { useTheme } from '../src/theme/ThemeContext';
import { formatApiDateTime } from '../src/time/formatApiDate';

function formatAdminBadgeCount(total: number): string | null {
  if (total <= 0) return null;
  if (total > 9) return '+9';
  return String(total);
}

function formatXpDate(iso: string, locale: string): string {
  return formatApiDateTime(iso, locale);
}

function historyReasonKey(reason: string): TranslationKey {
  if (reason === 'barcode_report') return 'profile.xpReasonBarcode';
  if (reason === 'product_submission') return 'profile.xpReasonSubmission';
  if (reason === 'product_image') return 'profile.xpReasonImage';
  if (reason === 'wrong_info_report') return 'profile.xpReasonWrongInfo';
  if (reason === 'merge_suggestion') return 'profile.xpReasonMerge';
  return 'profile.xpReasonOther';
}

function profileImageUri(imageUrl: string | null | undefined): string | null {
  const raw = (imageUrl ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:image/')) return raw;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

const PROFILE_REFRESH_COOLDOWN_MS = 20_000;

export default function UserScreen() {
  const router = useRouter();
  const {
    user,
    isAdmin,
    authEnabled,
    signOut,
    setPublicUser,
    setProfileImage,
    refreshUser,
  } = useAuth();
  const { colors, isDark } = useTheme();
  const { t, tf, locale } = useI18n();

  const [xpProfile, setXpProfile] = useState<XpProfile | null>(() =>
    authEnabled ? getCachedXpProfileSync() : null
  );
  const [refreshing, setRefreshing] = useState(false);
  const [xpError, setXpError] = useState<string | null>(null);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [adminPendingTotal, setAdminPendingTotal] = useState(0);
  const lastRefreshAtRef = useRef(0);

  useReliableBackHeader({ title: t('nav.profile') });

  // Hydrate XP from device cache only — never hit the API on page open.
  // Admins also refresh the pending-queue badge count.
  useFocusEffect(
    useCallback(() => {
      if (!authEnabled) {
        setXpProfile(null);
        setAdminPendingTotal(0);
        return;
      }

      let cancelled = false;
      (async () => {
        const cached = getCachedXpProfileSync() ?? (await loadCachedXpProfile());
        if (!cancelled && cached) {
          setXpProfile(cached);
        }

        if (!isAdmin) {
          if (!cancelled) setAdminPendingTotal(0);
          return;
        }
        const token = getAuthToken();
        if (!token) {
          if (!cancelled) setAdminPendingTotal(0);
          return;
        }
        try {
          const total = await adminApi.fetchAdminPendingTotal(token);
          if (!cancelled) setAdminPendingTotal(total);
        } catch {
          // Keep last known badge; don't block the profile screen.
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [authEnabled, isAdmin])
  );

  async function handleRefresh() {
    if (!authEnabled) return;

    const now = Date.now();
    const elapsed = now - lastRefreshAtRef.current;
    if (lastRefreshAtRef.current > 0 && elapsed < PROFILE_REFRESH_COOLDOWN_MS) {
      const waitSec = Math.ceil((PROFILE_REFRESH_COOLDOWN_MS - elapsed) / 1000);
      setXpError(tf('errors.rateLimited', { seconds: waitSec }));
      return;
    }

    setRefreshing(true);
    setXpError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        setXpProfile(null);
        return;
      }
      const [profile, pendingTotal] = await Promise.all([
        authApi.fetchXpProfile(token),
        isAdmin
          ? adminApi.fetchAdminPendingTotal(token).catch(() => null)
          : Promise.resolve(null),
        refreshUser(),
      ]);
      lastRefreshAtRef.current = Date.now();
      setXpProfile(profile);
      if (pendingTotal != null) setAdminPendingTotal(pendingTotal);
      await saveCachedXpProfile(profile);
    } catch (err) {
      if (isAppError(err) && err.code === 'rate_limited' && err.retryAfterSeconds) {
        lastRefreshAtRef.current =
          Date.now() - (PROFILE_REFRESH_COOLDOWN_MS - err.retryAfterSeconds * 1000);
      }
      setXpError(userFacingError(err, t, 'generic', tf));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      if (authEnabled) {
        router.replace('/login');
      }
    } finally {
      setSigningOut(false);
    }
  }

  async function handleAnonymousToggle(anonymous: boolean) {
    setPrivacyError(null);
    setPrivacyBusy(true);
    try {
      // Anonymous ON => publicUser false
      await setPublicUser(!anonymous);
    } catch (err) {
      setPrivacyError(userFacingError(err, t, 'generic'));
    } finally {
      setPrivacyBusy(false);
    }
  }

  async function handleChangePhoto() {
    if (!authEnabled || !user || photoBusy) return;
    setPhotoError(null);
    const uri = await askPickProfileImage();
    if (!uri) return;
    // Optimistic preview is applied inside setProfileImage; keep spinner only for upload.
    setPhotoBusy(true);
    try {
      await setProfileImage(uri);
    } catch (err) {
      setPhotoError(userFacingError(err, t, 'generic') || t('profile.photoError'));
    } finally {
      setPhotoBusy(false);
    }
  }

  const displayXp = xpProfile?.xp ?? user?.xp ?? 0;
  const xpLevel = xpProfile?.xpLevel ?? 1;
  const progress = Math.max(0, Math.min(1, xpProfile?.progress ?? 0));
  const toNext = xpProfile?.xpToNextLevel ?? 0;
  const isMaxXpLevel = xpProfile != null && (xpLevel >= 99 || toNext <= 0 && progress >= 1);
  const history = xpProfile?.history ?? [];
  const avatarUri = profileImageUri(user?.profileImageUrl);
  const adminBadgeLabel = formatAdminBadgeCount(adminPendingTotal);

  function renderHistoryReason(item: XpHistoryItem): string {
    const detail = item.detail?.trim()
      ? `: ${item.detail.trim()}`
      : '';
    return tf(historyReasonKey(item.reason), { detail });
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        authEnabled ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      <Pressable
        style={styles.avatarWrap}
        onPress={() => void handleChangePhoto()}
        disabled={!authEnabled || !user || photoBusy}
        accessibilityRole="button"
        accessibilityLabel={t('profile.changePhoto')}
      >
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={[styles.avatarImage, { borderColor: colors.primary }]}
            accessibilityLabel={t('profile.changePhoto')}
          />
        ) : (
          <MaterialCommunityIcons
            name="account-circle"
            size={88}
            color={colors.primary}
          />
        )}
        {photoBusy ? (
          <View style={styles.avatarBusy}>
            <ActivityIndicator color={colors.onPrimary} />
          </View>
        ) : authEnabled && user ? (
          <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons name="camera" size={14} color={colors.onPrimary} />
          </View>
        ) : null}
      </Pressable>
      {photoError ? <ErrorText style={styles.photoError}>{photoError}</ErrorText> : null}

      <Text style={[styles.username, { color: colors.text }]}>
        {user?.username ?? t('common.guest')}
      </Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>
        {isAdmin ? t('common.admin') : t('common.member')}
        {user?.level != null ? ` · ${t('common.level')} ${user.level}` : ''}
      </Text>

      {authEnabled && user && (
        <Pressable
          style={[
            styles.favoritesButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => router.push('/lists')}
        >
          <MaterialCommunityIcons name="format-list-bulleted" size={22} color={colors.primary} />
          <Text style={[styles.favoritesButtonText, { color: colors.text }]}>
            {t('profile.lists')}
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>
      )}

      {authEnabled && user && (
        <Pressable
          style={[
            styles.favoritesButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => router.push('/favorites')}
        >
          <MaterialCommunityIcons name="heart" size={22} color={colors.primary} />
          <Text style={[styles.favoritesButtonText, { color: colors.text }]}>
            {t('profile.favorites')}
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>
      )}

      {authEnabled && user && (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
            {t('profile.privacy')}
          </Text>
          <View style={styles.privacyRow}>
            <View style={styles.privacyTextWrap}>
              <Text style={[styles.privacyTitle, { color: colors.text }]}>
                {t('profile.anonymousTitle')}
              </Text>
              <Text style={[styles.privacyHint, { color: colors.textSecondary }]}>
                {t('profile.anonymousHint')}
              </Text>
            </View>
            <SmoothSwitch
              value={user.publicUser !== true}
              onValueChange={(value) => void handleAnonymousToggle(value)}
              disabled={privacyBusy}
            />
          </View>
          {privacyError ? (
            <ErrorText style={styles.privacyError}>{privacyError}</ErrorText>
          ) : null}
        </View>
      )}

      {authEnabled && (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.xpHeader}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
              {t('profile.xp')}
            </Text>
            <Text style={[styles.xpTotal, { color: colors.text }]}>
              {displayXp} XP
            </Text>
          </View>

          <Text style={[styles.xpLevelLabel, { color: colors.text }]}>
            {tf('profile.xpProgress', { level: xpLevel })}
          </Text>

          <View style={[styles.barTrack, { backgroundColor: colors.primaryMuted }]}>
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor: colors.primary,
                  width: `${Math.round(progress * 100)}%`,
                },
              ]}
            />
          </View>

          <Text style={[styles.xpHint, { color: colors.textSecondary }]}>
            {isMaxXpLevel
              ? t('profile.xpMaxLevel')
              : tf('profile.xpToNext', { remaining: toNext })}
            {xpProfile ? ` · ${xpProfile.xpIntoLevel}/${xpProfile.xpForLevel}` : ''}
          </Text>

          {xpError ? <ErrorText style={styles.xpError}>{xpError}</ErrorText> : null}
        </View>
      )}

      {authEnabled && (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Pressable
            style={styles.historyHeader}
            onPress={() => setHistoryOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: historyOpen }}
            accessibilityLabel={t('profile.xpHistory')}
          >
            <Text style={[styles.cardLabel, styles.historyHeaderLabel, { color: colors.textSecondary }]}>
              {t('profile.xpHistory')}
            </Text>
            {history.length > 0 ? (
              <Text style={[styles.historyCount, { color: colors.textSecondary }]}>
                {history.length}
              </Text>
            ) : null}
            <MaterialCommunityIcons
              name={historyOpen ? 'chevron-up' : 'chevron-down'}
              size={22}
              color={colors.textSecondary}
            />
          </Pressable>

          {historyOpen ? (
            history.length === 0 ? (
              <Text style={[styles.historyEmpty, { color: colors.textSecondary }]}>
                {t('profile.xpHistoryEmpty')}
              </Text>
            ) : (
              history.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.historyRow,
                    index < history.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.historyMain}>
                    <Text style={[styles.historyReason, { color: colors.text }]}>
                      {renderHistoryReason(item)}
                    </Text>
                    <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
                      {formatXpDate(item.createdAt, locale)}
                    </Text>
                  </View>
                  <Text style={[styles.historyXp, { color: colors.primary }]}>
                    +{item.xpAmount}
                  </Text>
                </View>
              ))
            )
          ) : null}
        </View>
      )}

      {authEnabled && isAdmin && (
        <Pressable
          style={[
            styles.adminButton,
            { backgroundColor: colors.primary },
          ]}
          onPress={() => router.push('/admin')}
          accessibilityRole="button"
          accessibilityLabel={
            adminPendingTotal > 0
              ? `${t('admin.open')}, ${adminPendingTotal}`
              : t('admin.open')
          }
        >
          <MaterialCommunityIcons
            name="shield-account"
            size={20}
            color={colors.onPrimary}
          />
          <Text style={[styles.adminButtonText, { color: colors.onPrimary }]}>
            {t('admin.open')}
          </Text>
          {adminBadgeLabel ? (
            <View style={styles.adminBadge} pointerEvents="none">
              <Text style={styles.adminBadgeText}>{adminBadgeLabel}</Text>
            </View>
          ) : null}
        </Pressable>
      )}

      {authEnabled && (
        <Pressable
          style={[
            styles.logoutButton,
            // Dark theme `danger` is a pale text color — use a solid fill for the button.
            {
              backgroundColor: isDark ? '#E53935' : colors.danger,
              opacity: signingOut ? 0.7 : 1,
            },
          ]}
          onPress={() => void handleSignOut()}
          disabled={signingOut}
          accessibilityState={{ busy: signingOut }}
        >
          <Text style={styles.logoutButtonText}>
            {signingOut ? t('profile.loggingOut') : t('profile.logOut')}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: 12,
    width: 88,
    height: 88,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
  },
  avatarBusy: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 44,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoError: {
    textAlign: 'center',
    marginBottom: 8,
  },
  username: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
  },
  meta: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 14,
  },
  favoritesButton: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  favoritesButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  privacyTextWrap: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  privacyHint: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  privacyError: {
    marginTop: 10,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyHeaderLabel: {
    flex: 1,
    marginBottom: 0,
  },
  historyCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  xpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  xpTotal: {
    fontSize: 15,
    fontWeight: '700',
  },
  xpLevelLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  barTrack: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  xpHint: {
    marginTop: 8,
    fontSize: 13,
  },
  xpError: {
    marginTop: 8,
  },
  historyEmpty: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  historyMain: {
    flex: 1,
  },
  historyReason: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  historyDate: {
    marginTop: 4,
    fontSize: 12,
  },
  historyXp: {
    fontSize: 15,
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  adminButton: {
    marginTop: 24,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    position: 'relative',
    overflow: 'visible',
  },
  adminButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  adminBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
