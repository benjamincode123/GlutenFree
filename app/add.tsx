import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { ALLERGEN_OPTIONS } from '../src/allergens/allergenPrefs';
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
import { getProductRepository } from '../src/data/repository';
import { MIN_PRODUCT_SEARCH_CHARS } from '../src/data/searchLimits';
import { useI18n } from '../src/i18n/I18nContext';
import {
  GlutenRating,
  isUnknownBarcode,
  Product,
  ProductCatalog,
} from '../src/db/types';
import { askPickProductImage } from '../src/media/pickProductImage';
import { userFacingError } from '../src/errors/userFacingError';
import { useTheme } from '../src/theme/ThemeContext';
function parseCatalog(value: string | undefined): ProductCatalog | null {
  if (value === 'products' || value === 'glutenfri' || value === 'gluten') return value;
  return null;
}

const CONTAINS_CHIP = { color: '#B3261E', backgroundColor: '#FBE5E4' };
const TRACES_CHIP = { color: '#B26A00', backgroundColor: '#FCF0DA' };

export default function AddProductScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user, isAdmin } = useAuth();
  const { colors } = useTheme();
  const { t, tf } = useI18n();
  const params = useLocalSearchParams<{
    barcode?: string;
    id?: string;
    catalog?: string;
  }>();
  const initialBarcode = (params.barcode ?? '').toString();
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

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('nav.add') });
  }, [navigation, t]);

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
      const saved = await getProductRepository().addProduct({
        barcode: barcode.trim() || (allowEmptyBarcode ? 'unknown' : ''),
        name: name.trim(),
        produsent: produsent.trim() || null,
        ingredients: ingredients.trim() || null,
        glutenRating: effectiveRating,
        allergens: statusesToAllergens(allergenStatuses),
        imageBase64: submissionImageBase64,
        id: isEditing && editingId ? editingId : undefined,
        catalog: isEditing && editingCatalog ? editingCatalog : undefined,
      });
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

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.heading, { color: colors.text }]}>
          {isEditing ? t('add.editTitle') : t('add.addTitle')}
        </Text>

        {formError && <ErrorText style={styles.formError}>{formError}</ErrorText>}

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
              <MaterialCommunityIcons name="camera" size={22} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
        {barcodeLocked ? (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {t('add.barcodeFromScan')}
          </Text>
        ) : null}

        <BarcodeCaptureModal
          visible={scanModalVisible}
          onClose={() => setScanModalVisible(false)}
          onCaptured={(code) => {
            setBarcode(code.trim());
            setFormError(null);
          }}
        />
        {!isEditing && (
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
                          {item.catalog === 'glutenfri'
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

        {!isEditing && (
          <Text style={[styles.orDivider, { color: colors.textSecondary }]}>
            {isAdmin ? t('add.orCreate') : t('add.newSubmission')}
          </Text>
        )}

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
  formError: {
    marginBottom: 8,
    marginTop: 4,
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
