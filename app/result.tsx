import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

import {
  findUserAllergenHits,
  productHasAllergenData,
} from '../src/allergens/allergenPrefs';
import { useAllergenPrefs } from '../src/allergens/AllergenPrefsContext';
import {
  CONTAINS_CHIP,
  FREE_CHIP,
  TRACES_CHIP,
} from '../src/allergens/allergenChipColors';
import { useAuth } from '../src/auth/AuthContext';
import { BarcodeCaptureModal } from '../src/components/BarcodeCaptureModal';
import { AddToListModal } from '../src/components/AddToListModal';
import { ErrorText } from '../src/components/ErrorText';
import {
  isOpenFoodFactsImage,
  OpenFoodFactsCredit,
} from '../src/components/OpenFoodFactsCredit';
import { AllergnomShelfLoader } from '../src/components/AllergnomShelfLoader';
import { AppTextInput } from '../src/components/KeyboardDismissBar';
import { InfoCard, InfoChipRow, InfoRow } from '../src/components/ProductInfoCard';
import { ReportWrongInfoModal } from '../src/components/ReportWrongInfoModal';
import { SuggestMergeModal } from '../src/components/SuggestMergeModal';
import { getPreferredProductCountries } from '../src/country/detectProductCountry';
import { getProductRepository } from '../src/data/repository';
import {
  clearPendingProduct,
  getPendingProductByBarcode,
} from '../src/data/pendingProductCache';
import { useI18n } from '../src/i18n/I18nContext';
import {
  isUnknownBarcode,
  Product,
  ProductCatalog,
} from '../src/db/types';
import { askPickProductImage } from '../src/media/pickProductImage';
import { userFacingError } from '../src/errors/userFacingError';
import { goHome } from '../src/navigation/goHome';
import { useReliableBackHeader } from '../src/navigation/useReliableBackHeader';
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
  const { user, isAdmin, addFavorite, removeFavorite } = useAuth();
  const { selected: warnAllergens } = useAllergenPrefs();
  const { t } = useI18n();
  const { colors } = useTheme();
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
  const [reportSectionOpen, setReportSectionOpen] = useState(false);
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const [wrongInfoOpen, setWrongInfoOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  useReliableBackHeader({ title: t('nav.result') });

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
            // All catalogs, GPS country first so local products win quickly.
            const countries = await getPreferredProductCountries();
            found = await repo.getByBarcode(barcode, { countries });
            if (found) {
              // Live catalog wins — drop any stale local pending copy.
              void clearPendingProduct(barcode);
            } else {
              found = await getPendingProductByBarcode(barcode);
            }
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
    }, [barcode, catalogParam, idParam, t])
  );

  // No catalog match: skip the "not found" step and jump straight into the
  // AI scan instead of making the user tap through an extra screen.
  useEffect(() => {
    if (state !== 'not_found') return;
    if (user) {
      router.replace({ pathname: '/add', params: { barcode, aiFocus: '1' } });
    } else {
      router.replace('/login');
    }
  }, [state, user, barcode, router]);

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

  /** Pick a photo and send it straight away — no separate submit step. */
  const pickAndSubmitProductPhoto = async () => {
    if (!product?.catalog) return;
    const picked = await askPickProductImage();
    if (!picked) return;

    setReporting(true);
    setReportFeedback(null);
    try {
      const result = await getProductRepository().submitProductImage(
        product.catalog,
        product.id,
        picked
      );
      if (result.product) {
        setProduct(result.product);
      }
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

  const canAddPhoto =
    !!user &&
    state === 'found' &&
    !!product &&
    !!product.catalog &&
    !isUnknownBarcode(product.barcode);

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

  const canSuggestMerge =
    state === 'found' &&
    !!product?.catalog &&
    product.id > 0 &&
    isWritableCatalog(product.catalog);

  const hasDeclaration = productHasAllergenData(product?.allergens);
  const allergenFilterOn = warnAllergens.length > 0;
  const allergenHits = allergenFilterOn
    ? findUserAllergenHits(
        warnAllergens,
        product?.allergens,
        product?.glutenRating
      )
    : [];
  const containsAllergens = allergenHits
    .filter((h) => h.kind === 'contains')
    .map((h) => h.selected);
  const mayContainAllergens = allergenHits
    .filter((h) => h.kind === 'mayContain')
    .map((h) => h.selected);
  const freeAllergens = allergenHits
    .filter((h) => h.kind === 'free')
    .map((h) => h.selected);
  const hasFilteredAllergens = allergenHits.length > 0;

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

      {(state === 'loading' || state === 'not_found') && (
        <View style={styles.centerBlock}>
          <AllergnomShelfLoader label={t('result.lookingUp')} />
        </View>
      )}

      {state === 'error' && (
        <View style={styles.centerBlock}>
          <ErrorText style={styles.errorTitle}>
            {errorMessage || t('errors.allergnomDown')}
          </ErrorText>
        </View>
      )}

      {state === 'found' && product && (
        <View style={[styles.productCard, { backgroundColor: colors.background }]}>
          {productImageUri(product.imageUrl) ? (
            <View style={styles.productImageWrap}>
              <Image
                source={{ uri: productImageUri(product.imageUrl)! }}
                style={[styles.productImage, { backgroundColor: colors.surface }]}
                resizeMode="contain"
                accessibilityLabel={`${product.name} ${t('result.productImageA11y')}`}
              />
              {isOpenFoodFactsImage(product.imageUrl) ? <OpenFoodFactsCredit /> : null}
            </View>
          ) : (
            <Pressable
              style={[
                styles.photoPlaceholder,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => void pickAndSubmitProductPhoto()}
              disabled={!canAddPhoto || reporting}
              accessibilityRole="button"
              accessibilityLabel={t('result.tapToAddPhoto')}
            >
              {reporting ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="camera-plus-outline"
                    size={34}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[styles.photoPlaceholderText, { color: colors.textSecondary }]}
                  >
                    {canAddPhoto
                      ? t('result.tapToAddPhoto')
                      : t('result.signInToAddPhoto')}
                  </Text>
                </>
              )}
            </Pressable>
          )}
          {product.pending ? (
            <View
              style={[
                styles.pendingBanner,
                { backgroundColor: colors.primaryMuted ?? colors.surface },
              ]}
            >
              <MaterialCommunityIcons
                name="clock-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={[styles.pendingBannerText, { color: colors.primary }]}>
                {t('result.pendingLocal')}
              </Text>
            </View>
          ) : null}

          <InfoCard>
            <InfoRow
              label={t('add.produsent')}
              value={product.produsent ?? ''}
              emptyLabel={t('add.aiResultNoneFound')}
            />
            <InfoRow
              label={t('add.productName')}
              value={product.name}
              emptyLabel={t('add.aiResultNoneFound')}
            />
            {product.productionCountry?.trim() ? (
              <InfoRow
                label={t('result.country')}
                value={product.productionCountry}
                emptyLabel={t('add.aiResultNoneFound')}
              />
            ) : null}
            <InfoRow
              label={t('result.ingredients')}
              value={product.ingredients ?? ''}
              emptyLabel={t('result.noIngredients')}
            />

            {!allergenFilterOn ? (
              <InfoRow
                label={t('result.allergensTitle')}
                value=""
                emptyLabel={t('result.allergensFilterOff')}
              />
            ) : hasFilteredAllergens ? (
              <>
                {containsAllergens.length > 0 ? (
                  <InfoChipRow
                    label={t('result.allergensContainsLabel')}
                    names={containsAllergens}
                    accent={CONTAINS_CHIP}
                    emptyLabel=""
                  />
                ) : null}
                {mayContainAllergens.length > 0 ? (
                  <InfoChipRow
                    label={t('result.allergensMayContainLabel')}
                    names={mayContainAllergens}
                    accent={TRACES_CHIP}
                    emptyLabel=""
                  />
                ) : null}
                {freeAllergens.length > 0 ? (
                  <InfoChipRow
                    label={t('result.allergensFreeLabel')}
                    names={freeAllergens}
                    accent={FREE_CHIP}
                    emptyLabel=""
                  />
                ) : null}
              </>
            ) : (
              <InfoRow
                label={t('result.allergensTitle')}
                value=""
                emptyLabel={
                  !hasDeclaration
                    ? t('result.allergensNone')
                    : t('result.allergensNoMatch')
                }
              />
            )}
          </InfoCard>

          <View style={styles.statusBlock}>
            <View style={styles.reportActions}>
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
              {canSuggestMerge ? (
                <Pressable
                  style={styles.wrongInfoButton}
                  onPress={() => setMergeOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isAdmin ? t('result.mergeTitleAdmin') : t('result.mergeTitle')
                  }
                  hitSlop={8}
                >
                  <MaterialCommunityIcons
                    name="call-merge"
                    size={28}
                    color={colors.textSecondary}
                  />
                </Pressable>
              ) : null}
            </View>

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

          {showReportForm && (
            <View style={[styles.reportBlock, { borderTopColor: colors.border }]}>
              <Pressable
                style={styles.reportHeader}
                onPress={() => setReportSectionOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityState={{ expanded: reportSectionOpen }}
                accessibilityLabel={t('result.reportBarcode')}
              >
                <Text style={[styles.reportHeaderText, { color: colors.text }]}>
                  {t('result.reportBarcode')}
                </Text>
                <MaterialCommunityIcons
                  name={reportSectionOpen ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color={colors.text}
                />
              </Pressable>

              {reportSectionOpen ? (
                <>
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

                  {/* Nothing to offer here once the product already has a photo. */}
                  {!productImageUri(product.imageUrl) || isAdmin ? (
                    <>
                      <Text
                        style={[
                          styles.sectionLabel,
                          { marginTop: 16, color: colors.textSecondary },
                        ]}
                      >
                        {t('result.photoOptional')}
                      </Text>
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
                  ) : null}

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
                    <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                      {reporting ? t('common.saving') : t('result.submitBarcode')}
                    </Text>
                  </Pressable>
                </>
              )}
                </>
              ) : null}
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

          {reportFeedback && !showReportForm ? (
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

      <Pressable
        style={[styles.scanAgainButton, { borderColor: colors.border }]}
        onPress={() => goHome(router)}
        accessibilityRole="button"
        accessibilityLabel={t('result.backHome')}
      >
        <Text style={[styles.scanAgainText, { color: colors.text }]}>
          {t('result.backHome')}
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
      <SuggestMergeModal
        visible={mergeOpen}
        product={
          isWritableCatalog(product?.catalog)
            ? { catalog: product!.catalog!, id: product!.id }
            : null
        }
        productName={product?.name}
        onClose={() => setMergeOpen(false)}
        onSuggested={() =>
          setReportFeedback({
            kind: 'success',
            text: t('result.mergeSuggested'),
          })
        }
        onMerged={() => {
          setReportFeedback({
            kind: 'success',
            text: t('result.mergeDone'),
          });
          router.replace('/');
        }}
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
  productImageWrap: {
    width: '100%',
    height: 220,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: 160,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  photoPlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  pendingBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  statusBlock: {
    alignSelf: 'stretch',
    gap: 10,
  },
  reportActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    alignSelf: 'stretch',
  },
  wrongInfoButton: {
    padding: 4,
    alignSelf: 'flex-end',
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  reportBlock: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
  },
  reportHeaderText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
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
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  scanAgainText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
