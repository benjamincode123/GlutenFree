import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { getAuthToken } from '../auth/session';
import type { ProductCountry } from '../country/productCountries';
import type { FavoriteProductRef } from '../data/authApi';
import * as adminApi from '../data/adminApi';
import { getProductRepository } from '../data/repository';
import type { Product, ProductCatalog } from '../db/types';
import { userFacingError } from '../errors/userFacingError';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';
import { AppTextInput } from './KeyboardDismissBar';
import { ErrorText } from './ErrorText';

const SHEET_SLIDE = Math.round(Dimensions.get('window').height * 0.55);

function catalogToCountry(catalog: ProductCatalog): ProductCountry {
  switch (catalog) {
    case 'products_se':
      return 'se';
    case 'products_dk':
      return 'dk';
    case 'products_de':
      return 'de';
    default:
      return 'no';
  }
}

interface SuggestMergeModalProps {
  visible: boolean;
  product: FavoriteProductRef | null;
  productName?: string;
  onClose: () => void;
  onSuggested?: () => void;
  onMerged?: () => void;
}

export function SuggestMergeModal({
  visible,
  product,
  productName,
  onClose,
  onSuggested,
  onMerged,
}: SuggestMergeModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState('');
  const [comment, setComment] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [modalVisible, setModalVisible] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_SLIDE)).current;
  const signedIn = !!getAuthToken();

  useEffect(() => {
    if (visible) {
      setQuery('');
      setComment('');
      setResults([]);
      setSelected(null);
      setError(null);
      setSubmitting(false);
      setModalVisible(true);
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(SHEET_SLIDE);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SHEET_SLIDE,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setModalVisible(false);
    });
  }, [visible, backdropOpacity, sheetTranslateY]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible || !product) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const page = await getProductRepository().searchByName(trimmed, 20, {
            countries: [catalogToCountry(product.catalog as ProductCatalog)],
          });
          if (cancelled) return;
          setResults(
            page.items.filter(
              (p) =>
                p.catalog === product.catalog &&
                p.id > 0 &&
                p.id !== product.id
            )
          );
        } catch {
          if (!cancelled) setResults([]);
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, product, visible]);

  async function submit(mode: 'suggest' | 'merge') {
    setError(null);
    if (!product || !selected) {
      setError(t('result.mergePickTarget'));
      return;
    }
    if (!signedIn) {
      setError(t('result.signInToMerge'));
      return;
    }
    setSubmitting(true);
    try {
      const token = getAuthToken();
      if (mode === 'merge') {
        if (!token || !isAdmin) {
          setError(t('result.mergeAdminOnly'));
          return;
        }
        await adminApi.mergeProducts(token, {
          catalog: product.catalog,
          sourceProductId: product.id,
          targetProductId: selected.id,
        });
        onMerged?.();
        onClose();
        return;
      }
      await getProductRepository().suggestMerge(
        product.catalog as ProductCatalog,
        product.id,
        selected.id,
        comment
      );
      onSuggested?.();
      onClose();
    } catch (err) {
      setError(userFacingError(err, t, 'report_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              transform: [{ translateY: sheetTranslateY }],
              marginBottom: keyboardHeight > 0 ? keyboardHeight - 12 : 0,
            },
          ]}
        >
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {isAdmin ? t('result.mergeTitleAdmin') : t('result.mergeTitle')}
          </Text>
          {productName ? (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t('result.mergeSourceHint')}: {productName}
            </Text>
          ) : null}
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {t('result.mergeTargetHint')}
          </Text>

          {!signedIn ? (
            <ErrorText>{t('result.signInToMerge')}</ErrorText>
          ) : (
            <>
              <AppTextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={query}
                onChangeText={(v) => {
                  setQuery(v);
                  setSelected(null);
                }}
                placeholder={t('result.mergeSearchPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                autoCorrect={false}
              />
              {searching ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
              ) : null}
              <FlatList
                data={results}
                keyExtractor={(item) => `${item.catalog}-${item.id}`}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  query.trim().length >= 2 && !searching ? (
                    <Text style={{ color: colors.textSecondary, paddingVertical: 8 }}>
                      {t('result.mergeNoResults')}
                    </Text>
                  ) : null
                }
                renderItem={({ item }) => {
                  const active = selected?.id === item.id;
                  return (
                    <Pressable
                      style={[
                        styles.resultRow,
                        {
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active
                            ? colors.primaryMuted
                            : colors.background,
                        },
                      ]}
                      onPress={() => setSelected(item)}
                    >
                      <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                        #{item.id}
                        {item.produsent?.trim() ? ` · ${item.produsent.trim()}` : ''}
                        {item.barcode && item.barcode !== 'unknown'
                          ? ` · ${item.barcode}`
                          : ''}
                      </Text>
                    </Pressable>
                  );
                }}
              />
              <AppTextInput
                style={[
                  styles.input,
                  styles.comment,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={comment}
                onChangeText={setComment}
                placeholder={t('result.mergeCommentPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                multiline
              />
              {error ? <ErrorText>{error}</ErrorText> : null}
              <View style={styles.actions}>
                <Pressable
                  style={[styles.btn, { borderColor: colors.border }]}
                  onPress={onClose}
                  disabled={submitting}
                >
                  <Text style={{ color: colors.text }}>{t('common.cancel')}</Text>
                </Pressable>
                {isAdmin ? (
                  <Pressable
                    style={[
                      styles.btn,
                      styles.btnPrimary,
                      { backgroundColor: colors.primary },
                      (!selected || submitting) && styles.disabled,
                    ]}
                    disabled={!selected || submitting}
                    onPress={() => void submit('merge')}
                  >
                    {submitting ? (
                      <ActivityIndicator color={colors.onPrimary} />
                    ) : (
                      <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>
                        {t('result.mergeNow')}
                      </Text>
                    )}
                  </Pressable>
                ) : null}
                <Pressable
                  style={[
                    styles.btn,
                    styles.btnPrimary,
                    { backgroundColor: isAdmin ? colors.surface : colors.primary },
                    {
                      borderColor: colors.primary,
                      borderWidth: isAdmin ? 1.5 : 0,
                    },
                    (!selected || submitting) && styles.disabled,
                  ]}
                  disabled={!selected || submitting}
                  onPress={() => void submit('suggest')}
                >
                  {submitting && !isAdmin ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text
                      style={{
                        color: isAdmin ? colors.primary : colors.onPrimary,
                        fontWeight: '600',
                      }}
                    >
                      {t('result.mergeSuggest')}
                    </Text>
                  )}
                </Pressable>
              </View>
              {!isAdmin ? (
                <Text style={[styles.xpHint, { color: colors.textSecondary }]}>
                  {t('result.mergeXpHint')}
                </Text>
              ) : null}
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
    maxHeight: '88%',
  },
  handleRow: { alignItems: 'center', paddingVertical: 8 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  hint: { fontSize: 13, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  comment: { minHeight: 64, textAlignVertical: 'top' },
  list: { maxHeight: 180, marginBottom: 8 },
  resultRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  resultName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  btn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { flexGrow: 1 },
  disabled: { opacity: 0.5 },
  xpHint: { fontSize: 12, marginTop: 10 },
});
