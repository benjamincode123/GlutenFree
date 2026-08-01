import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';

const TUTORIAL_IMAGE = require('../../assets/scan-with-ai-tutorial.png');
const SCREEN = Dimensions.get('window');
const IMAGE_MAX_HEIGHT = Math.round(SCREEN.height * 0.48);

interface ScanWithAiTutorialModalProps {
  visible: boolean;
  onClose: () => void;
  onContinue: () => void;
}

export function ScanWithAiTutorialModal({
  visible,
  onClose,
  onContinue,
}: ScanWithAiTutorialModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.background,
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('add.scanWithAiTutorialTitle')}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('add.scanWithAiTutorialCancel')}
          >
            <MaterialCommunityIcons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.lead, { color: colors.textSecondary }]}>
            {t('add.scanWithAiTutorialLead')}
          </Text>

          <View style={styles.imageBleed}>
            <Pressable
              onPress={() => setFullscreen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('add.scanWithAiTutorialFullscreen')}
            >
              <Image
                source={TUTORIAL_IMAGE}
                style={styles.image}
                resizeMode="cover"
                accessibilityLabel={t('add.scanWithAiTutorialImageA11y')}
              />
              <View style={styles.fullscreenFab}>
                <MaterialCommunityIcons
                  name="fullscreen"
                  size={22}
                  color="#fff"
                />
                <Text style={styles.fullscreenFabText}>
                  {t('add.scanWithAiTutorialFullscreen')}
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.tips}>
            <TipRow
              icon="factory"
              color={colors.primary}
              textColor={colors.text}
              text={t('add.scanWithAiTutorialTipProducer')}
            />
            <TipRow
              icon="format-list-bulleted"
              color={colors.primary}
              textColor={colors.text}
              text={t('add.scanWithAiTutorialTipNameIngredients')}
            />
            <TipRow
              icon="magnify"
              color={colors.primary}
              textColor={colors.text}
              text={t('add.scanWithAiTutorialTipClarity')}
            />
            <TipRow
              icon="ruler"
              color={colors.primary}
              textColor={colors.text}
              text={t('add.scanWithAiTutorialTipDistance')}
            />
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              {t('add.scanWithAiTutorialCancel')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={onContinue}
          >
            <MaterialCommunityIcons
              name="camera"
              size={20}
              color={colors.onPrimary}
            />
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
              {t('add.scanWithAiTutorialContinue')}
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={fullscreen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setFullscreen(false)}
      >
        <View
          style={[
            styles.fullscreenRoot,
            {
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View style={styles.fullscreenHeader}>
            <Text style={styles.fullscreenTitle}>
              {t('add.scanWithAiTutorialFullscreen')}
            </Text>
            <Pressable
              onPress={() => setFullscreen(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('add.scanWithAiTutorialCloseFullscreen')}
            >
              <MaterialCommunityIcons name="close" size={28} color="#fff" />
            </Pressable>
          </View>
          <Image
            source={TUTORIAL_IMAGE}
            style={styles.fullscreenImage}
            resizeMode="contain"
            accessibilityLabel={t('add.scanWithAiTutorialImageA11y')}
          />
          <Pressable
            style={styles.fullscreenCloseButton}
            onPress={() => setFullscreen(false)}
          >
            <Text style={styles.fullscreenCloseButtonText}>
              {t('add.scanWithAiTutorialCloseFullscreen')}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </Modal>
  );
}

function TipRow({
  icon,
  color,
  textColor,
  text,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
  textColor: string;
  text: string;
}) {
  return (
    <View style={styles.tipRow}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />
      <Text style={[styles.tipText, { color: textColor }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    paddingRight: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  imageBleed: {
    marginHorizontal: -20,
    width: SCREEN.width,
    height: IMAGE_MAX_HEIGHT,
    backgroundColor: '#111',
  },
  image: {
    width: SCREEN.width,
    height: IMAGE_MAX_HEIGHT,
  },
  fullscreenFab: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  fullscreenFabText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  tips: {
    marginTop: 12,
    gap: 10,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  fullscreenRoot: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 12,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fullscreenTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  fullscreenImage: {
    flex: 1,
    width: '100%',
  },
  fullscreenCloseButton: {
    alignSelf: 'center',
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenCloseButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
