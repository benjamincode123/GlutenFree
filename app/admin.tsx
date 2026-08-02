import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { ALLERGEN_OPTIONS } from '../src/allergens/allergenPrefs';
import {
  AllergenStatus,
  allergensToStatuses,
  defaultAllergenStatuses,
  glutenStatusFromRating,
  ratingFromGlutenStatus,
  statusesToAllergens,
} from '../src/allergens/allergenForm';
import { useAuth } from '../src/auth/AuthContext';
import { getAuthToken } from '../src/auth/session';
import { AppTextInput } from '../src/components/KeyboardDismissBar';
import { ErrorText } from '../src/components/ErrorText';
import * as adminApi from '../src/data/adminApi';
import type {
  ApproveSubmissionEdits,
  MergeSuggestionItem,
  ProductImageValidationItem,
  ProductSubmissionItem,
  WrongInfoReportItem,
} from '../src/data/adminApi';
import { getProductRepository } from '../src/data/repository';
import {
  GlutenRating,
  isGlutenRating,
  ProductCatalog,
} from '../src/db/types';
import { userFacingError } from '../src/errors/userFacingError';
import { useI18n } from '../src/i18n/I18nContext';
import type { TranslationKey } from '../src/i18n/translations';
import { useReliableBackHeader } from '../src/navigation/useReliableBackHeader';
import { useTheme } from '../src/theme/ThemeContext';
import { formatApiDateTime } from '../src/time/formatApiDate';

const CONTAINS_CHIP = { color: '#B3261E', backgroundColor: '#FBE5E4' };
const TRACES_CHIP = { color: '#B26A00', backgroundColor: '#FCF0DA' };

type AdminTab = 'products' | 'images' | 'wrongInfo' | 'merges' | 'notifications';
type NotifyAudience = 'all' | 'users' | 'top';
type NotifyPeriod = 'day' | 'week' | 'month';

const ADMIN_TABS: { id: AdminTab; labelKey: TranslationKey }[] = [
  { id: 'products', labelKey: 'admin.tabProducts' },
  { id: 'images', labelKey: 'admin.tabImages' },
  { id: 'wrongInfo', labelKey: 'admin.tabWrongInfo' },
  { id: 'merges', labelKey: 'admin.tabMerges' },
  { id: 'notifications', labelKey: 'admin.tabNotifications' },
];

function parseNotifyTargets(raw: string): Array<number | string> {
  return raw
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (/^\d+$/.test(part)) {
        return Number(part);
      }
      return part;
    });
}

function formatDate(iso: string, locale: string): string {
  return formatApiDateTime(iso, locale);
}

function allergensFromRating(rating: GlutenRating) {
  return statusesToAllergens({
    ...defaultAllergenStatuses(),
    Gluten: glutenStatusFromRating(rating),
  });
}

function draftFromItem(item: ProductSubmissionItem): ApproveSubmissionEdits {
  const glutenRating = isGlutenRating(item.glutenRating)
    ? item.glutenRating
    : GlutenRating.GlutenFree;
  const allergens = item.allergens
    ? statusesToAllergens(allergensToStatuses(item.allergens))
    : allergensFromRating(glutenRating);
  return {
    barcode: item.barcode,
    name: item.name,
    produsent: item.produsent ?? '',
    ingredients: item.ingredients ?? '',
    glutenRating: ratingFromGlutenStatus(
      allergensToStatuses(allergens).Gluten ?? glutenStatusFromRating(glutenRating)
    ),
    allergens,
  };
}

function draftFromWrongInfo(item: WrongInfoReportItem): ApproveSubmissionEdits {
  const ratingRaw = item.productGlutenRating ?? '';
  const glutenRating: GlutenRating = isGlutenRating(ratingRaw)
    ? ratingRaw
    : GlutenRating.GlutenFree;
  return {
    barcode: item.productBarcode ?? '',
    name: item.productName ?? '',
    produsent: item.productProdusent ?? '',
    ingredients: item.productIngredients ?? '',
    glutenRating,
    allergens: allergensFromRating(glutenRating),
  };
}

function parseCatalog(value: string): ProductCatalog | null {
  if (
    value === 'products' ||
    value === 'products_se' ||
    value === 'products_dk' ||
    value === 'products_de'
  ) {
    return value;
  }
  return null;
}

function imageUri(imageUrl: string): string {
  const raw = (imageUrl ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:')) return raw;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

export default function AdminScreen() {
  const router = useRouter();
  const { isAdmin, authEnabled } = useAuth();
  const { colors } = useTheme();
  const { t, tf, locale } = useI18n();
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 768;
  const isXWide = windowWidth >= 1100;

  const shellStyle = useMemo(
    () => [
      styles.content,
      {
        width: '100%' as const,
        maxWidth: isXWide ? 1200 : isWide ? 960 : undefined,
        alignSelf: 'center' as const,
        paddingHorizontal: isWide ? 28 : 16,
        paddingTop: isWide ? 24 : 16,
      },
    ],
    [isWide, isXWide],
  );

  const [tab, setTab] = useState<AdminTab>('products');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ProductSubmissionItem[]>([]);
  const [imageItems, setImageItems] = useState<ProductImageValidationItem[]>([]);
  const [wrongInfoItems, setWrongInfoItems] = useState<WrongInfoReportItem[]>([]);
  const [mergeItems, setMergeItems] = useState<MergeSuggestionItem[]>([]);
  const [notificationItems, setNotificationItems] = useState<
    adminApi.AdminNotificationItem[]
  >([]);
  const [drafts, setDrafts] = useState<Record<number, ApproveSubmissionEdits>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [notifyImageUrl, setNotifyImageUrl] = useState('');
  const [notifyAudience, setNotifyAudience] = useState<NotifyAudience>('all');
  const [notifyTargets, setNotifyTargets] = useState('');
  const [notifyPeriod, setNotifyPeriod] = useState<NotifyPeriod>('week');
  const [notifyRank, setNotifyRank] = useState('1');
  const [notifyTopN, setNotifyTopN] = useState('');
  const [notifySending, setNotifySending] = useState(false);
  const [notifySuccess, setNotifySuccess] = useState<string | null>(null);

  useReliableBackHeader({ title: t('nav.admin') });

  const applyProductList = useCallback((result: adminApi.ProductSubmissionList) => {
    setItems(result.items);
    setTotalCount(result.totalCount);
    setPageSize(result.pageSize);
    setDrafts(
      Object.fromEntries(result.items.map((item) => [item.id, draftFromItem(item)]))
    );
  }, []);

  const applyImageList = useCallback((result: adminApi.ProductImageValidationList) => {
    setImageItems(result.items);
    setTotalCount(result.totalCount);
    setPageSize(result.pageSize);
  }, []);

  const applyWrongInfoList = useCallback((result: adminApi.WrongInfoReportList) => {
    setWrongInfoItems(result.items);
    setTotalCount(result.totalCount);
    setPageSize(result.pageSize);
    setDrafts(
      Object.fromEntries(
        result.items
          .filter((item) => item.productFound)
          .map((item) => [item.id, draftFromWrongInfo(item)])
      )
    );
  }, []);

  const applyMergeList = useCallback((result: adminApi.MergeSuggestionList) => {
    setMergeItems(result.items);
    setTotalCount(result.totalCount);
    setPageSize(result.pageSize);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!authEnabled || !isAdmin) {
        router.replace('/user');
        return;
      }

      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const token = getAuthToken();
          if (!token) {
            throw new Error('unauthorized');
          }
          if (tab === 'products') {
            const result = await adminApi.fetchPendingSubmissions(token, page);
            if (!cancelled) {
              applyProductList(result);
              setImageItems([]);
              setWrongInfoItems([]);
              setMergeItems([]);
              setNotificationItems([]);
            }
          } else if (tab === 'images') {
            const result = await adminApi.fetchPendingImageValidations(token, page);
            if (!cancelled) {
              applyImageList(result);
              setItems([]);
              setWrongInfoItems([]);
              setMergeItems([]);
              setNotificationItems([]);
              setDrafts({});
            }
          } else if (tab === 'wrongInfo') {
            const result = await adminApi.fetchPendingWrongInfoReports(token, page);
            if (!cancelled) {
              applyWrongInfoList(result);
              setItems([]);
              setImageItems([]);
              setMergeItems([]);
              setNotificationItems([]);
            }
          } else if (tab === 'merges') {
            const result = await adminApi.fetchPendingMergeSuggestions(token, page);
            if (!cancelled) {
              applyMergeList(result);
              setItems([]);
              setImageItems([]);
              setWrongInfoItems([]);
              setNotificationItems([]);
              setDrafts({});
            }
          } else {
            const result = await adminApi.fetchAdminNotifications(token, 30);
            if (!cancelled) {
              setNotificationItems(result);
              setTotalCount(0);
              setItems([]);
              setImageItems([]);
              setWrongInfoItems([]);
              setMergeItems([]);
              setDrafts({});
            }
          }
        } catch (err) {
          if (!cancelled) {
            setError(userFacingError(err, t, 'forbidden'));
            setItems([]);
            setImageItems([]);
            setWrongInfoItems([]);
            setMergeItems([]);
            setNotificationItems([]);
            setDrafts({});
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [
      authEnabled,
      isAdmin,
      page,
      tab,
      router,
      t,
      applyProductList,
      applyImageList,
      applyWrongInfoList,
      applyMergeList,
    ])
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const switchTab = (next: AdminTab) => {
    if (next === tab) return;
    setTab(next);
    setPage(1);
    setError(null);
    setBusyId(null);
    setNotifySuccess(null);
  };

  const handleDeleteNotification = async (id: number) => {
    setBusyId(id);
    setError(null);
    setNotifySuccess(null);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('unauthorized');
      }
      await adminApi.deleteNotification(token, id);
      setNotificationItems((prev) => prev.filter((n) => n.id !== id));
      setNotifySuccess(t('admin.notifyDeleted'));
    } catch (err) {
      setError(userFacingError(err, t, 'forbidden'));
    } finally {
      setBusyId(null);
    }
  };

  const handleSendNotification = async () => {
    const title = notifyTitle.trim();
    const body = notifyBody.trim();
    const imageUrl = notifyImageUrl.trim();
    if (!title) {
      setError(t('admin.notifyTitleRequired'));
      return;
    }
    if (!body) {
      setError(t('admin.notifyBodyRequired'));
      return;
    }
    if (notifyAudience === 'users' && !notifyTargets.trim()) {
      setError(t('admin.notifyUsersRequired'));
      return;
    }

    setNotifySending(true);
    setError(null);
    setNotifySuccess(null);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('unauthorized');
      }

      let recipientCount = 0;
      if (notifyAudience === 'top') {
        const rank = Math.max(1, Number.parseInt(notifyRank, 10) || 1);
        const topRaw = notifyTopN.trim();
        const top = topRaw ? Math.max(1, Number.parseInt(topRaw, 10) || 1) : undefined;
        const result = await adminApi.createTopCollaboratorNotification(token, {
          period: notifyPeriod,
          title,
          body,
          imageUrl: imageUrl || null,
          rank: top ? undefined : rank,
          top,
        });
        recipientCount = result.recipientCount;
      } else {
        const toUsers: adminApi.NotificationToUsers =
          notifyAudience === 'all' ? 'all' : parseNotifyTargets(notifyTargets);
        const result = await adminApi.createNotification(token, {
          title,
          body,
          imageUrl: imageUrl || null,
          toUsers,
        });
        recipientCount = result.recipientCount;
      }

      setNotifySuccess(tf('admin.notifySent', { count: recipientCount }));
      setNotifyTitle('');
      setNotifyBody('');
      setNotifyImageUrl('');
      setNotifyTargets('');
      const recent = await adminApi.fetchAdminNotifications(token, 30);
      setNotificationItems(recent);
    } catch (err) {
      setError(userFacingError(err, t, 'forbidden'));
    } finally {
      setNotifySending(false);
    }
  };

  const updateDraft = (
    id: number,
    patch: Partial<ApproveSubmissionEdits>
  ) => {
    setDrafts((prev) => {
      const existing = prev[id];
      const submission = items.find((i) => i.id === id);
      const report = wrongInfoItems.find((i) => i.id === id);
      const base =
        existing ??
        (submission
          ? draftFromItem(submission)
          : report
            ? draftFromWrongInfo(report)
            : null);
      if (!base) return prev;
      return { ...prev, [id]: { ...base, ...patch } };
    });
  };

  const toggleDraftAllergen = (
    id: number,
    draft: ApproveSubmissionEdits,
    allergen: string,
    kind: 'contains' | 'mayContain'
  ) => {
    const statuses = allergensToStatuses(draft.allergens);
    const current = statuses[allergen] ?? 'free';
    const next: AllergenStatus = current === kind ? 'free' : kind;
    statuses[allergen] = next;
    const allergens = statusesToAllergens(statuses);
    updateDraft(id, {
      allergens,
      glutenRating:
        allergen === 'Gluten'
          ? ratingFromGlutenStatus(next)
          : draft.glutenRating,
    });
  };

  const renderAllergenEditor = (
    id: number,
    draft: ApproveSubmissionEdits,
    disabled: boolean
  ) => {
    const statuses = allergensToStatuses(draft.allergens);
    return (
      <>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t('add.allergens')}
        </Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t('add.allergensHint')}
        </Text>

        <Text style={[styles.allergenGroupLabel, { color: CONTAINS_CHIP.color }]}>
          {t('add.allergenContains')}
        </Text>
        <View style={styles.allergenWrap}>
          {ALLERGEN_OPTIONS.map((allergen) => {
            const active = (statuses[allergen] ?? 'free') === 'contains';
            return (
              <Pressable
                key={`contains-${id}-${allergen}`}
                disabled={disabled}
                onPress={() =>
                  toggleDraftAllergen(id, draft, allergen, 'contains')
                }
                style={[
                  styles.allergenChip,
                  {
                    borderColor: active ? CONTAINS_CHIP.color : colors.border,
                    backgroundColor: active
                      ? CONTAINS_CHIP.backgroundColor
                      : colors.background,
                    opacity: disabled ? 0.45 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.allergenChipText,
                    { color: active ? CONTAINS_CHIP.color : colors.text },
                  ]}
                >
                  {allergen}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.allergenGroupLabel, { color: TRACES_CHIP.color }]}>
          {t('add.allergenMayContain')}
        </Text>
        <View style={styles.allergenWrap}>
          {ALLERGEN_OPTIONS.map((allergen) => {
            const active = (statuses[allergen] ?? 'free') === 'mayContain';
            return (
              <Pressable
                key={`traces-${id}-${allergen}`}
                disabled={disabled}
                onPress={() =>
                  toggleDraftAllergen(id, draft, allergen, 'mayContain')
                }
                style={[
                  styles.allergenChip,
                  {
                    borderColor: active ? TRACES_CHIP.color : colors.border,
                    backgroundColor: active
                      ? TRACES_CHIP.backgroundColor
                      : colors.background,
                    opacity: disabled ? 0.45 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.allergenChipText,
                    { color: active ? TRACES_CHIP.color : colors.text },
                  ]}
                >
                  {allergen}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  };

  async function handleApprove(id: number) {
    const token = getAuthToken();
    if (!token) return;
    const draft = drafts[id];
    if (!draft) return;
    if (!draft.name.trim()) {
      setError(t('admin.nameRequired'));
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await adminApi.approveSubmission(token, id, {
        barcode: draft.barcode.trim() || 'unknown',
        name: draft.name.trim(),
        produsent: draft.produsent,
        ingredients: draft.ingredients,
        glutenRating: draft.glutenRating,
        allergens: draft.allergens,
      });
      const result = await adminApi.fetchPendingSubmissions(token, page);
      applyProductList(result);
      if (result.items.length === 0 && page > 1) {
        setPage((p) => p - 1);
      }
    } catch (err) {
      setError(userFacingError(err, t, 'generic'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeny(id: number) {
    const token = getAuthToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await adminApi.denySubmission(token, id);
      const result = await adminApi.fetchPendingSubmissions(token, page);
      applyProductList(result);
      if (result.items.length === 0 && page > 1) {
        setPage((p) => p - 1);
      }
    } catch (err) {
      setError(userFacingError(err, t, 'generic'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleApproveImage(id: number) {
    const token = getAuthToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await adminApi.approveImageValidation(token, id);
      const result = await adminApi.fetchPendingImageValidations(token, page);
      applyImageList(result);
      if (result.items.length === 0 && page > 1) {
        setPage((p) => p - 1);
      }
    } catch (err) {
      setError(userFacingError(err, t, 'generic'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDenyImage(id: number) {
    const token = getAuthToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await adminApi.denyImageValidation(token, id);
      const result = await adminApi.fetchPendingImageValidations(token, page);
      applyImageList(result);
      if (result.items.length === 0 && page > 1) {
        setPage((p) => p - 1);
      }
    } catch (err) {
      setError(userFacingError(err, t, 'generic'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveAndResolveWrongInfo(id: number) {
    const token = getAuthToken();
    if (!token) return;
    const item = wrongInfoItems.find((r) => r.id === id);
    if (!item || !item.productFound) return;
    const catalog = parseCatalog(item.catalog);
    if (!catalog) {
      setError(t('admin.nameRequired'));
      return;
    }
    const draft = drafts[id] ?? draftFromWrongInfo(item);
    if (!draft.name.trim()) {
      setError(t('admin.nameRequired'));
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await getProductRepository().addProduct({
        barcode: draft.barcode.trim() || 'unknown',
        name: draft.name.trim(),
        produsent: draft.produsent.trim() || null,
        ingredients: draft.ingredients.trim() || null,
        glutenRating: isGlutenRating(draft.glutenRating)
          ? draft.glutenRating
          : GlutenRating.GlutenFree,
        allergens: draft.allergens,
        id: item.productId,
        catalog,
      });
      await adminApi.resolveWrongInfoReport(token, id);
      const result = await adminApi.fetchPendingWrongInfoReports(token, page);
      applyWrongInfoList(result);
      if (result.items.length === 0 && page > 1) {
        setPage((p) => p - 1);
      }
    } catch (err) {
      setError(userFacingError(err, t, 'generic'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismissWrongInfo(id: number) {
    const token = getAuthToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await adminApi.dismissWrongInfoReport(token, id);
      const result = await adminApi.fetchPendingWrongInfoReports(token, page);
      applyWrongInfoList(result);
      if (result.items.length === 0 && page > 1) {
        setPage((p) => p - 1);
      }
    } catch (err) {
      setError(userFacingError(err, t, 'generic'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleAcceptMerge(id: number) {
    const token = getAuthToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await adminApi.acceptMergeSuggestion(token, id);
      const result = await adminApi.fetchPendingMergeSuggestions(token, page);
      applyMergeList(result);
      if (result.items.length === 0 && page > 1) {
        setPage((p) => p - 1);
      }
    } catch (err) {
      setError(userFacingError(err, t, 'generic'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismissMerge(id: number) {
    const token = getAuthToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await adminApi.dismissMergeSuggestion(token, id);
      const result = await adminApi.fetchPendingMergeSuggestions(token, page);
      applyMergeList(result);
      if (result.items.length === 0 && page > 1) {
        setPage((p) => p - 1);
      }
    } catch (err) {
      setError(userFacingError(err, t, 'generic'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={shellStyle}
      keyboardShouldPersistTaps="handled"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={[styles.tabs, isWide && styles.tabsWide]}
      >
        {ADMIN_TABS.map((item) => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              style={[
                styles.tab,
                isWide && styles.tabWide,
                {
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active
                    ? colors.primaryMuted
                    : colors.background,
                },
              ]}
              onPress={() => switchTab(item.id)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.primary : colors.text },
                ]}
                numberOfLines={1}
              >
                {t(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {tab === 'products'
          ? t('admin.subtitle')
          : tab === 'images'
            ? t('admin.imagesSubtitle')
            : tab === 'wrongInfo'
              ? t('admin.wrongInfoSubtitle')
              : tab === 'merges'
                ? t('admin.mergesSubtitle')
                : t('admin.notificationsSubtitle')}
      </Text>
      {tab === 'products' || tab === 'wrongInfo' ? (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {tab === 'products' ? t('admin.editHint') : t('admin.wrongInfoEditHint')}
        </Text>
      ) : null}

      {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}
      {notifySuccess && tab === 'notifications' ? (
        <Text style={[styles.success, { color: colors.primary }]}>{notifySuccess}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : tab === 'notifications' ? (
        <>
          <View
            style={[
              styles.slot,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('admin.notifyTitle')}
            </Text>
            <AppTextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  color: colors.text,
                  backgroundColor: colors.background,
                },
              ]}
              value={notifyTitle}
              onChangeText={setNotifyTitle}
              editable={!notifySending}
              maxLength={200}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('admin.notifyBody')}
            </Text>
            <AppTextInput
              style={[
                styles.input,
                styles.multiline,
                {
                  borderColor: colors.border,
                  color: colors.text,
                  backgroundColor: colors.background,
                },
              ]}
              value={notifyBody}
              onChangeText={setNotifyBody}
              editable={!notifySending}
              multiline
              textAlignVertical="top"
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('admin.notifyImageUrl')}
            </Text>
            <AppTextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  color: colors.text,
                  backgroundColor: colors.background,
                },
              ]}
              value={notifyImageUrl}
              onChangeText={setNotifyImageUrl}
              editable={!notifySending}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('admin.notifyAudience')}
            </Text>
            <View style={styles.audienceRow}>
              {(
                [
                  ['all', 'admin.notifyAll'],
                  ['users', 'admin.notifyUsers'],
                  ['top', 'admin.notifyTop'],
                ] as const
              ).map(([id, labelKey]) => {
                const active = notifyAudience === id;
                return (
                  <Pressable
                    key={id}
                    style={[
                      styles.audienceChip,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active
                          ? colors.primaryMuted
                          : colors.background,
                      },
                    ]}
                    disabled={notifySending}
                    onPress={() => setNotifyAudience(id)}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        { color: active ? colors.primary : colors.text },
                      ]}
                    >
                      {t(labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {notifyAudience === 'users' ? (
              <>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('admin.notifyUsersHint')}
                </Text>
                <AppTextInput
                  style={[
                    styles.input,
                    styles.multiline,
                    {
                      borderColor: colors.border,
                      color: colors.text,
                      backgroundColor: colors.background,
                    },
                  ]}
                  value={notifyTargets}
                  onChangeText={setNotifyTargets}
                  editable={!notifySending}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="alice, 12, bob"
                  placeholderTextColor={colors.textSecondary}
                />
              </>
            ) : null}

            {notifyAudience === 'top' ? (
              <>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('admin.notifyPeriod')}
                </Text>
                <View style={styles.audienceRow}>
                  {(
                    [
                      ['day', 'admin.notifyPeriodDay'],
                      ['week', 'admin.notifyPeriodWeek'],
                      ['month', 'admin.notifyPeriodMonth'],
                    ] as const
                  ).map(([id, labelKey]) => {
                    const active = notifyPeriod === id;
                    return (
                      <Pressable
                        key={id}
                        style={[
                          styles.audienceChip,
                          {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active
                              ? colors.primaryMuted
                              : colors.background,
                          },
                        ]}
                        disabled={notifySending}
                        onPress={() => setNotifyPeriod(id)}
                      >
                        <Text
                          style={[
                            styles.tabText,
                            { color: active ? colors.primary : colors.text },
                          ]}
                        >
                          {t(labelKey)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.fieldsRow, isWide && styles.fieldsRowWide]}>
                  <View style={[styles.field, isWide && styles.fieldHalf]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                      {t('admin.notifyRank')}
                    </Text>
                    <AppTextInput
                      style={[
                        styles.input,
                        {
                          borderColor: colors.border,
                          color: colors.text,
                          backgroundColor: colors.background,
                        },
                      ]}
                      value={notifyRank}
                      onChangeText={setNotifyRank}
                      editable={!notifySending && !notifyTopN.trim()}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={[styles.field, isWide && styles.fieldHalf]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                      {t('admin.notifyTopN')}
                    </Text>
                    <AppTextInput
                      style={[
                        styles.input,
                        {
                          borderColor: colors.border,
                          color: colors.text,
                          backgroundColor: colors.background,
                        },
                      ]}
                      value={notifyTopN}
                      onChangeText={setNotifyTopN}
                      editable={!notifySending}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              </>
            ) : null}

            <View style={[styles.actions, isWide && styles.actionsWide]}>
              <Pressable
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.primary },
                  notifySending && styles.actionDisabled,
                ]}
                disabled={notifySending}
                onPress={() => void handleSendNotification()}
              >
                <Text style={[styles.approveText, { color: colors.onPrimary }]}>
                  {notifySending ? t('admin.notifySending') : t('admin.notifySend')}
                </Text>
              </Pressable>
            </View>
          </View>

          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            {t('admin.notifyRecent')}
          </Text>
          {notificationItems.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              {t('admin.notifyEmpty')}
            </Text>
          ) : (
            notificationItems.map((item) => {
              const busy = busyId === item.id;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.slot,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.productTitle, { color: colors.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.reportComment, { color: colors.text }]}>
                    {item.body}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {t('admin.notifyAudience')}: {item.toUsers}
                  </Text>
                  <Text
                    style={[
                      styles.meta,
                      { color: colors.textSecondary, marginBottom: 10 },
                    ]}
                  >
                    {formatDate(item.createdAt, locale)}
                  </Text>
                  <View style={[styles.actions, isWide && styles.actionsWide]}>
                    <Pressable
                      style={[
                        styles.actionBtn,
                        styles.denyBtn,
                        { borderColor: colors.danger },
                        busy && styles.actionDisabled,
                      ]}
                      disabled={busyId !== null || notifySending}
                      onPress={() => void handleDeleteNotification(item.id)}
                    >
                      <Text style={[styles.denyText, { color: colors.danger }]}>
                        {busy
                          ? t('admin.notifyDeleting')
                          : t('admin.notifyDelete')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </>
      ) : tab === 'products' ? (
        items.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {t('admin.empty')}
          </Text>
        ) : (
          items.map((item) => {
            const draft = drafts[item.id] ?? draftFromItem(item);
            const busy = busyId === item.id;
            return (
              <View
                key={item.id}
                style={[
                  styles.slot,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={[styles.slotBody, isWide && styles.slotBodyWide]}>
                  {item.imageUrl?.trim() ? (
                    <Pressable
                      onPress={() => setPreviewUri(imageUri(item.imageUrl))}
                      accessibilityRole="imagebutton"
                      accessibilityLabel={t('admin.viewImage')}
                      style={[styles.photoWrap, isWide && styles.photoWrapWide]}
                    >
                      <Image
                        source={{ uri: imageUri(item.imageUrl) }}
                        style={[styles.photo, isWide && styles.photoWide]}
                        resizeMode="contain"
                      />
                    </Pressable>
                  ) : null}

                  <View style={styles.formCol}>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      {t('admin.submittedBy')}:{' '}
                      {item.submittedByUsername ?? `#${item.submittedByUserId}`}
                    </Text>
                    <Text
                      style={[
                        styles.meta,
                        { color: colors.textSecondary, marginBottom: 10 },
                      ]}
                    >
                      {t('admin.submittedAt')}: {formatDate(item.createdAt, locale)}
                    </Text>

                    <View style={[styles.fieldsRow, isWide && styles.fieldsRowWide]}>
                      <View style={[styles.field, isWide && styles.fieldHalf]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>
                          {t('admin.produsent')}
                        </Text>
                        <AppTextInput
                          style={[
                            styles.input,
                            {
                              borderColor: colors.border,
                              color: colors.text,
                              backgroundColor: colors.background,
                            },
                          ]}
                          value={draft.produsent}
                          onChangeText={(produsent) =>
                            updateDraft(item.id, { produsent })
                          }
                          editable={busyId === null}
                        />
                      </View>
                      <View style={[styles.field, isWide && styles.fieldHalf]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>
                          {t('admin.name')}
                        </Text>
                        <AppTextInput
                          style={[
                            styles.input,
                            {
                              borderColor: colors.border,
                              color: colors.text,
                              backgroundColor: colors.background,
                            },
                          ]}
                          value={draft.name}
                          onChangeText={(name) => updateDraft(item.id, { name })}
                          editable={busyId === null}
                        />
                      </View>
                      <View style={[styles.field, isWide && styles.fieldHalf]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>
                          {t('admin.barcode')}
                        </Text>
                        <AppTextInput
                          style={[
                            styles.input,
                            {
                              borderColor: colors.border,
                              color: colors.text,
                              backgroundColor: colors.background,
                            },
                          ]}
                          value={draft.barcode}
                          onChangeText={(barcode) =>
                            updateDraft(item.id, { barcode })
                          }
                          editable={busyId === null}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>
                    </View>

                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                      {t('admin.ingredients')}
                    </Text>
                    <AppTextInput
                      style={[
                        styles.input,
                        styles.multiline,
                        {
                          borderColor: colors.border,
                          color: colors.text,
                          backgroundColor: colors.background,
                        },
                      ]}
                      value={draft.ingredients}
                      onChangeText={(ingredients) =>
                        updateDraft(item.id, { ingredients })
                      }
                      editable={busyId === null}
                      multiline
                      textAlignVertical="top"
                    />

                    {renderAllergenEditor(item.id, draft, busyId !== null)}

                    <View style={[styles.actions, isWide && styles.actionsWide]}>
                      <Pressable
                        style={[
                          styles.actionBtn,
                          styles.denyBtn,
                          { borderColor: colors.danger },
                          busy && styles.actionDisabled,
                        ]}
                        disabled={busyId !== null}
                        onPress={() => void handleDeny(item.id)}
                      >
                        <Text style={[styles.denyText, { color: colors.danger }]}>
                          {busy ? t('common.saving') : t('admin.deny')}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.actionBtn,
                          { backgroundColor: colors.primary },
                          busy && styles.actionDisabled,
                        ]}
                        disabled={busyId !== null}
                        onPress={() => void handleApprove(item.id)}
                      >
                        <Text
                          style={[styles.approveText, { color: colors.onPrimary }]}
                        >
                          {busy ? t('common.saving') : t('admin.approve')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )
      ) : tab === 'images' ? (
        imageItems.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          {t('admin.imagesEmpty')}
        </Text>
      ) : (
        imageItems.map((item) => {
          const busy = busyId === item.id;
          return (
            <View
              key={item.id}
              style={[
                styles.slot,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.slotBody, isWide && styles.slotBodyWide]}>
                {item.imageUrl?.trim() ? (
                  <Pressable
                    onPress={() => setPreviewUri(imageUri(item.imageUrl))}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={t('admin.viewImage')}
                    style={[styles.photoWrap, isWide && styles.photoWrapWide]}
                  >
                    <Image
                      source={{ uri: imageUri(item.imageUrl) }}
                      style={[styles.photo, isWide && styles.photoWide]}
                      resizeMode="contain"
                    />
                  </Pressable>
                ) : null}

                <View style={styles.formCol}>
                  <Text style={[styles.productTitle, { color: colors.text }]}>
                    {item.productName}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {t('admin.catalog')}: {item.catalog} · #{item.productId}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {t('admin.submittedBy')}:{' '}
                    {item.submittedByUsername ?? `#${item.submittedByUserId}`}
                  </Text>
                  <Text
                    style={[
                      styles.meta,
                      { color: colors.textSecondary, marginBottom: 10 },
                    ]}
                  >
                    {t('admin.submittedAt')}: {formatDate(item.createdAt, locale)}
                  </Text>

                  <View style={[styles.actions, isWide && styles.actionsWide]}>
                    <Pressable
                      style={[
                        styles.actionBtn,
                        styles.denyBtn,
                        { borderColor: colors.danger },
                        busy && styles.actionDisabled,
                      ]}
                      disabled={busyId !== null}
                      onPress={() => void handleDenyImage(item.id)}
                    >
                      <Text style={[styles.denyText, { color: colors.danger }]}>
                        {busy ? t('common.saving') : t('admin.deny')}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.actionBtn,
                        { backgroundColor: colors.primary },
                        busy && styles.actionDisabled,
                      ]}
                      disabled={busyId !== null}
                      onPress={() => void handleApproveImage(item.id)}
                    >
                      <Text
                        style={[styles.approveText, { color: colors.onPrimary }]}
                      >
                        {busy ? t('common.saving') : t('admin.approve')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          );
        })
      )
      ) : tab === 'wrongInfo' ? (
        wrongInfoItems.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          {t('admin.wrongInfoEmpty')}
        </Text>
      ) : (
        wrongInfoItems.map((item) => {
          const busy = busyId === item.id;
          const draft = drafts[item.id] ?? draftFromWrongInfo(item);
          return (
            <View
              key={item.id}
              style={[
                styles.slot,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('admin.wrongInfoEmne')}
              </Text>
              <Text style={[styles.productTitle, { color: colors.text }]}>
                {item.emne}
              </Text>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('admin.wrongInfoComment')}
              </Text>
              <Text style={[styles.reportComment, { color: colors.text }]}>
                {item.comment}
              </Text>

              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {t('admin.catalog')}: {item.catalog} · #{item.productId}
              </Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {t('admin.submittedBy')}:{' '}
                {item.reportedByUsername ?? `#${item.reportedByUserId}`}
              </Text>
              <Text
                style={[styles.meta, { color: colors.textSecondary, marginBottom: 10 }]}
              >
                {t('admin.submittedAt')}: {formatDate(item.createdAt, locale)}
              </Text>

              {!item.productFound ? (
                <ErrorText style={styles.error}>
                  {t('admin.wrongInfoProductMissing')}
                </ErrorText>
              ) : (
                <>
                  <View style={[styles.fieldsRow, isWide && styles.fieldsRowWide]}>
                    <View style={[styles.field, isWide && styles.fieldHalf]}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>
                        {t('admin.produsent')}
                      </Text>
                      <AppTextInput
                        style={[
                          styles.input,
                          {
                            borderColor: colors.border,
                            color: colors.text,
                            backgroundColor: colors.background,
                          },
                        ]}
                        value={draft.produsent}
                        onChangeText={(produsent) =>
                          updateDraft(item.id, { produsent })
                        }
                        editable={busyId === null}
                      />
                    </View>
                    <View style={[styles.field, isWide && styles.fieldHalf]}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>
                        {t('admin.name')}
                      </Text>
                      <AppTextInput
                        style={[
                          styles.input,
                          {
                            borderColor: colors.border,
                            color: colors.text,
                            backgroundColor: colors.background,
                          },
                        ]}
                        value={draft.name}
                        onChangeText={(name) => updateDraft(item.id, { name })}
                        editable={busyId === null}
                      />
                    </View>
                    <View style={[styles.field, isWide && styles.fieldHalf]}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>
                        {t('admin.barcode')}
                      </Text>
                      <AppTextInput
                        style={[
                          styles.input,
                          {
                            borderColor: colors.border,
                            color: colors.text,
                            backgroundColor: colors.background,
                          },
                        ]}
                        value={draft.barcode}
                        onChangeText={(barcode) =>
                          updateDraft(item.id, { barcode })
                        }
                        editable={busyId === null}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>

                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('admin.ingredients')}
                  </Text>
                  <AppTextInput
                    style={[
                      styles.input,
                      styles.multiline,
                      {
                        borderColor: colors.border,
                        color: colors.text,
                        backgroundColor: colors.background,
                      },
                    ]}
                    value={draft.ingredients}
                    onChangeText={(ingredients) =>
                      updateDraft(item.id, { ingredients })
                    }
                    editable={busyId === null}
                    multiline
                    textAlignVertical="top"
                  />

                  {renderAllergenEditor(item.id, draft, busyId !== null)}
                </>
              )}

              <View style={[styles.actions, isWide && styles.actionsWide]}>
                <Pressable
                  style={[
                    styles.actionBtn,
                    styles.denyBtn,
                    { borderColor: colors.danger },
                    busy && styles.actionDisabled,
                  ]}
                  disabled={busyId !== null}
                  onPress={() => void handleDismissWrongInfo(item.id)}
                >
                  <Text style={[styles.denyText, { color: colors.danger }]}>
                    {busy ? t('common.saving') : t('admin.dismiss')}
                  </Text>
                </Pressable>
                {item.productFound ? (
                  <Pressable
                    style={[
                      styles.actionBtn,
                      { backgroundColor: colors.primary },
                      busy && styles.actionDisabled,
                    ]}
                    disabled={busyId !== null}
                    onPress={() => void handleSaveAndResolveWrongInfo(item.id)}
                  >
                    <Text style={[styles.approveText, { color: colors.onPrimary }]}>
                      {busy ? t('common.saving') : t('admin.saveAndResolve')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })
      )
      ) : mergeItems.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          {t('admin.mergesEmpty')}
        </Text>
      ) : (
        mergeItems.map((item) => {
          const busy = busyId === item.id;
          return (
            <View
              key={item.id}
              style={[
                styles.slot,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {t('admin.catalog')}: {item.catalog}
                {' · '}
                {formatDate(item.createdAt, locale)}
                {' · '}
                {item.suggestedByUsername ?? `#${item.suggestedByUserId}`}
              </Text>

              <View style={[styles.mergeCompare, isWide && styles.mergeCompareWide]}>
                <View style={[styles.mergePane, isWide && styles.mergePaneWide]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('admin.mergeSource')}
                  </Text>
                  <Text style={[styles.productTitle, { color: colors.text }]}>
                    {item.sourceFound
                      ? `${item.sourceName ?? '—'} (#${item.sourceProductId})`
                      : `#${item.sourceProductId}`}
                  </Text>
                  {item.sourceFound ? (
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      {[item.sourceProdusent, item.sourceBarcode]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.mergePane, isWide && styles.mergePaneWide]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('admin.mergeTarget')}
                  </Text>
                  <Text style={[styles.productTitle, { color: colors.text }]}>
                    {item.targetFound
                      ? `${item.targetName ?? '—'} (#${item.targetProductId})`
                      : `#${item.targetProductId}`}
                  </Text>
                  {item.targetFound ? (
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      {[item.targetProdusent, item.targetBarcode]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  ) : null}
                </View>
              </View>

              {item.comment?.trim() ? (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('admin.mergeComment')}
                  </Text>
                  <Text style={[styles.reportComment, { color: colors.text }]}>
                    {item.comment.trim()}
                  </Text>
                </>
              ) : null}

              {!item.sourceFound || !item.targetFound ? (
                <ErrorText style={styles.error}>
                  {t('admin.mergeProductMissing')}
                </ErrorText>
              ) : null}

              <View style={[styles.actions, isWide && styles.actionsWide]}>
                <Pressable
                  style={[
                    styles.actionBtn,
                    styles.denyBtn,
                    { borderColor: colors.danger },
                    busy && styles.actionDisabled,
                  ]}
                  disabled={busyId !== null}
                  onPress={() => void handleDismissMerge(item.id)}
                >
                  <Text style={[styles.denyText, { color: colors.danger }]}>
                    {busy ? t('common.saving') : t('admin.dismiss')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.actionBtn,
                    { backgroundColor: colors.primary },
                    busy && styles.actionDisabled,
                  ]}
                  disabled={busyId !== null || !item.sourceFound || !item.targetFound}
                  onPress={() => void handleAcceptMerge(item.id)}
                >
                  <Text style={[styles.approveText, { color: colors.onPrimary }]}>
                    {busy ? t('common.saving') : t('admin.mergeAccept')}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      {!loading && tab !== 'notifications' && totalCount > 0 && (
        <View style={styles.pager}>
          <Pressable
            style={[
              styles.pageBtn,
              { borderColor: colors.border },
              page <= 1 && styles.actionDisabled,
            ]}
            disabled={page <= 1 || busyId !== null}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            <Text style={{ color: colors.text }}>{t('admin.prev')}</Text>
          </Pressable>
          <Text style={[styles.pageLabel, { color: colors.textSecondary }]}>
            {tf('admin.pageOf', { page, total: totalPages })}
          </Text>
          <Pressable
            style={[
              styles.pageBtn,
              { borderColor: colors.border },
              page >= totalPages && styles.actionDisabled,
            ]}
            disabled={page >= totalPages || busyId !== null}
            onPress={() => setPage((p) => p + 1)}
          >
            <Text style={{ color: colors.text }}>{t('admin.next')}</Text>
          </Pressable>
        </View>
      )}

      <Modal
        visible={previewUri != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUri(null)}
      >
        <Pressable
          style={styles.previewBackdrop}
          onPress={() => setPreviewUri(null)}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 48 },
  tabsScroll: {
    marginBottom: 16,
    flexGrow: 0,
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 4,
  },
  tabsWide: {
    width: '100%',
  },
  tab: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  tabWide: {
    flex: 1,
    minWidth: 0,
  },
  tabText: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 6 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  error: { marginBottom: 12 },
  success: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 10,
  },
  audienceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  audienceChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  loader: { marginTop: 32 },
  empty: { fontSize: 15, lineHeight: 22, marginTop: 12 },
  slot: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },
  slotBody: {
    flexDirection: 'column',
    gap: 14,
  },
  slotBodyWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  photoWrap: {
    width: '100%',
  },
  photoWrapWide: {
    width: 280,
    flexShrink: 0,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    backgroundColor: '#F5F6F8',
  },
  photoWide: {
    height: 280,
  },
  formCol: {
    flex: 1,
    minWidth: 0,
  },
  fieldsRow: {
    flexDirection: 'column',
  },
  fieldsRowWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  field: {
    width: '100%',
  },
  fieldHalf: {
    width: '31%',
    flexGrow: 1,
    minWidth: 180,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  productTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  reportComment: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 10,
  },
  meta: { fontSize: 13, lineHeight: 18, marginBottom: 2 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  allergenGroupLabel: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  allergenWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  allergenChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  allergenChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  multiline: {
    minHeight: 100,
  },
  ratingRow: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 4,
  },
  ratingRowWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ratingOption: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ratingOptionWide: {
    flex: 1,
    minWidth: 160,
  },
  ratingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  ratingLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mergeCompare: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 8,
  },
  mergeCompareWide: {
    flexDirection: 'row',
  },
  mergePane: {
    flex: 1,
  },
  mergePaneWide: {
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.25)',
    borderRadius: 10,
    padding: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionsWide: {
    maxWidth: 420,
    alignSelf: 'flex-end',
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  denyBtn: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  denyText: { fontWeight: '700', fontSize: 14 },
  approveText: { fontWeight: '700', fontSize: 14 },
  actionDisabled: { opacity: 0.45 },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  pageBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pageLabel: { fontSize: 13, fontWeight: '600' },
});
