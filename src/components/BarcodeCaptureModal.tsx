import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  BarcodeScanningResult,
  BarcodeType,
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';

const BARCODE_TYPES: BarcodeType[] = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
  'codabar',
  'qr',
  'pdf417',
  'aztec',
  'datamatrix',
];

interface BarcodeCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onCaptured: (barcode: string) => void;
}

export function BarcodeCaptureModal({
  visible,
  onClose,
  onCaptured,
}: BarcodeCaptureModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [holding, setHolding] = useState(false);
  const lockRef = useRef(false);
  const holdingRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      lockRef.current = false;
      holdingRef.current = false;
      setHolding(false);
      return;
    }
    lockRef.current = false;
    holdingRef.current = false;
    setHolding(false);
  }, [visible]);

  const handleScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (!holdingRef.current || lockRef.current) return;
      const value = result.data?.trim();
      if (!value) return;
      lockRef.current = true;
      holdingRef.current = false;
      setHolding(false);
      onCaptured(value);
      onClose();
    },
    [onCaptured, onClose]
  );

  const startHold = useCallback(() => {
    if (lockRef.current) return;
    holdingRef.current = true;
    setHolding(true);
  }, []);

  const stopHold = useCallback(() => {
    holdingRef.current = false;
    setHolding(false);
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: '#0F1115' }]}>
        {permission?.granted && visible ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              zoom={0}
              // "off" = continuous autofocus; "on" locks after first focus.
              autofocus="off"
              barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
              onBarcodeScanned={handleScanned}
              pointerEvents="none"
            />
            <View style={styles.overlay} pointerEvents="box-none">
              <View style={styles.reticle} pointerEvents="none" />
              <Text style={styles.hint} pointerEvents="none">
                {holding ? t('scanner.scanning') : t('scanner.holdToScan')}
              </Text>
              <View style={[styles.scanButtonWrap, { bottom: insets.bottom + 28 }]}>
                <Pressable
                  onPressIn={startHold}
                  onPressOut={stopHold}
                  accessibilityRole="button"
                  accessibilityLabel={t('scanner.holdA11y')}
                  style={({ pressed }) => [
                    styles.scanButton,
                    (pressed || holding) && styles.scanButtonActive,
                  ]}
                >
                  <MaterialCommunityIcons name="barcode-scan" size={36} color="#fff" />
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionTitle}>{t('scanner.cameraNeeded')}</Text>
            <Text style={styles.permissionBody}>{t('scanner.cameraHint')}</Text>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => void requestPermission()}
            >
              <Text style={styles.primaryButtonText}>{t('scanner.grantCamera')}</Text>
            </Pressable>
            {Platform.OS === 'ios' && (
              <Text style={styles.simNote}>{t('scanner.simulatorNote')}</Text>
            )}
          </View>
        )}

        <Pressable
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={onClose}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="close" size={26} color="#fff" />
          <Text style={styles.closeText}>{t('common.back')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  cameraWrap: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: 240,
    height: 150,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
  },
  hint: {
    marginTop: 16,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  scanButtonWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scanButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(27, 127, 59, 0.92)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonActive: {
    backgroundColor: '#149A45',
    transform: [{ scale: 0.94 }],
    borderColor: '#fff',
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  permissionBody: {
    color: '#C7CBD1',
    fontSize: 14,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  simNote: {
    marginTop: 16,
    color: '#8A9099',
    fontSize: 12,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  closeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
