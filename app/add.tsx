import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../src/auth/AuthContext';
import { getAuthToken } from '../src/auth/session';
import {
  ALLERGEN_OPTIONS,
  allergenLabelMatches,
} from '../src/allergens/allergenPrefs';
import {
  AllergenStatus,
  allergensToStatuses,
  defaultAllergenStatuses,
  glutenStatusFromRating,
  ratingFromGlutenStatus,
  statusesToAllergens,
} from '../src/allergens/allergenForm';
import { BarcodeCaptureModal } from '../src/components/BarcodeCaptureModal';
import { ErrorText } from '../src/components/ErrorText';
import { GlutenBadge } from '../src/components/GlutenBadge';
import { AppTextInput } from '../src/components/KeyboardDismissBar';
import { ScanWithAiTutorialModal } from '../src/components/ScanWithAiTutorialModal';
import { getProductRepository } from '../src/data/repository';
import { cachePendingProduct } from '../src/data/pendingProductCache';
import { MIN_PRODUCT_SEARCH_CHARS } from '../src/data/searchLimits';
import { useI18n } from '../src/i18n/I18nContext';
import {
  GlutenRating,
  isUnknownBarcode,
  Product,
  ProductCatalog,
} from '../src/db/types';
import * as ocrApi from '../src/data/ocrApi';
import {
  askPickIngredientsOcrImage,
  askPickProductImage,
} from '../src/media/pickProductImage';
import {
  extractBarcodeFromOcrText,
  scanBarcodeFromImageUriWithTimeout,
} from '../src/media/scanBarcodeFromImage';
import {
  markScanWithAiTutorialSeen,
  shouldShowScanWithAiTutorial,
} from '../src/media/scanWithAiTutorialPrefs';
import { userFacingError } from '../src/errors/userFacingError';
import { goHome } from '../src/navigation/goHome';
import { useReliableBackHeader } from '../src/navigation/useReliableBackHeader';
import { useTheme } from '../src/theme/ThemeContext';
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

const CONTAINS_CHIP = { color: '#B3261E', backgroundColor: '#FBE5E4' };
const TRACES_CHIP = { color: '#B26A00', backgroundColor: '#FCF0DA' };
const AI_FOCUS_EXAMPLE_IMAGE = require('../assets/scan-with-ai-tutorial.png');
const AI_FOCUS_EXAMPLE_HEIGHT = Math.round(Dimensions.get('window').height * 0.55);

export default function AddProductScreen() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { colors } = useTheme();
  const { t, tf } = useI18n();
  const params = useLocalSearchParams<{
    barcode?: string;
    id?: string;
    catalog?: string;
    aiFocus?: string;
  }>();
  const initialBarcode = (params.barcode ?? '').toString();
  const aiFocus =
    params.aiFocus === '1' ||
    params.aiFocus === 'true' ||
    params.aiFocus === 'yes';
  const editCatalog = parseCatalog((params.catalog ?? '').toString());
  const editId = Number.parseInt((params.id ?? '').toString(), 10);
  const hasEditTarget =
    editCatalog != null && Number.isFinite(editId) && editId > 0;

  const [barcode, setBarcode] = useState(initialBarcode);
  const [name, setName] = useState('');
  const [produsent, setProdusent] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [rating, setRating] = useState<GlutenRating | null>(null);
  const [allergenStatuses, setAllergenStatuses] = useState(defaultAllergenStatuses);
  const [loading, setLoading] = useState(Boolean(initialBarcode) || hasEditTarget);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(
    hasEditTarget ? editId : null
  );
  const [editingCatalog, setEditingCatalog] = useState<ProductCatalog | null>(
    hasEditTarget ? editCatalog : null
  );
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [linkSectionOpen, setLinkSectionOpen] = useState(false);

  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState<Product[]>([]);
  const [linkSearching, setLinkSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selectedLink, setSelectedLink] = useState<Product | null>(null);
  const [reportImageBase64, setReportImageBase64] = useState<string | null>(null);
  const [submissionImageBase64, setSubmissionImageBase64] = useState<string | null>(null);
  const [photoMissingError, setPhotoMissingError] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrTutorialVisible, setOcrTutorialVisible] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollHintBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!formError) return;
    // Keep the message under the save button in view after a failed attempt.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [formError]);

  // After AI check: nudge toward save — no back / swipe-away without submitting.
  const lockExitAfterAi = aiFocus && ocrDone;

  useReliableBackHeader({
    title: aiFocus ? t('result.checkWithAi') : t('nav.add'),
    lockExit: lockExitAfterAi,
  });

  useEffect(() => {
    if (!aiFocus || !ocrDone) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scrollHintBounce, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scrollHintBounce, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [aiFocus, ocrDone, scrollHintBounce]);

  // Prefill when editing an existing catalog product.
  useEffect(() => {
    let cancelled = false;
    if (!initialBarcode && !hasEditTarget) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const repo = getProductRepository();
        let existing: Product | null = null;
        if (hasEditTarget && editCatalog) {
          existing = await repo.getById(editCatalog, editId);
        }
        if (!existing && initialBarcode) {
          existing = await repo.getByBarcode(initialBarcode);
        }
        if (cancelled) return;
        if (existing) {
          setBarcode(existing.barcode);
          setName(existing.name);
          setProdusent(existing.produsent ?? '');
          setIngredients(existing.ingredients ?? '');
          setRating(existing.glutenRating);
          const fromAllergens = allergensToStatuses(existing.allergens);
          if (existing.allergens) {
            setAllergenStatuses(fromAllergens);
          } else {
            setAllergenStatuses({
              ...defaultAllergenStatuses(),
              Gluten: glutenStatusFromRating(existing.glutenRating),
            });
          }
          setSubmissionImageBase64(existing.imageUrl?.trim() || null);
          setIsEditing(true);
          if (existing.id > 0 && existing.catalog) {
            setEditingId(existing.id);
            setEditingCatalog(existing.catalog);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialBarcode, hasEditTarget, editCatalog, editId]);

  useEffect(() => {
    if (isEditing) return;
    const term = linkQuery.trim();
    if (term.length < MIN_PRODUCT_SEARCH_CHARS) {
      setLinkResults([]);
      setLinkSearching(false);
      return;
    }

    let cancelled = false;
    setLinkSearching(true);
    const handle = setTimeout(() => {
      getProductRepository()
        .searchByName(term, 20, { unknownOnly: true })
        .then((result) => {
          if (!cancelled) {
            setLinkResults(result.items.filter((p) => isUnknownBarcode(p.barcode)));
          }
        })
        .catch(() => {
          if (!cancelled) setLinkResults([]);
        })
        .finally(() => {
          if (!cancelled) setLinkSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [linkQuery, isEditing]);

  async function handleLinkExisting() {
    const scanned = barcode.trim();
    setFormError(null);
    if (!scanned) {
      setFormError(t('add.missingBarcodeBody'));
      return;
    }
    if (!selectedLink?.catalog) {
      setFormError(t('add.pickProductBody'));
      return;
    }

    setLinking(true);
    try {
      const updated = await getProductRepository().reportBarcode(
        selectedLink.catalog,
        selectedLink.id,
        scanned,
        selectedLink.imageUrl?.trim() && !isAdmin ? null : reportImageBase64
      );
      if (updated.pending) {
        Alert.alert(
          t('add.submittedTitle'),
          t('add.submittedBarcodeBody'),
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          t('add.linkedTitle'),
          tf('add.linkedBody', { name: updated.name, barcode: scanned }),
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace({
                  pathname: '/result',
                  params: {
                    barcode: scanned,
                    id: String(updated.id),
                    catalog: updated.catalog ?? selectedLink.catalog,
                  },
                });
              },
            },
          ]
        );
      }
    } catch (err) {
      setFormError(userFacingError(err, t, 'report_failed'));
    } finally {
      setLinking(false);
    }
  }

  async function handleSave() {
    setFormError(null);
    const allowEmptyBarcode = isAdmin && isEditing;
    if (!barcode.trim() && !allowEmptyBarcode) {
      setFormError(t('add.missingBarcodeBody'));
      return;
    }
    if (!name.trim()) {
      setFormError(t('add.missingNameBody'));
      return;
    }
    const effectiveRating =
      rating ?? ratingFromGlutenStatus(allergenStatuses.Gluten ?? 'free');
    if (!effectiveRating) {
      setFormError(t('add.missingRatingBody'));
      return;
    }
    if (!isAdmin && !submissionImageBase64?.trim()) {
      setPhotoMissingError(true);
      setFormError(t('add.missingPhotoBody'));
      return;
    }
    setPhotoMissingError(false);

    setSaving(true);
    try {
      const barcodeValue = barcode.trim() || (allowEmptyBarcode ? 'unknown' : '');
      // Block new adds when the barcode already exists in the catalog.
      if (!isEditing && barcodeValue && barcodeValue.toLowerCase() !== 'unknown') {
        const existing = await getProductRepository().getByBarcode(barcodeValue);
        if (existing) {
          setFormError(t('errors.barcodeTaken'));
          return;
        }
      }

      const saved = await getProductRepository().addProduct({
        barcode: barcodeValue,
        name: name.trim(),
        produsent: produsent.trim() || null,
        ingredients: ingredients.trim() || null,
        glutenRating: effectiveRating,
        allergens: statusesToAllergens(allergenStatuses),
        imageBase64: submissionImageBase64,
        id: isEditing && editingId ? editingId : undefined,
        catalog: isEditing && editingCatalog ? editingCatalog : undefined,
      });
      // Keep pending submissions on-device so the next scan still shows this product
      // until it (hopefully) lands in the live catalog within ~2 days.
      if (saved.pending || !isAdmin) {
        await cachePendingProduct({
          ...saved,
          barcode: barcodeValue,
          name: name.trim(),
          produsent: produsent.trim() || null,
          ingredients: ingredients.trim() || null,
          glutenRating: effectiveRating,
          allergens: statusesToAllergens(allergenStatuses),
          imageUrl: saved.imageUrl ?? submissionImageBase64 ?? null,
          pending: true,
        });
      }
      Alert.alert(
        saved.pending ? t('add.submittedTitle') : t('add.savedTitle'),
        saved.pending
          ? t('add.submittedBody')
          : isEditing
            ? tf('add.savedUpdated', { name: name.trim() })
            : tf('add.savedAdded', { name: name.trim() }),
        [
          {
            text: 'OK',
            onPress: () => {
              router.dismissAll();
            },
          },
        ]
      );
    } catch (err) {
      setFormError(userFacingError(err, t, 'save_failed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleScanWithAi() {
    setOcrError(null);
    const picked = await askPickIngredientsOcrImage(
      t('add.scanWithAiPickTitle'),
      t('add.scanWithAiPickBody')
    );
    if (!picked) return;

    const token = getAuthToken();
    if (!token) {
      setOcrError(t('add.signInRequired'));
      return;
    }

    // Don't overwrite a barcode that came from an existing product scan.
    const canFillBarcode =
      !(Boolean(initialBarcode) && !(isAdmin && isEditing));

    setOcrScanning(true);
    try {
      // OCR/AI first — do not wait on barcode decode.
      const result = await ocrApi.readImageText(token, picked.dataUri);

      if (!result.text.trim()) {
        setOcrError(t('add.scanWithAiFailed'));
        return;
      }

      const parsed = result.parsed;
      if (parsed) {
        if (parsed.produsent) setProdusent(parsed.produsent);
        if (parsed.name) setName(parsed.name);
        if (parsed.ingredients) setIngredients(parsed.ingredients);

        setAllergenStatuses((prev) => {
          // Retake starts clean so previous AI allergens do not stick around.
          const next = ocrDone ? { ...defaultAllergenStatuses() } : { ...prev };
          const resolve = (label: string) =>
            ALLERGEN_OPTIONS.find(
              (option) =>
                option === label || allergenLabelMatches(option, label)
            ) ?? null;

          for (const allergen of parsed.allergensContains) {
            const key = resolve(allergen);
            if (key) next[key] = 'contains';
          }
          for (const allergen of parsed.allergensMayContain) {
            const key = resolve(allergen);
            // Don't downgrade "contains" to traces.
            if (key && next[key] !== 'contains') {
              next[key] = 'mayContain';
            }
          }
          const gluten = next.Gluten ?? 'free';
          setRating(ratingFromGlutenStatus(gluten));
          return next;
        });
      }

      setOcrDone(true);
      // In AI-focus flow, reuse the label photo as the product submission image.
      if (aiFocus) {
        setSubmissionImageBase64(picked.dataUri);
        setPhotoMissingError(false);
      }

      if (result.parseWarning) {
        setOcrError(result.parseWarning);
      }

      // Prefer GTIN from OCR text immediately (instant, local).
      if (canFillBarcode) {
        const fromText = extractBarcodeFromOcrText(result.text);
        if (fromText) {
          setBarcode(fromText);
        } else {
          // Downscaled image scan in background — never blocks the AI result UI.
          void scanBarcodeFromImageUriWithTimeout(picked.localUri, {
            width: picked.width,
            height: picked.height,
            timeoutMs: 2500,
          }).then((code) => {
            if (code) setBarcode(code);
          });
        }
      }
    } catch (err) {
      if (err instanceof ocrApi.OcrRequestError) {
        setOcrError(err.message);
      } else {
        setOcrError(
          userFacingError(err, t, 'unauthorized') || t('add.scanWithAiFailed')
        );
      }
    } finally {
      setOcrScanning(false);
    }
  }

  const canEditBarcode = isAdmin && isEditing;
  const barcodeLocked = Boolean(initialBarcode) && !canEditBarcode;

  if (!user) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.guardTitle, { color: colors.text }]}>
          {t('add.signInRequired')}
        </Text>
        <Text style={[styles.guardText, { color: colors.textSecondary }]}>
          {t('add.signInRequiredBody')}
        </Text>
        <Pressable
          style={[styles.guardButton, { borderColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.guardButtonText, { color: colors.primary }]}>
            {t('common.goBack')}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (isEditing && !isAdmin) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.guardTitle, { color: colors.text }]}>
          {t('add.adminRequired')}
        </Text>
        <Text style={[styles.guardText, { color: colors.textSecondary }]}>
          {t('add.adminRequiredBody')}
        </Text>
        <Pressable
          style={[styles.guardButton, { borderColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.guardButtonText, { color: colors.primary }]}>
            {t('common.goBack')}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.background,
      borderColor: colors.border,
      color: colors.text,
    },
  ];

  const showFullForm = !aiFocus || ocrDone;
  const containsSelected = ALLERGEN_OPTIONS.filter(
    (a) => (allergenStatuses[a] ?? 'free') === 'contains'
  );
  const tracesSelected = ALLERGEN_OPTIONS.filter(
    (a) => (allergenStatuses[a] ?? 'free') === 'mayContain'
  );

  async function startScanWithAi() {
    setOcrError(null);
    const showTutorial = await shouldShowScanWithAiTutorial();
    if (showTutorial) {
      setOcrTutorialVisible(true);
      return;
    }
    await handleScanWithAi();
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <BarcodeCaptureModal
          visible={scanModalVisible}
          onClose={() => setScanModalVisible(false)}
          onCaptured={(code) => {
            setBarcode(code.trim());
            setFormError(null);
          }}
        />

        <ScanWithAiTutorialModal
          visible={ocrTutorialVisible}
          onClose={() => {
            setOcrTutorialVisible(false);
            void markScanWithAiTutorialSeen();
          }}
          onContinue={() => {
            setOcrTutorialVisible(false);
            void markScanWithAiTutorialSeen();
            void handleScanWithAi();
          }}
        />

        {aiFocus && !ocrDone ? (
          <View style={styles.aiFocusHero}>
            <Text style={[styles.heading, styles.aiFocusHeading, { color: colors.text }]}>
              {t('add.aiFocusTitle')}
            </Text>
            <View style={styles.aiFocusExampleWrap}>
              <Image
                source={AI_FOCUS_EXAMPLE_IMAGE}
                style={styles.aiFocusExampleImage}
                resizeMode="cover"
                accessibilityLabel={t('add.scanWithAiTutorialImageA11y')}
              />
              <Text
                style={[styles.aiFocusExampleCaption, { color: colors.textSecondary }]}
              >
                {t('add.aiFocusExampleCaption')}
              </Text>
            </View>
            {barcode.trim() ? (
              <View
                style={[
                  styles.barcodeChip,
                  styles.aiFocusBarcodeChip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <MaterialCommunityIcons
                  name="barcode"
                  size={18}
                  color={colors.textSecondary}
                />
                <Text style={[styles.barcodeChipText, { color: colors.text }]}>
                  {t('add.aiFocusBarcode')}: {barcode.trim()}
                </Text>
              </View>
            ) : null}
            <Pressable
              style={[
                styles.aiFocusScanButton,
                {
                  backgroundColor: colors.primary,
                  opacity: ocrScanning ? 0.7 : 1,
                },
              ]}
              disabled={ocrScanning}
              onPress={() => void startScanWithAi()}
            >
              {ocrScanning ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <MaterialCommunityIcons
                  name="sparkles"
                  size={24}
                  color={colors.onPrimary}
                />
              )}
              <Text style={[styles.aiFocusScanLabel, { color: colors.onPrimary }]}>
                {ocrScanning ? t('add.scanWithAiWorking') : t('add.scanWithAi')}
              </Text>
            </Pressable>
            {ocrError ? (
              <ErrorText style={styles.ocrError}>{ocrError}</ErrorText>
            ) : null}
          </View>
        ) : null}

        {!aiFocus ? (
          <>
            <Text style={[styles.heading, { color: colors.text }]}>
              {isEditing ? t('add.editTitle') : t('add.addTitle')}
            </Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('add.barcode')}
            </Text>
            <View style={styles.barcodeInputRow}>
              <AppTextInput
                style={[...inputStyle, styles.barcodeInput]}
                placeholder={t('add.barcodePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={barcode}
                onChangeText={setBarcode}
                editable={!barcodeLocked}
              />
              {!barcodeLocked ? (
                <Pressable
                  style={[
                    styles.barcodeScanButton,
                    {
                      borderColor: colors.primary,
                      backgroundColor: colors.surface,
                    },
                  ]}
                  onPress={() => setScanModalVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('result.scanBarcode')}
                >
                  <MaterialCommunityIcons
                    name="camera"
                    size={22}
                    color={colors.primary}
                  />
                </Pressable>
              ) : null}
            </View>
            {barcodeLocked ? (
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                {t('add.barcodeFromScan')}
              </Text>
            ) : null}

            <View
              style={[
                styles.ocrCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text
                style={[styles.label, { color: colors.textSecondary, marginTop: 0 }]}
              >
                {t('add.scanWithAi')}
              </Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                {t('add.scanWithAiHint')}
              </Text>
              <Pressable
                style={[
                  styles.ocrButton,
                  {
                    borderColor: colors.primary,
                    backgroundColor: colors.background,
                    opacity: ocrScanning ? 0.6 : 1,
                  },
                ]}
                disabled={ocrScanning}
                onPress={() => void startScanWithAi()}
              >
                {ocrScanning ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <MaterialCommunityIcons
                    name="text-recognition"
                    size={20}
                    color={colors.primary}
                  />
                )}
                <Text style={[styles.ocrButtonText, { color: colors.primary }]}>
                  {ocrScanning ? t('add.scanWithAiWorking') : t('add.scanWithAi')}
                </Text>
              </Pressable>
              {ocrError ? (
                <ErrorText style={styles.ocrError}>{ocrError}</ErrorText>
              ) : null}
            </View>
          </>
        ) : null}

        {!aiFocus && !isEditing && (
          <View
            style={[
              styles.linkCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Pressable
              style={styles.linkHeader}
              onPress={() => setLinkSectionOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: linkSectionOpen }}
              accessibilityLabel={t('add.linkTitle')}
            >
              <Text style={[styles.linkTitle, { color: colors.text }]}>
                {t('add.linkTitle')}
              </Text>
              <MaterialCommunityIcons
                name={linkSectionOpen ? 'chevron-up' : 'chevron-down'}
                size={24}
                color={colors.text}
              />
            </Pressable>

            {linkSectionOpen ? (
              <>
                <View style={styles.linkHintWrap}>
                  <Text style={[styles.linkHint, { color: colors.textSecondary }]}>
                    {t('add.linkHint')}
                  </Text>
                </View>

                <AppTextInput
                  style={inputStyle}
                  placeholder={t('add.searchName')}
                  placeholderTextColor={colors.textSecondary}
                  value={linkQuery}
                  onChangeText={(text) => {
                    setLinkQuery(text);
                    setSelectedLink(null);
                  }}
                  autoCorrect={false}
                  autoCapitalize="none"
                />

                {linkSearching && (
                  <ActivityIndicator
                    style={styles.linkSpinner}
                    color={colors.primary}
                  />
                )}

                {linkResults.map((item) => {
                  const selected =
                    selectedLink?.id === item.id &&
                    selectedLink?.catalog === item.catalog;
                  return (
                    <Pressable
                      key={`${item.catalog}-${item.id}`}
                      style={[
                        styles.linkRow,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected
                            ? colors.primaryMuted
                            : colors.background,
                        },
                      ]}
                      onPress={() => {
                        setSelectedLink(item);
                        if (item.imageUrl?.trim() && !isAdmin) {
                          setReportImageBase64(null);
                        }
                      }}
                    >
                      <View style={styles.linkRowText}>
                        {item.produsent?.trim() ? (
                          <Text
                            style={[styles.linkProdusent, { color: colors.textSecondary }]}
                          >
                            {item.produsent.trim()}
                          </Text>
                        ) : null}
                        <Text style={[styles.linkName, { color: colors.text }]}>
                          {item.name}
                        </Text>
                        <Text style={[styles.linkMeta, { color: colors.textSecondary }]}>
                          {item.glutenRating === 'gluten_free'
                            ? t('add.glutenFree')
                            : t('add.containsGluten')}{' '}
                          · {t('add.unknownBarcode')}
                        </Text>
                      </View>
                      <GlutenBadge rating={item.glutenRating} />
                    </Pressable>
                  );
                })}

                {!linkSearching &&
                  linkQuery.trim().length >= MIN_PRODUCT_SEARCH_CHARS &&
                  linkResults.length === 0 && (
                    <Text style={[styles.linkEmpty, { color: colors.textSecondary }]}>
                      {t('add.noMatch')}
                    </Text>
                  )}

                <Text style={[styles.linkPhotoLabel, { color: colors.textSecondary }]}>
                  {t('add.photoOptional')}
                </Text>
                {selectedLink?.imageUrl?.trim() && !isAdmin ? (
                  <Text style={[styles.linkEmpty, { color: colors.textSecondary }]}>
                    {t('add.photoLocked')}
                  </Text>
                ) : (
                  <>
                    {reportImageBase64 ? (
                      <Image
                        source={{ uri: reportImageBase64 }}
                        style={[
                          styles.linkPhotoPreview,
                          { backgroundColor: colors.background },
                        ]}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={[styles.linkEmpty, { color: colors.textSecondary }]}>
                        {t('add.noPhoto')}
                      </Text>
                    )}
                    <View style={styles.linkPhotoRow}>
                      <Pressable
                        style={[styles.linkPhotoButton, { borderColor: colors.primary }]}
                        onPress={() => {
                          void askPickProductImage().then((uri) => {
                            if (uri) setReportImageBase64(uri);
                          });
                        }}
                      >
                        <Text
                          style={[styles.linkPhotoButtonText, { color: colors.primary }]}
                        >
                          {reportImageBase64 ? t('add.changePhoto') : t('add.addPhoto')}
                        </Text>
                      </Pressable>
                      {reportImageBase64 && (
                        <Pressable
                          style={styles.linkPhotoClear}
                          onPress={() => setReportImageBase64(null)}
                        >
                          <Text
                            style={[styles.linkPhotoClearText, { color: colors.danger }]}
                          >
                            {t('add.removePhoto')}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </>
                )}

                <Pressable
                  style={[
                    styles.linkButton,
                    { backgroundColor: colors.primary },
                    (!selectedLink || linking || !barcode.trim()) && {
                      backgroundColor: colors.primaryMuted,
                    },
                  ]}
                  disabled={!selectedLink || linking || !barcode.trim()}
                  onPress={() => void handleLinkExisting()}
                >
                  <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>
                    {linking ? t('add.linking') : t('add.linkButton')}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        )}

        {showFullForm ? (
          <>
        {aiFocus ? (
          <View style={styles.aiFocusAfterScan}>
            {barcode.trim() ? (
              <View
                style={[
                  styles.barcodeChip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <MaterialCommunityIcons
                  name="barcode"
                  size={18}
                  color={colors.textSecondary}
                />
                <Text style={[styles.barcodeChipText, { color: colors.text }]}>
                  {t('add.aiFocusBarcode')}: {barcode.trim()}
                </Text>
              </View>
            ) : null}
            <Text style={[styles.aiFocusReadyTitle, { color: colors.text }]}>
              {t('add.aiFocusAllergensReady')}
            </Text>
            {(containsSelected.length > 0 || tracesSelected.length > 0) && (
              <View style={styles.aiFocusSummary}>
                {containsSelected.map((name) => (
                  <View
                    key={`sum-c-${name}`}
                    style={[
                      styles.aiFocusSummaryChip,
                      {
                        backgroundColor: CONTAINS_CHIP.backgroundColor,
                        borderColor: CONTAINS_CHIP.color,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.aiFocusSummaryChipText,
                        { color: CONTAINS_CHIP.color },
                      ]}
                    >
                      {name}
                    </Text>
                  </View>
                ))}
                {tracesSelected.map((name) => (
                  <View
                    key={`sum-m-${name}`}
                    style={[
                      styles.aiFocusSummaryChip,
                      {
                        backgroundColor: TRACES_CHIP.backgroundColor,
                        borderColor: TRACES_CHIP.color,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.aiFocusSummaryChipText,
                        { color: TRACES_CHIP.color },
                      ]}
                    >
                      {name}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {ocrError ? (
              <ErrorText style={styles.ocrError}>{ocrError}</ErrorText>
            ) : null}
          </View>
        ) : null}

        {aiFocus && ocrDone ? (
          <Animated.View
            style={[
              styles.aiFocusScrollHint,
              {
                borderColor: colors.primary,
                backgroundColor: colors.surface,
                transform: [
                  {
                    translateY: scrollHintBounce.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 6],
                    }),
                  },
                ],
              },
            ]}
          >
            <MaterialCommunityIcons
              name="chevron-down"
              size={20}
              color={colors.primary}
            />
            <Text
              style={[styles.aiFocusScrollHintText, { color: colors.primary }]}
              numberOfLines={1}
            >
              {t('add.aiFocusScrollHint')}
            </Text>
            <MaterialCommunityIcons
              name="chevron-down"
              size={20}
              color={colors.primary}
            />
          </Animated.View>
        ) : null}

        {!aiFocus && !isEditing && (
          <Text style={[styles.orDivider, { color: colors.textSecondary }]}>
            {isAdmin ? t('add.orCreate') : t('add.newSubmission')}
          </Text>
        )}

        {!aiFocus ? (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('add.produsent')}
            </Text>
            <AppTextInput
              style={inputStyle}
              placeholder={t('add.produsentPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={produsent}
              onChangeText={setProdusent}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('add.productName')}
            </Text>
            <AppTextInput
              style={inputStyle}
              placeholder={t('add.namePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('add.ingredients')}
            </Text>
            <AppTextInput
              style={[...inputStyle, styles.multiline]}
              placeholder={t('add.ingredientsPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={ingredients}
              onChangeText={setIngredients}
              multiline
              textAlignVertical="top"
            />
          </>
        ) : null}

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {aiFocus ? t('add.aiFocusMoreAllergens') : t('add.allergens')}
        </Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {aiFocus ? t('add.aiFocusAllergensHint') : t('add.allergensHint')}
        </Text>

        <Text style={[styles.allergenGroupLabel, { color: CONTAINS_CHIP.color }]}>
          {t('add.allergenContains')}
        </Text>
        <View style={styles.allergenWrap}>
          {ALLERGEN_OPTIONS.map((allergen) => {
            const active = (allergenStatuses[allergen] ?? 'free') === 'contains';
            return (
              <Pressable
                key={`contains-${allergen}`}
                onPress={() => {
                  const current = allergenStatuses[allergen] ?? 'free';
                  const next: AllergenStatus =
                    current === 'contains' ? 'free' : 'contains';
                  setAllergenStatuses((prev) => ({ ...prev, [allergen]: next }));
                  if (allergen === 'Gluten') {
                    setRating(ratingFromGlutenStatus(next));
                  }
                }}
                style={[
                  styles.allergenChip,
                  {
                    borderColor: active ? CONTAINS_CHIP.color : colors.border,
                    backgroundColor: active
                      ? CONTAINS_CHIP.backgroundColor
                      : colors.surface,
                  },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${t('add.allergenContains')}: ${allergen}`}
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
            const active = (allergenStatuses[allergen] ?? 'free') === 'mayContain';
            return (
              <Pressable
                key={`traces-${allergen}`}
                onPress={() => {
                  const current = allergenStatuses[allergen] ?? 'free';
                  const next: AllergenStatus =
                    current === 'mayContain' ? 'free' : 'mayContain';
                  setAllergenStatuses((prev) => ({ ...prev, [allergen]: next }));
                  if (allergen === 'Gluten') {
                    setRating(ratingFromGlutenStatus(next));
                  }
                }}
                style={[
                  styles.allergenChip,
                  {
                    borderColor: active ? TRACES_CHIP.color : colors.border,
                    backgroundColor: active
                      ? TRACES_CHIP.backgroundColor
                      : colors.surface,
                  },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${t('add.allergenMayContain')}: ${allergen}`}
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

        {aiFocus ? (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('add.produsent')}
            </Text>
            <AppTextInput
              style={inputStyle}
              placeholder={t('add.produsentPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={produsent}
              onChangeText={setProdusent}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('add.productName')}
            </Text>
            <AppTextInput
              style={inputStyle}
              placeholder={t('add.namePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
            />
          </>
        ) : null}

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {!isAdmin ? t('add.photoRequired') : t('add.photoOptional')}
        </Text>
        <View
          style={[
            styles.photoSlot,
            {
              backgroundColor: colors.surface,
              borderColor: photoMissingError ? colors.danger : colors.border,
              borderWidth: photoMissingError ? 2 : 1,
            },
          ]}
        >
          {submissionImageBase64 ? (
            <Image
              source={{ uri: submissionImageBase64 }}
              style={styles.submissionPhotoPreview}
              resizeMode="contain"
            />
          ) : (
            <Text
              style={[
                styles.linkEmpty,
                styles.photoSlotEmpty,
                { color: colors.textSecondary },
              ]}
            >
              {!isAdmin ? t('add.photoRequiredBody') : t('add.noPhoto')}
            </Text>
          )}
        </View>
        <View style={styles.linkPhotoRow}>
          <Pressable
            style={[
              styles.linkPhotoButton,
              {
                borderColor: photoMissingError ? colors.danger : colors.primary,
              },
            ]}
            onPress={() => {
              void askPickProductImage().then((uri) => {
                if (uri) {
                  setSubmissionImageBase64(uri);
                  setPhotoMissingError(false);
                  setFormError(null);
                }
              });
            }}
          >
            <Text
              style={[
                styles.linkPhotoButtonText,
                { color: photoMissingError ? colors.danger : colors.primary },
              ]}
            >
              {submissionImageBase64 ? t('add.changePhoto') : t('add.addPhoto')}
            </Text>
          </Pressable>
          {submissionImageBase64 && (
            <Pressable
              style={styles.linkPhotoClear}
              onPress={() => setSubmissionImageBase64(null)}
            >
              <Text style={[styles.linkPhotoClearText, { color: colors.danger }]}>
                {t('add.removePhoto')}
              </Text>
            </Pressable>
          )}
        </View>

        {ocrDone ? (
          <Pressable
            style={[
              styles.retakeAiButton,
              {
                borderColor: colors.primary,
                backgroundColor: colors.surface,
                opacity: ocrScanning ? 0.6 : 1,
              },
            ]}
            disabled={ocrScanning}
            onPress={() => void handleScanWithAi()}
            accessibilityRole="button"
            accessibilityLabel={t('add.retakeAiPhoto')}
          >
            {ocrScanning ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <MaterialCommunityIcons
                name="camera-retake-outline"
                size={20}
                color={colors.primary}
              />
            )}
            <Text style={[styles.retakeAiButtonText, { color: colors.primary }]}>
              {ocrScanning ? t('add.scanWithAiWorking') : t('add.retakeAiPhoto')}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary },
            saving && { backgroundColor: colors.primaryMuted },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>
            {saving
              ? t('add.saving')
              : isEditing
                ? t('add.saveChanges')
                : isAdmin
                  ? t('add.saveNew')
                  : t('add.submitReview')}
          </Text>
        </Pressable>

        {ocrDone ? (
          <Pressable
            style={[
              styles.discardAiButton,
              {
                borderColor: colors.danger,
                opacity: saving || ocrScanning ? 0.5 : 1,
              },
            ]}
            disabled={saving || ocrScanning}
            onPress={() => {
              Alert.alert(
                t('add.discardAiTitle'),
                t('add.discardAiBody'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('add.discardAiConfirm'),
                    style: 'destructive',
                    onPress: () => goHome(router),
                  },
                ]
              );
            }}
            accessibilityRole="button"
            accessibilityLabel={t('add.discardAi')}
          >
            <MaterialCommunityIcons
              name="close-circle-outline"
              size={20}
              color={colors.danger}
            />
            <Text style={[styles.discardAiButtonText, { color: colors.danger }]}>
              {t('add.discardAi')}
            </Text>
          </Pressable>
        ) : null}

        {formError ? (
          <ErrorText style={styles.formError}>{formError}</ErrorText>
        ) : null}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  aiFocusHero: {
    paddingTop: 0,
    paddingBottom: 4,
  },
  aiFocusHeading: {
    marginBottom: 6,
  },
  aiFocusExampleWrap: {
    width: '100%',
    alignSelf: 'center',
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  aiFocusExampleImage: {
    width: '100%',
    height: AI_FOCUS_EXAMPLE_HEIGHT,
  },
  aiFocusExampleCaption: {
    fontSize: 13,
    lineHeight: 18,
    paddingTop: 6,
  },
  aiFocusBarcodeChip: {
    marginBottom: 10,
  },
  barcodeChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  barcodeChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  aiFocusScanButton: {
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  aiFocusScanLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  aiFocusAfterScan: {
    marginBottom: 8,
  },
  aiFocusReadyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  aiFocusSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  aiFocusSummaryChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  aiFocusSummaryChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  aiFocusScrollHint: {
    marginTop: 4,
    marginBottom: 4,
    minHeight: 40,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  aiFocusScrollHintText: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  formError: {
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  barcodeInputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  barcodeInput: {
    flex: 1,
    height: 48,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  barcodeScanButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiline: {
    minHeight: 100,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  ocrCard: {
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  ocrButton: {
    marginTop: 12,
    minHeight: 46,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ocrButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  ocrError: {
    marginTop: 10,
  },
  linkCard: {
    marginTop: 20,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'visible',
  },
  linkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  linkTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  linkHintWrap: {
    width: '100%',
    marginTop: 12,
    marginBottom: 12,
  },
  linkHint: {
    fontSize: 13,
    lineHeight: 20,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  linkSpinner: {
    marginTop: 12,
  },
  linkRow: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkRowText: {
    flex: 1,
    marginRight: 10,
  },
  linkName: {
    fontSize: 15,
    fontWeight: '700',
  },
  linkProdusent: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  linkMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  linkEmpty: {
    marginTop: 12,
    fontSize: 13,
  },
  linkPhotoLabel: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '700',
  },
  linkPhotoPreview: {
    marginTop: 10,
    width: '100%',
    height: 160,
    borderRadius: 10,
  },
  photoSlot: {
    marginTop: 10,
    width: '100%',
    minHeight: 160,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  photoSlotEmpty: {
    marginTop: 0,
    paddingHorizontal: 14,
    paddingVertical: 20,
    textAlign: 'center',
  },
  submissionPhotoPreview: {
    width: '100%',
    height: 160,
  },
  linkPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  linkPhotoButton: {
    flex: 1,
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkPhotoButtonText: {
    fontWeight: '700',
    fontSize: 16,
  },
  linkPhotoClear: {
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  linkPhotoClearText: {
    fontWeight: '600',
    fontSize: 14,
  },
  retakeAiButton: {
    marginTop: 12,
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retakeAiButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  discardAiButton: {
    marginTop: 12,
    marginBottom: 8,
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  discardAiButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  orDivider: {
    marginTop: 22,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  allergenGroupLabel: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  allergenWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  saveButton: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  guardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  guardText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  guardButton: {
    marginTop: 20,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  guardButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
