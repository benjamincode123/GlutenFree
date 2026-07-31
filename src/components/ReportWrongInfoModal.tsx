import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getAuthToken } from '../auth/session';
import type { FavoriteProductRef } from '../data/authApi';
import { getProductRepository } from '../data/repository';
import { userFacingError } from '../errors/userFacingError';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';
import { AppTextInput } from './KeyboardDismissBar';
import { ErrorText } from './ErrorText';

const SHEET_SLIDE = Math.round(Dimensions.get('window').height * 0.42);

interface ReportWrongInfoModalProps {
  visible: boolean;
  product: FavoriteProductRef | null;
  productName?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function ReportWrongInfoModal({
  visible,
  product,
  productName,
  onClose,
  onSubmitted,
}: ReportWrongInfoModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [emne, setEmne] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [modalVisible, setModalVisible] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_SLIDE)).current;
  const signedIn = !!getAuthToken();

  useEffect(() => {
    if (visible) {
      setEmne('');
      setComment('');
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

  async function handleSubmit() {
    setError(null);
    if (!product) return;
    if (!signedIn) {
      setError(t('result.signInToReportWrongInfo'));
      return;
    }
    const subject = emne.trim();
    const body = comment.trim();
    if (subject.length < 3) {
      setError(t('result.wrongInfoEmneShort'));
      return;
    }
    if (body.length < 5) {
      setError(t('result.wrongInfoCommentShort'));
      return;
    }

    setSubmitting(true);
    try {
      await getProductRepository().reportWrongInfo(
        product.catalog,
        product.id,
        subject,
        body
      );
      onSubmitted?.();
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
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              transform: [{ translateY: sheetTranslateY }],
              marginBottom: keyboardHeight > 0 ? Math.max(0, keyboardHeight - 12) : 0,
            },
          ]}
        >
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="bullhorn-outline" size={28} color={colors.textSecondary} />
            <Text style={[styles.title, { color: colors.text }]}>
              {t('result.reportWrongInfo')}
            </Text>
          </View>
          {productName ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
              {productName}
            </Text>
          ) : null}

          {!signedIn ? (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t('result.signInToReportWrongInfo')}
            </Text>
          ) : (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('result.wrongInfoEmne')}
              </Text>
              <AppTextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder={t('result.wrongInfoEmnePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={emne}
                onChangeText={setEmne}
                maxLength={200}
                editable={!submitting}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('result.wrongInfoComment')}
              </Text>
              <AppTextInput
                style={[
                  styles.input,
                  styles.commentInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder={t('result.wrongInfoCommentPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={comment}
                onChangeText={setComment}
                multiline
                textAlignVertical="top"
                maxLength={4000}
                editable={!submitting}
              />

              {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}

              <Pressable
                style={[
                  styles.submit,
                  { backgroundColor: colors.primary },
                  submitting && styles.submitDisabled,
                ]}
                onPress={() => void handleSubmit()}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.submitText, { color: colors.onPrimary }]}>
                    {t('result.wrongInfoSubmit')}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingBottom: 28,
    paddingTop: 10,
    maxHeight: '88%',
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    marginLeft: '40%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
  },
  commentInput: {
    minHeight: 110,
  },
  error: {
    marginTop: 10,
    fontSize: 14,
  },
  submit: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
