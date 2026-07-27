import {
  AvailableLenses,
  BarcodeScanningResult,
  BarcodeType,
  CameraView,
} from 'expo-camera';
import { memo, useCallback, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

export const SCANNER_BARCODE_TYPES: BarcodeType[] = [
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

type ScannerCameraProps = {
  active: boolean;
  onBarcodeScanned?: (result: BarcodeScanningResult) => void;
  onCameraReady?: () => void;
};

/**
 * expo-camera matches `selectedLens` to each lens's *localizedName*
 * (e.g. "Back Camera"), not Apple device-type ids like
 * `builtInWideAngleCamera`. Without a real match, iOS falls back to the
 * system-preferred camera — often the 0.5× ultra-wide.
 */
function pickOneXLens(lenses: string[]): string | undefined {
  if (lenses.length === 0) return undefined;

  const isExcluded = (name: string) =>
    /ultra|tele|dual|triple|lidar|true\s*depth|continuity|0\s*[.,]\s*5/i.test(
      name
    );

  const candidates = lenses.filter((name) => !isExcluded(name));
  if (candidates.length === 0) return lenses[0];

  // Prefer an explicit wide-angle label when present.
  const wide = candidates.find((name) => /wide/i.test(name));
  if (wide) return wide;

  // Typical default: "Back Camera" / "Bakre kamera" / similar short names.
  const plainBack = candidates.find((name) =>
    /^(back|bakre|rear)\b/i.test(name.trim())
  );
  if (plainBack) return plainBack;

  return candidates[0];
}

/**
 * Shared preview used by the home scanner and fullscreen barcode capture.
 * Isolated + memoized so overlay re-renders (hold-to-scan) do not restart
 * the native session / reset zoom & continuous autofocus.
 */
export const ScannerCamera = memo(function ScannerCamera({
  active,
  onBarcodeScanned,
  onCameraReady,
}: ScannerCameraProps) {
  const [selectedLens, setSelectedLens] = useState<string | undefined>();

  const handleAvailableLenses = useCallback((event: AvailableLenses) => {
    if (Platform.OS !== 'ios') return;
    const next = pickOneXLens(event.lenses ?? []);
    if (!next) return;
    setSelectedLens((prev) => (prev === next ? prev : next));
  }, []);

  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      facing="back"
      active={active}
      zoom={0}
      // Expo naming is inverted vs intuition: "off" = continuous autofocus;
      // "on" = focus once then lock (bad for barcode scanning).
      autofocus="off"
      selectedLens={selectedLens}
      onAvailableLensesChanged={handleAvailableLenses}
      barcodeScannerSettings={{ barcodeTypes: SCANNER_BARCODE_TYPES }}
      onBarcodeScanned={onBarcodeScanned}
      onCameraReady={onCameraReady}
      pointerEvents="none"
    />
  );
});
