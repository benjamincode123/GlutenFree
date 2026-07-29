import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../src/auth/AuthContext';
import { getAuthToken } from '../src/auth/session';
import { AppTextInput } from '../src/components/KeyboardDismissBar';
import { ErrorText } from '../src/components/ErrorText';
import * as adminApi from '../src/data/adminApi';
import type {
  ApproveSubmissionEdits,
  ProductImageValidationItem,
  ProductSubmissionItem,
  WrongInfoReportItem,
} from '../src/data/adminApi';
import { getProductRepository } from '../src/data/repository';
import {
  ALL_GLUTEN_RATINGS,
  getGlutenRatingMeta,
  GlutenRating,
  isGlutenRating,
  ProductCatalog,
} from '../src/db/types';
import { userFacingError } from '../src/errors/userFacingError';
import { useI18n } from '../src/i18n/I18nContext';
import type { TranslationKey } from '../src/i18n/translations';
import { useTheme } from '../src/theme/ThemeContext';

type AdminTab = 'products' | 'images' | 'wrongInfo';

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale === 'nb' ? 'nb-NO' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ratingLabelKey(rating: GlutenRating): TranslationKey {
  switch (rating) {
    case GlutenRating.GlutenFree:
      return 'rating.glutenFree';
    case GlutenRating.GlutenTrace:
      return 'rating.glutenTrace';
    default:
      return 'rating.glutenContent';
  }
}

function draftFromItem(item: ProductSubmissionItem): ApproveSubmissionEdits {
  return {
    barcode: item.barcode,
    name: item.name,
    produsent: item.produsent ?? '',
    ingredients: item.ingredients ?? '',
    glutenRating: isGlutenRating(item.glutenRating)
      ? item.glutenRating
      : GlutenRating.GlutenFree,
  };
}

function draftFromWrongInfo(item: WrongInfoReportItem): ApproveSubmissionEdits {
  return {
    barcode: item.productBarcode ?? '',
    name: item.productName ?? '',
    produsent: item.productProdusent ?? '',
    ingredients: item.productIngredients ?? '',
    glutenRating: isGlutenRating(item.productGlutenRating)
      ? item.productGlutenRating
      : item.catalog === 'gluten'
        ? GlutenRating.GlutenContent
        : GlutenRating.GlutenFree,
  };
}

function parseCatalog(value: string): ProductCatalog | null {
  if (value === 'products' || value === 'glutenfri' || value === 'gluten') return value;
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
  const navigation = useNavigation();
  const router = useRouter();
  const { isAdmin, authEnabled } = useAuth();
  const { colors } = useTheme();
  const { t, tf, locale } = useI18n();

  const [tab, setTab] = useState<AdminTab>('products');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ProductSubmissionItem[]>([]);
  const [imageItems, setImageItems] = useState<ProductImageValidationItem[]>([]);
  const [wrongInfoItems, setWrongInfoItems] = useState<WrongInfoReportItem[]>([]);
  const [drafts, setDrafts] = useState<Record<number, ApproveSubmissionEdits>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('nav.admin') });
  }, [navigation, t]);

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
            }
          } else if (tab === 'images') {
            const result = await adminApi.fetchPendingImageValidations(token, page);
            if (!cancelled) {
              applyImageList(result);
              setItems([]);
              setWrongInfoItems([]);
              setDrafts({});
            }
          } else {
            const result = await adminApi.fetchPendingWrongInfoReports(token, page);
            if (!cancelled) {
              applyWrongInfoList(result);
              setItems([]);
              setImageItems([]);
            }
          }
        } catch (err) {
          if (!cancelled) {
            setError(userFacingError(err, t, 'forbidden'));
            setItems([]);
            setImageItems([]);
            setWrongInfoItems([]);
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
    ])
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const switchTab = (next: AdminTab) => {
    if (next === tab) return;
    setTab(next);
    setPage(1);
    setError(null);
    setBusyId(null);
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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.tabs}>
        <Pressable
          style={[
            styles.tab,
            {
              borderColor: tab === 'products' ? colors.primary : colors.border,
              backgroundColor:
                tab === 'products' ? colors.primaryMuted : colors.background,
            },
          ]}
          onPress={() => switchTab('products')}
        >
          <Text
            style={[
              styles.tabText,
              { color: tab === 'products' ? colors.primary : colors.text },
            ]}
          >
            {t('admin.tabProducts')}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            {
              borderColor: tab === 'images' ? colors.primary : colors.border,
              backgroundColor:
                tab === 'images' ? colors.primaryMuted : colors.background,
            },
          ]}
          onPress={() => switchTab('images')}
        >
          <Text
            style={[
              styles.tabText,
              { color: tab === 'images' ? colors.primary : colors.text },
            ]}
          >
            {t('admin.tabImages')}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            {
              borderColor: tab === 'wrongInfo' ? colors.primary : colors.border,
              backgroundColor:
                tab === 'wrongInfo' ? colors.primaryMuted : colors.background,
            },
          ]}
          onPress={() => switchTab('wrongInfo')}
        >
          <Text
            style={[
              styles.tabText,
              { color: tab === 'wrongInfo' ? colors.primary : colors.text },
            ]}
          >
            {t('admin.tabWrongInfo')}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {tab === 'products'
          ? t('admin.subtitle')
          : tab === 'images'
            ? t('admin.imagesSubtitle')
            : t('admin.wrongInfoSubtitle')}
      </Text>
      {tab === 'products' || tab === 'wrongInfo' ? (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {tab === 'products' ? t('admin.editHint') : t('admin.wrongInfoEditHint')}
        </Text>
      ) : null}

      {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
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
                {item.imageUrl?.trim() ? (
                  <Pressable
                    onPress={() => setPreviewUri(imageUri(item.imageUrl))}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={t('admin.viewImage')}
                  >
                    <Image
                      source={{ uri: imageUri(item.imageUrl) }}
                      style={styles.photo}
                      resizeMode="contain"
                    />
                  </Pressable>
                ) : null}

                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {t('admin.submittedBy')}:{' '}
                  {item.submittedByUsername ?? `#${item.submittedByUserId}`}
                </Text>
                <Text
                  style={[styles.meta, { color: colors.textSecondary, marginBottom: 10 }]}
                >
                  {t('admin.submittedAt')}: {formatDate(item.createdAt, locale)}
                </Text>

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
                  onChangeText={(produsent) => updateDraft(item.id, { produsent })}
                  editable={busyId === null}
                />

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
                  onChangeText={(barcode) => updateDraft(item.id, { barcode })}
                  editable={busyId === null}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

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

                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('admin.glutenRating')}
                </Text>
                {ALL_GLUTEN_RATINGS.map((option) => {
                  const meta = getGlutenRatingMeta(option);
                  const selected = draft.glutenRating === option;
                  return (
                    <Pressable
                      key={option}
                      style={[
                        styles.ratingOption,
                        {
                          borderColor: selected ? meta.color : colors.border,
                          backgroundColor: selected
                            ? meta.backgroundColor
                            : colors.background,
                        },
                      ]}
                      disabled={busyId !== null}
                      onPress={() =>
                        updateDraft(item.id, { glutenRating: option })
                      }
                    >
                      <View
                        style={[styles.ratingDot, { backgroundColor: meta.color }]}
                      />
                      <Text style={[styles.ratingLabel, { color: meta.color }]}>
                        {t(ratingLabelKey(option))}
                      </Text>
                      <View
                        style={[
                          styles.radioOuter,
                          { borderColor: selected ? meta.color : colors.border },
                        ]}
                      >
                        {selected ? (
                          <View
                            style={[
                              styles.radioInner,
                              { backgroundColor: meta.color },
                            ]}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}

                <View style={styles.actions}>
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
                    <Text style={[styles.approveText, { color: colors.onPrimary }]}>
                      {busy ? t('common.saving') : t('admin.approve')}
                    </Text>
                  </Pressable>
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
              {item.imageUrl?.trim() ? (
                <Pressable
                  onPress={() => setPreviewUri(imageUri(item.imageUrl))}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={t('admin.viewImage')}
                >
                  <Image
                    source={{ uri: imageUri(item.imageUrl) }}
                    style={styles.photo}
                    resizeMode="contain"
                  />
                </Pressable>
              ) : null}

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
                style={[styles.meta, { color: colors.textSecondary, marginBottom: 10 }]}
              >
                {t('admin.submittedAt')}: {formatDate(item.createdAt, locale)}
              </Text>

              <View style={styles.actions}>
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
                  <Text style={[styles.approveText, { color: colors.onPrimary }]}>
                    {busy ? t('common.saving') : t('admin.approve')}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )
      ) : wrongInfoItems.length === 0 ? (
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
                    onChangeText={(produsent) => updateDraft(item.id, { produsent })}
                    editable={busyId === null}
                  />

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
                    onChangeText={(barcode) => updateDraft(item.id, { barcode })}
                    editable={busyId === null}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

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

                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('admin.glutenRating')}
                  </Text>
                  {ALL_GLUTEN_RATINGS.map((option) => {
                    const meta = getGlutenRatingMeta(option);
                    const selected = draft.glutenRating === option;
                    return (
                      <Pressable
                        key={option}
                        style={[
                          styles.ratingOption,
                          {
                            borderColor: selected ? meta.color : colors.border,
                            backgroundColor: selected
                              ? meta.backgroundColor
                              : colors.background,
                          },
                        ]}
                        disabled={busyId !== null}
                        onPress={() =>
                          updateDraft(item.id, { glutenRating: option })
                        }
                      >
                        <View
                          style={[styles.ratingDot, { backgroundColor: meta.color }]}
                        />
                        <Text style={[styles.ratingLabel, { color: meta.color }]}>
                          {t(ratingLabelKey(option))}
                        </Text>
                        <View
                          style={[
                            styles.radioOuter,
                            { borderColor: selected ? meta.color : colors.border },
                          ]}
                        >
                          {selected ? (
                            <View
                              style={[
                                styles.radioInner,
                                { backgroundColor: meta.color },
                              ]}
                            />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </>
              )}

              <View style={styles.actions}>
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
      )}

      {!loading && totalCount > 0 && (
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
  content: { padding: 20, paddingBottom: 40 },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: { fontSize: 14, fontWeight: '700' },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  error: { marginBottom: 12 },
  loader: { marginTop: 32 },
  empty: { fontSize: 15, lineHeight: 22, marginTop: 12 },
  slot: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#F5F6F8',
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
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  multiline: {
    minHeight: 88,
  },
  ratingOption: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
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
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
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
