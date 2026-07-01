import {
  BarcodeScanningResult,
  BarcodeType,
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthContext';

const BARCODE_TYPES: BarcodeType[] = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'qr',
];

export default function ScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAdmin, authEnabled, signOut } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();

  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [lastType, setLastType] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');

  // Prevents the camera from firing many navigations for one physical scan.
  const lockRef = useRef(false);

  // Re-arm scanning whenever the screen regains focus (e.g. after going to result).
  useFocusEffect(
    useCallback(() => {
      lockRef.current = false;
      return () => {
        lockRef.current = true;
      };
    }, [])
  );

  const goToResult = useCallback(
    (barcode: string) => {
      const trimmed = barcode.trim();
      if (!trimmed) return;
      router.push({ pathname: '/result', params: { barcode: trimmed } });
    },
    [router]
  );

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setLastBarcode(result.data);
      setLastType(result.type);
      goToResult(result.data);
    },
    [goToResult]
  );

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.infoText}>Checking camera permission...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {permission.granted ? (
        <View style={styles.cameraWrapper}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.reticle} />
            <Text style={styles.overlayHint}>Point the camera at a barcode</Text>
          </View>
        </View>
      ) : (
        <View style={styles.cameraWrapper}>
          <View style={[styles.centered, styles.noCamera]}>
            <Text style={styles.noCameraTitle}>Camera access needed</Text>
            <Text style={styles.infoText}>
              Grant camera access to scan grocery barcodes.
            </Text>
            <Pressable style={styles.primaryButton} onPress={requestPermission}>
              <Text style={styles.primaryButtonText}>Grant camera access</Text>
            </Pressable>
            {Platform.OS === 'ios' && (
              <Text style={styles.simulatorNote}>
                The iOS Simulator has no camera. Use the manual entry below to test.
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Dev readout: always show the last barcode the camera saw. */}
      <View style={styles.devPanel}>
        <Text style={styles.devLabel}>Last scanned barcode (dev)</Text>
        <Text style={styles.devValue}>{lastBarcode ?? '—'}</Text>
        {lastType && <Text style={styles.devType}>type: {lastType}</Text>}
      </View>

      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.manualLabel}>Manual entry (fallback)</Text>
        <View style={styles.manualRow}>
          <TextInput
            style={styles.input}
            placeholder="Enter barcode digits"
            placeholderTextColor="#9AA0A6"
            keyboardType="number-pad"
            value={manualBarcode}
            onChangeText={setManualBarcode}
            onSubmitEditing={() => goToResult(manualBarcode)}
            returnKeyType="search"
          />
          <Pressable
            style={[
              styles.lookupButton,
              !manualBarcode.trim() && styles.lookupButtonDisabled,
            ]}
            disabled={!manualBarcode.trim()}
            onPress={() => goToResult(manualBarcode)}
          >
            <Text style={styles.lookupButtonText}>Look up</Text>
          </Pressable>
        </View>

        <View style={styles.linksRow}>
          {isAdmin && (
            <Link href="/add" style={styles.linkButton}>
              <Text style={styles.linkButtonText}>+ Add product</Text>
            </Link>
          )}
          <Link href="/products" style={styles.linkButton}>
            <Text style={styles.linkButtonText}>All products</Text>
          </Link>
        </View>

        {authEnabled && (
          <View style={styles.accountRow}>
            <Text style={styles.accountText}>
              Signed in as {user?.username ?? 'user'}
              {isAdmin ? ' · Admin' : ''}
            </Text>
            <Pressable onPress={signOut} hitSlop={8}>
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1115',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cameraWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  overlayHint: {
    marginTop: 16,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  noCamera: {
    backgroundColor: '#1A1D22',
  },
  noCameraTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoText: {
    color: '#C7CBD1',
    fontSize: 14,
    textAlign: 'center',
  },
  simulatorNote: {
    marginTop: 16,
    color: '#8A9099',
    fontSize: 12,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#1B7F3B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  devPanel: {
    backgroundColor: '#181B20',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2E35',
  },
  devLabel: {
    color: '#8A9099',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devValue: {
    color: '#4CD787',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  devType: {
    color: '#8A9099',
    fontSize: 12,
    marginTop: 2,
  },
  bottomPanel: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  manualLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5F6368',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#202124',
    marginRight: 10,
  },
  lookupButton: {
    backgroundColor: '#1B7F3B',
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupButtonDisabled: {
    backgroundColor: '#A8C7B4',
  },
  lookupButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  linkButton: {
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#1B7F3B',
    borderRadius: 10,
    paddingVertical: 12,
    textAlign: 'center',
    color: '#1B7F3B',
    fontWeight: '700',
    overflow: 'hidden',
  },
  linkButtonText: {
    color: '#1B7F3B',
    fontWeight: '700',
    textAlign: 'center',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  accountText: {
    fontSize: 13,
    color: '#5F6368',
    flex: 1,
  },
  logoutText: {
    fontSize: 14,
    color: '#B3261E',
    fontWeight: '700',
  },
});
