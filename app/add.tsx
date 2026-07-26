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
import { BarcodeCaptureModal } from '../src/components/BarcodeCaptureModal';
import { ErrorText } from '../src/components/ErrorText';
import { GlutenBadge } from '../src/components/GlutenBadge';
import { AppTextInput } from '../src/components/KeyboardDismissBar';
import { getProductRepository } from '../src/data/repository';
import { MIN_PRODUCT_SEARCH_CHARS } from '../src/data/searchLimits';
import { useI18n } from '../src/i18n/I18nContext';
import { TranslationKey } from '../src/i18n/translations';
import {
  ALL_GLUTEN_RATINGS,
  getGlutenRatingMeta,
  GlutenRating,
  isUnknownBarcode,
  Product,
} from '../src/db/types';
import { askPickProductImage } from '../src/media/pickProductImage';
import { userFacingError } from '../src/errors/userFacingError';
import { useTheme } from '../src/theme/ThemeContext';
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

function ratingDescKey(rating: GlutenRating): TranslationKey {
  switch (rating) {
    case GlutenRating.GlutenFree:
      return 'rating.glutenFreeDesc';
    case GlutenRating.GlutenTrace:
      return 'rating.glutenTraceDesc';
    default:
      return 'rating.glutenContentDesc';
  }
}

export default function AddProductScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user, isAdmin } = useAuth();
  const { colors } = useTheme();
  const { t, tf } = useI18n();
  const params = useLocalSearchParams<{ barcode?: string }>();
  const initialBarcode = (params.barcode ?? '').toString();

  const [barcode, setBarcode] = useState(initialBarcode);
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [rating, setRating] = useState<GlutenRating | null>(null);
  const [loading, setLoading] = useState(Boolean(initialBarcode));
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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

  // If a barcode was passed in, prefill the form when it already exists.
  useEffect(() => {
    let cancelled = false;
    if (!initialBarcode) {
      setLoading(false);
      return;
    }
    getProductRepository()
      .getByBarcode(initialBarcode)
      .then((existing) => {
        if (cancelled) return;
        if (existing) {
          setName(existing.name);
          setIngredients(existing.ingredients ?? '');
          setRating(existing.glutenRating);
          setIsEditing(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialBarcode]);

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
        .then((rows) => {
          if (!cancelled) {
            setLinkResults(rows.filter((p) => isUnknownBarcode(p.barcode)));
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
        reportImageBase64
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
    if (!barcode.trim()) {
      setFormError(t('add.missingBarcodeBody'));
      return;
    }
    if (!name.trim()) {
      setFormError(t('add.missingNameBody'));
      return;
    }
    if (!rating) {
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
        barcode: barcode.trim(),
        name: name.trim(),
        ingredients: ingredients.trim() || null,
        glutenRating: rating,
        imageBase64: submissionImageBase64,
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

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.guardTitle}>{t('add.signInRequired')}</Text>
        <Text style={styles.guardText}>{t('add.signInRequiredBody')}</Text>
        <Pressable style={styles.guardButton} onPress={() => router.back()}>
          <Text style={styles.guardButtonText}>{t('common.goBack')}</Text>
        </Pressable>
      </View>
    );
  }

  if (isEditing && !isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.guardTitle}>{t('add.adminRequired')}</Text>
        <Text style={styles.guardText}>{t('add.adminRequiredBody')}</Text>
        <Pressable style={styles.guardButton} onPress={() => router.back()}>
          <Text style={styles.guardButtonText}>{t('common.goBack')}</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1B7F3B" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>
          {isEditing ? t('add.editTitle') : t('add.addTitle')}
        </Text>
        <Text style={styles.subheading}>
          {isEditing
            ? t('add.editSubtitle')
            : isAdmin
              ? t('add.addSubtitleAdmin')
              : t('add.addSubtitleUser')}
        </Text>

        {formError && <ErrorText style={styles.formError}>{formError}</ErrorText>}

        <Text style={styles.label}>{t('add.barcode')}</Text>
        <View style={styles.barcodeInputRow}>
          <AppTextInput
            style={[styles.input, styles.barcodeInput]}
            placeholder={t('add.barcodePlaceholder')}
            placeholderTextColor="#9AA0A6"
            keyboardType="number-pad"
            value={barcode}
            onChangeText={setBarcode}
            editable={!initialBarcode}
          />
          {!initialBarcode ? (
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
        {Boolean(initialBarcode) && (
          <Text style={styles.hint}>{t('add.barcodeFromScan')}</Text>
        )}

        <BarcodeCaptureModal
          visible={scanModalVisible}
          onClose={() => setScanModalVisible(false)}
          onCaptured={(code) => {
            setBarcode(code.trim());
            setFormError(null);
          }}
        />
        {!isEditing && (
          <View style={styles.linkCard}>
            <Pressable
              style={styles.linkHeader}
              onPress={() => setLinkSectionOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: linkSectionOpen }}
              accessibilityLabel={t('add.linkTitle')}
            >
              <Text style={styles.linkTitle}>{t('add.linkTitle')}</Text>
              <MaterialCommunityIcons
                name={linkSectionOpen ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#3C4043"
              />
            </Pressable>

            {linkSectionOpen ? (
              <>
                <View style={styles.linkHintWrap}>
                  <Text style={styles.linkHint}>{t('add.linkHint')}</Text>
                </View>

                <AppTextInput
                  style={styles.input}
                  placeholder={t('add.searchName')}
                  placeholderTextColor="#9AA0A6"
                  value={linkQuery}
                  onChangeText={(text) => {
                    setLinkQuery(text);
                    setSelectedLink(null);
                  }}
                  autoCorrect={false}
                  autoCapitalize="none"
                />

                {linkSearching && (
                  <ActivityIndicator style={styles.linkSpinner} color="#1B7F3B" />
                )}

                {linkResults.map((item) => {
                  const selected =
                    selectedLink?.id === item.id &&
                    selectedLink?.catalog === item.catalog;
                  return (
                    <Pressable
                      key={`${item.catalog}-${item.id}`}
                      style={[styles.linkRow, selected && styles.linkRowSelected]}
                      onPress={() => setSelectedLink(item)}
                    >
                      <View style={styles.linkRowText}>
                        <Text style={styles.linkName}>{item.name}</Text>
                        <Text style={styles.linkMeta}>
                          {item.catalog === 'glutenfri' ? t('add.glutenFree') : t('add.containsGluten')} · {t('add.unknownBarcode')}
                        </Text>
                      </View>
                      <GlutenBadge rating={item.glutenRating} />
                    </Pressable>
                  );
                })}

                {!linkSearching && linkQuery.trim().length >= MIN_PRODUCT_SEARCH_CHARS && linkResults.length === 0 && (
                  <Text style={styles.linkEmpty}>{t('add.noMatch')}</Text>
                )}

                <Text style={styles.linkPhotoLabel}>{t('add.photoOptional')}</Text>
                {reportImageBase64 ? (
                  <Image
                    source={{ uri: reportImageBase64 }}
                    style={styles.linkPhotoPreview}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.linkEmpty}>{t('add.noPhoto')}</Text>
                )}
                <View style={styles.linkPhotoRow}>
                  <Pressable
                    style={styles.linkPhotoButton}
                    onPress={() => {
                      void askPickProductImage().then((uri) => {
                        if (uri) setReportImageBase64(uri);
                      });
                    }}
                  >
                    <Text style={styles.linkPhotoButtonText}>
                      {reportImageBase64 ? t('add.changePhoto') : t('add.addPhoto')}
                    </Text>
                  </Pressable>
                  {reportImageBase64 && (
                    <Pressable
                      style={styles.linkPhotoClear}
                      onPress={() => setReportImageBase64(null)}
                    >
                      <Text style={styles.linkPhotoClearText}>{t('add.removePhoto')}</Text>
                    </Pressable>
                  )}
                </View>

                <Pressable
                  style={[
                    styles.linkButton,
                    (!selectedLink || linking || !barcode.trim()) && styles.saveButtonDisabled,
                  ]}
                  disabled={!selectedLink || linking || !barcode.trim()}
                  onPress={() => void handleLinkExisting()}
                >
                  <Text style={styles.saveButtonText}>
                    {linking ? t('add.linking') : t('add.linkButton')}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        )}

        {!isEditing && (
          <Text style={styles.orDivider}>
            {isAdmin ? t('add.orCreate') : t('add.newSubmission')}
          </Text>
        )}

        <Text style={styles.label}>{t('add.productName')}</Text>
        <AppTextInput
          style={styles.input}
          placeholder={t('add.namePlaceholder')}
          placeholderTextColor="#9AA0A6"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>{t('add.ingredients')}</Text>
        <AppTextInput
          style={[styles.input, styles.multiline]}
          placeholder={t('add.ingredientsPlaceholder')}
          placeholderTextColor="#9AA0A6"
          value={ingredients}
          onChangeText={setIngredients}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>{t('add.glutenRating')}</Text>
        {ALL_GLUTEN_RATINGS.map((option) => {
          const meta = getGlutenRatingMeta(option);
          const selected = rating === option;
          return (
            <Pressable
              key={option}
              style={[
                styles.ratingOption,
                {
                  borderColor: selected ? meta.color : '#DADCE0',
                  backgroundColor: selected ? meta.backgroundColor : '#fff',
                },
              ]}
              onPress={() => setRating(option)}
            >
              <View style={[styles.ratingDot, { backgroundColor: meta.color }]} />
              <View style={styles.ratingTextWrap}>
                <Text style={[styles.ratingLabel, { color: meta.color }]}>
                  {t(ratingLabelKey(option))}
                </Text>
                <Text style={styles.ratingDesc}>{t(ratingDescKey(option))}</Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: selected ? meta.color : '#BDC1C6' },
                ]}
              >
                {selected && (
                  <View style={[styles.radioInner, { backgroundColor: meta.color }]} />
                )}
              </View>
            </Pressable>
          );
        })}

        <Text style={styles.label}>
          {!isAdmin ? t('add.photoRequired') : t('add.photoOptional')}
        </Text>
        <View
          style={[
            styles.photoSlot,
            photoMissingError && styles.photoSlotError,
          ]}
        >
          {submissionImageBase64 ? (
            <Image
              source={{ uri: submissionImageBase64 }}
              style={styles.submissionPhotoPreview}
              resizeMode="contain"
            />
          ) : (
            <Text style={[styles.linkEmpty, styles.photoSlotEmpty]}>
              {!isAdmin ? t('add.photoRequiredBody') : t('add.noPhoto')}
            </Text>
          )}
        </View>
        <View style={styles.linkPhotoRow}>
          <Pressable
            style={[
              styles.linkPhotoButton,
              photoMissingError && styles.linkPhotoButtonError,
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
                photoMissingError && styles.linkPhotoButtonTextError,
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
              <Text style={styles.linkPhotoClearText}>{t('add.removePhoto')}</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
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
    backgroundColor: '#F5F6F8',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#202124',
  },
  subheading: {
    fontSize: 14,
    color: '#5F6368',
    marginTop: 4,
    marginBottom: 12,
  },
  formError: {
    marginBottom: 8,
    marginTop: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3C4043',
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#202124',
  },
  barcodeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barcodeInput: {
    flex: 1,
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
    color: '#80868B',
    marginTop: 4,
  },
  linkCard: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DADCE0',
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
    color: '#202124',
  },
  linkHintWrap: {
    width: '100%',
    marginTop: 12,
    marginBottom: 12,
  },
  linkHint: {
    fontSize: 13,
    color: '#5F6368',
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
    borderColor: '#E0E2E6',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkRowSelected: {
    borderColor: '#1B7F3B',
    backgroundColor: '#E4F6E9',
  },
  linkRowText: {
    flex: 1,
    marginRight: 10,
  },
  linkName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#202124',
  },
  linkMeta: {
    fontSize: 12,
    color: '#80868B',
    marginTop: 2,
  },
  linkEmpty: {
    marginTop: 12,
    fontSize: 13,
    color: '#80868B',
  },
  linkPhotoLabel: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '700',
    color: '#3C4043',
  },
  linkPhotoPreview: {
    marginTop: 10,
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: '#F5F6F8',
  },
  photoSlot: {
    marginTop: 10,
    width: '100%',
    minHeight: 160,
    borderRadius: 10,
    backgroundColor: '#F5F6F8',
    borderWidth: 1,
    borderColor: '#DADCE0',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  photoSlotError: {
    borderColor: '#B3261E',
    borderWidth: 2,
    backgroundColor: '#FBE5E4',
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
    borderColor: '#1B7F3B',
    borderRadius: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkPhotoButtonError: {
    borderColor: '#B3261E',
  },
  linkPhotoButtonText: {
    color: '#1B7F3B',
    fontWeight: '700',
    fontSize: 16,
  },
  linkPhotoButtonTextError: {
    color: '#B3261E',
  },
  linkPhotoClear: {
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  linkPhotoClearText: {
    color: '#B3261E',
    fontWeight: '600',
    fontSize: 14,
  },
  linkButton: {
    marginTop: 14,
    backgroundColor: '#1B7F3B',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  orDivider: {
    marginTop: 22,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#5F6368',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  ratingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  ratingTextWrap: {
    flex: 1,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  ratingDesc: {
    fontSize: 13,
    color: '#5F6368',
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: '#1B7F3B',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#A8C7B4',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  guardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 8,
  },
  guardText: {
    fontSize: 14,
    color: '#5F6368',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  guardButton: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#1B7F3B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  guardButtonText: {
    color: '#1B7F3B',
    fontWeight: '700',
    fontSize: 15,
  },
});
