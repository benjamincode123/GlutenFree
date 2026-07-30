import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../src/auth/AuthContext';
import { findAllergenWarnings } from '../src/allergens/allergenPrefs';
import { useAllergenPrefs } from '../src/allergens/AllergenPrefsContext';
import { BarcodeCaptureModal } from '../src/components/BarcodeCaptureModal';
import { AddToListModal } from '../src/components/AddToListModal';
import { ErrorText } from '../src/components/ErrorText';
import { AllergenBadge } from '../src/components/AllergenBadge';
import { AppTextInput } from '../src/components/KeyboardDismissBar';
import { ReportWrongInfoModal } from '../src/components/ReportWrongInfoModal';
import { getProductRepository } from '../src/data/repository';
import { useCountryPrefs } from '../src/country/CountryPrefsContext';
import { useI18n } from '../src/i18n/I18nContext';
import {
  isUnknownBarcode,
  Product,
  ProductCatalog,
} from '../src/db/types';
import { askPickProductImage } from '../src/media/pickProductImage';
import { userFacingError } from '../src/errors/userFacingError';
import { useTheme } from '../src/theme/ThemeContext';

type LoadState = 'loading' | 'found' | 'not_found' | 'error';

function parseCatalog(value: string | undefined): ProductCatalog | null {
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

/** Favorites / reports / photo / wrong-info work on NO/SE/DK/DE catalogs. */
function isWritableCatalog(catalog: ProductCatalog | undefined): boolean {
  return (
    catalog === 'products' ||
    catalog === 'products_se' ||
    catalog === 'products_dk' ||
    catalog === 'products_de'
  );
}

function productImageUri(imageUrl: string | null | undefined): string | null {
  const raw = (imageUrl ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:image/')) return raw;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

export default function ResultScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user, isAdmin, addFavorite, removeFavorite } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { selected: warnAllergens } = useAllergenPrefs();
  const { countries } = useCountryPrefs();
  const params = useLocalSearchParams<{
    barcode?: string;
    id?: string;
    catalog?: string;
  }>();
  const barcode = (params.barcode ?? '').toString();
  const catalogParam = parseCatalog((params.catalog ?? '').toString());
  const idParam = Number.parseInt((params.id ?? '').toString(), 10);

  const [state, setState] = useState<LoadState>('loading');
  const [product, setProduct] = useState<Product | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reportBarcode, setReportBarcode] = useState('');
  const [reportImageBase64, setReportImageBase64] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const [wrongInfoOpen, setWrongInfoOpen] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('nav.result') });
  }, [navigation, t]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        setState('loading');
        setReportFeedback(null);
        try {
          const repo = getProductRepository();
          let found: Product | null = null;
          if (catalogParam && Number.isFinite(idParam) && idParam > 0) {
            found = await repo.getById(catalogParam, idParam);
          } else if (barcode) {
            found = await repo.getByBarcode(barcode, { countries });
          }

          if (cancelled) return;
          if (found) {
            setProduct(found);
            setState('found');
          } else {
            setProduct(null);
            setState('not_found');
          }
        } catch (err) {
          if (cancelled) return;
          setErrorMessage(userFacingError(err, t, 'lookup_failed'));
          setState('error');
        }
      }

      void load();
      return () => {
        cancelled = true;
      };
    }, [barcode, catalogParam, idParam, countries, t])
  );

  const submitBarcodeReport = async () => {
    if (!product?.catalog) return;
    const suggested = reportBarcode.trim();
    if (!suggested) return;

    setReporting(true);
    setReportFeedback(null);
    try {
      const updated = await getProductRepository().reportBarcode(
        product.catalog,
        product.id,
        suggested,
        productImageUri(product.imageUrl) && !isAdmin ? null : reportImageBase64
      );
      setProduct(updated);
      setReportBarcode('');
      setReportImageBase64(null);
      setReportFeedback({
        kind: 'success',
        text: updated.pending ? t('result.reportPending') : t('result.reportSaved'),
      });
    } catch (err) {
      setReportFeedback({
        kind: 'error',
        text: userFacingError(err, t, 'report_failed'),
      });
    } finally {
      setReporting(false);
    }
  };

  const submitProductPhoto = async () => {
    if (!product?.catalog || !reportImageBase64) return;

    setReporting(true);
    setReportFeedback(null);
    try {
      const result = await getProductRepository().submitProductImage(
        product.catalog,
        product.id,
        reportImageBase64
      );
      if (result.product) {
        setProduct(result.product);
      }
      setReportImageBase64(null);
      setReportFeedback({
        kind: 'success',
        text: result.pending ? t('result.photoPending') : t('result.photoSaved'),
      });
    } catch (err) {
      setReportFeedback({
        kind: 'error',
        text: userFacingError(err, t, 'generic'),
      });
    } finally {
      setReporting(false);
    }
  };

  const showReportForm =
    state === 'found' &&
    product &&
    isUnknownBarcode(product.barcode) &&
    !!product.catalog;

  const showPhotoSubmit =
    state === 'found' &&
    product &&
    !!product.catalog &&
    !isUnknownBarcode(product.barcode) &&
    (!productImageUri(product.imageUrl) || isAdmin);

  const canFavorite =
    !!user &&
    !!product?.catalog &&
    product.id > 0 &&
    isWritableCatalog(product.catalog);

  const canReportWrongInfo =
    state === 'found' &&
    !!product?.catalog &&
    product.id > 0 &&
    isWritableCatalog(product.catalog);

  const allergenWarnings = findAllergenWarnings(warnAllergens, product?.allergens);

  const isFavorite =
    canFavorite &&
    (user?.favorites ?? []).some(
      (f) => f.catalog === product!.catalog && f.id === product!.id
    );

  async function handleToggleFavorite() {
    if (!canFavorite || !product?.catalog) return;
    const ref = { catalog: product.catalog, id: product.id };
    try {
      if (isFavorite) {
        await removeFavorite(ref);
      } else {
        await addFavorite(ref);
      }
    } catch (err) {
      setReportFeedback({
        kind: 'error',
        text: userFacingError(err, t, 'generic'),
      });
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surface }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.barcodeCard}>
        <Text style={styles.barcodeLabel}>
          {isUnknownBarcode(product?.barcode ?? barcode)
            ? t('result.barcode')
            : t('result.scannedBarcode')}
        </Text>
        <Text style={styles.barcodeValue}>
          {(product?.barcode || barcode || '—').toString()}
        </Text>
      </View>

      {state === 'loading' && (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
            {t('result.lookingUp')}
          </Text>
        </View>
      )}

      {state === 'error' && (
        <View style={styles.centerBlock}>
          <ErrorText style={styles.errorTitle}>{t('result.errorTitle')}</ErrorText>
          <ErrorText style={styles.mutedText}>{errorMessage}</ErrorText>
        </View>
      )}

      {state === 'found' && product && (
        <View style={[styles.productCard, { backgroundColor: colors.background }]}>
          {!!productImageUri(product.imageUrl) && (
            <Image
              source={{ uri: productImageUri(product.imageUrl)! }}
              style={[styles.productImage, { backgroundColor: colors.surface }]}
              resizeMode="contain"
              accessibilityLabel={`${product.name} ${t('result.productImageA11y')}`}
            />
          )}
          {product.produsent?.trim() ? (
            <Text style={[styles.produsent, { color: colors.textSecondary }]}>
              {product.produsent.trim()}
            </Text>
          ) : null}
          <Text style={[styles.productName, { color: colors.text }]}>
            {product.name}
          </Text>
          {product.productionCountry?.trim() ? (
            <Text style={[styles.country, { color: colors.textSecondary }]}>
              {t('result.country')}: {product.productionCountry.trim()}
            </Text>
          ) : null}

          <View style={styles.statusBlock}>
            {canReportWrongInfo ? (
              <Pressable
                style={styles.wrongInfoButton}
                onPress={() => setWrongInfoOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t('result.reportWrongInfo')}
                hitSlop={8}
              >
                <MaterialCommunityIcons
                  name="bullhorn-outline"
                  size={28}
                  color={colors.textSecondary}
                />
              </Pressable>
            ) : null}
            {allergenWarnings.length > 0 ? (
              <View style={styles.badgeWrap}>
                {allergenWarnings.map((hit) => (
                  <AllergenBadge
                    key={`${hit.kind}-${hit.selected}`}
                    name={hit.selected}
                    kind={hit.kind}
                    size="large"
                  />
                ))}
              </View>
            ) : null}
          </View>

          {canFavorite ? (
            <>
              <Pressable
                style={[
                  styles.favoriteButton,
                  {
                    borderColor: colors.primary,
                    backgroundColor: colors.background,
                  },
                ]}
                onPress={() => setListPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t('lists.addToList')}
              >
                <MaterialCommunityIcons
                  name="playlist-plus"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[styles.favoriteButtonText, { color: colors.primary }]}>
                  {t('lists.addToList')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.favoriteButton,
                  {
                    borderColor: colors.primary,
                    backgroundColor: isFavorite ? colors.primaryMuted : colors.background,
                  },
                ]}
                onPress={() => void handleToggleFavorite()}
                accessibilityRole="button"
                accessibilityLabel={
                  isFavorite ? t('result.removeFavorite') : t('result.addFavorite')
                }
              >
                <MaterialCommunityIcons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={20}
                  color={colors.primary}
                />
                <Text style={[styles.favoriteButtonText, { color: colors.primary }]}>
                  {isFavorite ? t('result.removeFavorite') : t('result.addFavorite')}
                </Text>
              </Pressable>
            </>
          ) : null}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {t('result.ingredients')}
          </Text>
          <Text style={[styles.ingredients, { color: colors.text }]}>
            {product.ingredients?.trim()
              ? product.ingredients
              : t('result.noIngredients')}
          </Text>

          {showReportForm && (
            <View style={[styles.reportBlock, { borderTopColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                {t('result.reportBarcode')}
              </Text>
              <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                {t('result.reportHint')}
              </Text>
              {!user ? (
                <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                  {t('result.signInToReport')}
                </Text>
              ) : (
                <>
                  <View style={styles.barcodeInputRow}>
                    <AppTextInput
                      style={[
                        styles.input,
                        styles.barcodeInput,
                        { borderColor: colors.border, color: colors.text },
                      ]}
                      placeholder={t('result.enterBarcode')}
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="number-pad"
                      value={reportBarcode}
                      onChangeText={setReportBarcode}
                      editable={!reporting}
                    />
                    <Pressable
                      style={[
                        styles.scanTrigger,
                        {
                          borderColor: colors.primary,
                          backgroundColor: colors.background,
                        },
                        reporting && styles.scanTriggerDisabled,
                      ]}
                      disabled={reporting}
                      onPress={() => setScanModalVisible(true)}
                      accessibilityRole="button"
                      accessibilityLabel={t('result.scanBarcode')}
                    >
                      <MaterialCommunityIcons
                        name="barcode-scan"
                        size={24}
                        color={colors.primary}
                      />
                      <Text style={[styles.scanTriggerText, { color: colors.primary }]}>
                        {t('result.scanBarcode')}
                      </Text>
                    </Pressable>
                  </View>

                  <BarcodeCaptureModal
                    visible={scanModalVisible}
                    onClose={() => setScanModalVisible(false)}
                    onCaptured={(code) => {
                      setReportBarcode(code);
                      setReportFeedback(null);
                    }}
                  />

                  <Text
                    style={[
                      styles.sectionLabel,
                      { marginTop: 16, color: colors.textSecondary },
                    ]}
                  >
                    {t('result.photoOptional')}
                  </Text>
                  {productImageUri(product.imageUrl) && !isAdmin ? (
                    <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                      {t('result.photoLocked')}
                    </Text>
                  ) : (
                    <>
                      {reportImageBase64 ? (
                        <Image
                          source={{ uri: reportImageBase64 }}
                          style={[styles.reportPhoto, { backgroundColor: colors.surface }]}
                          resizeMode="contain"
                        />
                      ) : null}
                      <View style={styles.reportPhotoRow}>
                        <Pressable
                          style={[styles.photoButton, { borderColor: colors.primary }]}
                          onPress={() => {
                            void askPickProductImage().then((uri) => {
                              if (uri) setReportImageBase64(uri);
                            });
                          }}
                        >
                          <Text style={[styles.photoButtonText, { color: colors.primary }]}>
                            {reportImageBase64
                              ? t('result.changePhoto')
                              : t('result.addPhoto')}
                          </Text>
                        </Pressable>
                        {reportImageBase64 && (
                          <Pressable
                            style={styles.clearPhotoButton}
                            onPress={() => setReportImageBase64(null)}
                          >
                            <Text style={[styles.clearPhotoText, { color: colors.danger }]}>
                              {t('result.removePhoto')}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </>
                  )}

                  <Pressable
                    style={[
                      styles.primaryButton,
                      { backgroundColor: colors.primary },
                      (!reportBarcode.trim() || reporting) && {
                        backgroundColor: colors.primaryMuted,
                      },
                    ]}
                    disabled={!reportBarcode.trim() || reporting}
                    onPress={() => void submitBarcodeReport()}
                  >
                    <Text style={styles.primaryButtonText}>
                      {reporting ? t('common.saving') : t('result.submitBarcode')}
                    </Text>
                  </Pressable>
                </>
              )}
              {reportFeedback &&
                (reportFeedback.kind === 'error' ? (
                  <ErrorText style={styles.reportMessage}>{reportFeedback.text}</ErrorText>
                ) : (
                  <Text style={[styles.reportMessage, { color: colors.primary }]}>
                    {reportFeedback.text}
                  </Text>
                ))}
            </View>
          )}

          {showPhotoSubmit && (
            <View style={[styles.reportBlock, { borderTopColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                {t('result.photoOptional')}
              </Text>
              <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                {t('result.addPhotoHint')}
              </Text>
              {!user ? (
                <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                  {t('result.signInToAddPhoto')}
                </Text>
              ) : (
                <>
                  {reportImageBase64 ? (
                    <Image
                      source={{ uri: reportImageBase64 }}
                      style={[styles.reportPhoto, { backgroundColor: colors.surface }]}
                      resizeMode="contain"
                    />
                  ) : null}
                  <View style={styles.reportPhotoRow}>
                    <Pressable
                      style={[styles.photoButton, { borderColor: colors.primary }]}
                      onPress={() => {
                        void askPickProductImage().then((uri) => {
                          if (uri) setReportImageBase64(uri);
                        });
                      }}
                    >
                      <Text style={[styles.photoButtonText, { color: colors.primary }]}>
                        {reportImageBase64
                          ? t('result.changePhoto')
                          : t('result.addPhoto')}
                      </Text>
                    </Pressable>
                    {reportImageBase64 && (
                      <Pressable
                        style={styles.clearPhotoButton}
                        onPress={() => setReportImageBase64(null)}
                      >
                        <Text style={[styles.clearPhotoText, { color: colors.danger }]}>
                          {t('result.removePhoto')}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <Pressable
                    style={[
                      styles.primaryButton,
                      { backgroundColor: colors.primary },
                      (!reportImageBase64 || reporting) && {
                        backgroundColor: colors.primaryMuted,
                      },
                    ]}
                    disabled={!reportImageBase64 || reporting}
                    onPress={() => void submitProductPhoto()}
                  >
                    <Text style={styles.primaryButtonText}>
                      {reporting ? t('common.saving') : t('result.submitPhoto')}
                    </Text>
                  </Pressable>
                </>
              )}
              {reportFeedback &&
                !showReportForm &&
                (reportFeedback.kind === 'error' ? (
                  <ErrorText style={styles.reportMessage}>{reportFeedback.text}</ErrorText>
                ) : (
                  <Text style={[styles.reportMessage, { color: colors.primary }]}>
                    {reportFeedback.text}
                  </Text>
                ))}
            </View>
          )}

          {isAdmin && !isUnknownBarcode(product.barcode) && (
            <Pressable
              style={[styles.secondaryButton, { borderColor: colors.primary }]}
              onPress={() =>
                router.push({
                  pathname: '/add',
                  params: {
                    barcode: product.barcode,
                    id: String(product.id),
                    catalog: product.catalog ?? '',
                  },
                })
              }
            >
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                {t('result.editProduct')}
              </Text>
            </Pressable>
          )}

          {reportFeedback && !showReportForm && !showPhotoSubmit ? (
            reportFeedback.kind === 'error' ? (
              <ErrorText style={styles.reportMessage}>{reportFeedback.text}</ErrorText>
            ) : (
              <Text style={[styles.reportMessage, { color: colors.primary }]}>
                {reportFeedback.text}
              </Text>
            )
          ) : null}
        </View>
      )}

      {state === 'not_found' && (
        <View style={[styles.productCard, { backgroundColor: colors.background }]}>
          <Text style={[styles.notFoundTitle, { color: colors.text }]}>
            {t('result.notFound')}
          </Text>
          <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
            {user
              ? isAdmin
                ? t('result.notFoundAdmin')
                : t('result.notFoundUser')
              : t('result.notFoundGuest')}
          </Text>
          {user && (
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() =>
                router.push({ pathname: '/add', params: { barcode } })
              }
            >
              <Text style={styles.primaryButtonText}>{t('result.addOrLink')}</Text>
            </Pressable>
          )}
        </View>
      )}

      <Pressable style={styles.scanAgainButton} onPress={() => router.back()}>
        <Text style={[styles.scanAgainText, { color: colors.textSecondary }]}>
          {t('common.back')}
        </Text>
      </Pressable>

      <AddToListModal
        visible={listPickerOpen}
        product={
          isWritableCatalog(product?.catalog)
            ? { catalog: product!.catalog!, id: product!.id }
            : null
        }
        onClose={() => setListPickerOpen(false)}
      />
      <ReportWrongInfoModal
        visible={wrongInfoOpen}
        product={
          isWritableCatalog(product?.catalog)
            ? { catalog: product!.catalog!, id: product!.id }
            : null
        }
        productName={product?.name}
        onClose={() => setWrongInfoOpen(false)}
        onSubmitted={() =>
          setReportFeedback({
            kind: 'success',
            text: t('result.wrongInfoSent'),
          })
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  barcodeCard: {
    backgroundColor: '#181B20',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  barcodeLabel: {
    color: '#8A9099',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  barcodeValue: {
    color: '#4CD787',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
  },
  centerBlock: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  productCard: {
    borderRadius: 14,
    padding: 20,
  },
  productImage: {
    width: '100%',
    height: 220,
    marginBottom: 16,
    borderRadius: 12,
  },
  productName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  statusBlock: {
    alignSelf: 'stretch',
    gap: 10,
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 8,
  },
  wrongInfoButton: {
    padding: 4,
    alignSelf: 'flex-end',
  },
  produsent: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  country: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  favoriteButton: {
    marginTop: 16,
    alignSelf: 'stretch',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  favoriteButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  ingredients: {
    fontSize: 15,
    lineHeight: 22,
  },
  reportBlock: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    marginTop: 12,
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  barcodeInputRow: {
    marginTop: 12,
    gap: 10,
  },
  barcodeInput: {
    marginTop: 0,
  },
  scanTrigger: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scanTriggerDisabled: {
    opacity: 0.5,
  },
  scanTriggerText: {
    fontWeight: '700',
    fontSize: 16,
  },
  reportPhoto: {
    marginTop: 10,
    width: '100%',
    height: 160,
    borderRadius: 10,
  },
  reportPhotoRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonText: {
    fontWeight: '700',
    fontSize: 16,
  },
  clearPhotoButton: {
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  clearPhotoText: {
    fontWeight: '600',
    fontSize: 14,
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  mutedText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  reportMessage: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 20,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  scanAgainButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  scanAgainText: {
    fontWeight: '600',
    fontSize: 15,
  },
});
