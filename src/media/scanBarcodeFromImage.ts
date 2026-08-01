import { BarcodeType, scanFromURLAsync } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import jpeg from 'jpeg-js';

// Vendored UMD build — Metro cannot resolve @zxing/library package exports.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ZXing = require('../vendor/zxing.min.js') as ZXingNamespace;

type ZXingNamespace = {
  MultiFormatReader: new () => {
    setHints: (hints: Map<unknown, unknown>) => void;
    decode: (bitmap: unknown) => { getText: () => string; getBarcodeFormat: () => number };
  };
  BinaryBitmap: new (binarizer: unknown) => unknown;
  HybridBinarizer: new (source: unknown) => unknown;
  RGBLuminanceSource: new (
    luminances: Uint8ClampedArray,
    width: number,
    height: number
  ) => unknown;
  DecodeHintType: { POSSIBLE_FORMATS: unknown; TRY_HARDER: unknown };
  BarcodeFormat: {
    EAN_13: unknown;
    EAN_8: unknown;
    UPC_A: unknown;
    UPC_E: unknown;
    CODE_128: unknown;
    CODE_39: unknown;
    CODE_93: unknown;
    ITF: unknown;
    CODABAR: unknown;
  };
};

/** Keep barcode decode cheap on-device. */
const SCAN_MAX_EDGE = 720;

const PRODUCT_BARCODE_TYPES: BarcodeType[] = [
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
];

/** Keep grocery-style codes; ignore random QR/URL payloads. */
export function normalizeProductBarcode(
  raw: string,
  typeHint?: string
): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;

  const hint = (typeHint ?? '').toLowerCase();
  const digits = trimmed.replace(/\D/g, '');

  const is2d =
    hint.includes('qr') ||
    hint.includes('pdf417') ||
    hint.includes('aztec') ||
    hint.includes('datamatrix') ||
    hint.includes('data_matrix');

  if (is2d) {
    if (digits.length >= 8 && digits.length <= 14 && /^\d+$/.test(trimmed)) {
      return digits;
    }
    return null;
  }

  if (digits.length >= 8 && digits.length <= 14) {
    return digits;
  }

  return null;
}

function isValidGtinChecksum(digits: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(digits)) return false;
  const body = digits.slice(0, -1);
  const check = Number(digits.slice(-1));
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const n = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  return (10 - (sum % 10)) % 10 === check;
}

/** Pull a product barcode from OCR text locally (no extra network call). */
export function extractBarcodeFromOcrText(ocrText: string): string | null {
  if (!ocrText?.trim()) return null;
  const matches = ocrText.match(/\d[\d\s]{6,18}\d/g) ?? [];
  const candidates: string[] = [];
  for (const match of matches) {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 14) continue;
    candidates.push(digits);
  }

  const ordered = [...new Set(candidates)].sort((a, b) => {
    const score = (d: string) =>
      (isValidGtinChecksum(d) ? 100 : 0) + (d.length === 13 ? 10 : d.length);
    return score(b) - score(a);
  });

  for (const digits of ordered) {
    if (isValidGtinChecksum(digits)) return digits;
  }
  return ordered.find((d) => d.length >= 8 && d.length <= 14) ?? null;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const cleaned = base64.replace(/^data:image\/\w+;base64,/, '').replace(/\s/g, '');
  const binary = globalThis.atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function rgbaToLuminances(rgba: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const luminances = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < luminances.length; i++, j += 4) {
    const r = rgba[j] ?? 0;
    const g = rgba[j + 1] ?? 0;
    const b = rgba[j + 2] ?? 0;
    luminances[i] = ((r + g + g + b) / 4) & 0xff;
  }
  return luminances;
}

function decodeWithZxing(base64Jpeg: string): string | null {
  try {
    if (!ZXing?.MultiFormatReader) return null;
    const jpegBytes = base64ToUint8Array(base64Jpeg);
    const decoded = jpeg.decode(jpegBytes, { useTArray: true });
    if (!decoded.width || !decoded.height || !decoded.data?.length) return null;

    const luminances = rgbaToLuminances(
      decoded.data as Uint8Array,
      decoded.width,
      decoded.height
    );
    const source = new ZXing.RGBLuminanceSource(
      luminances,
      decoded.width,
      decoded.height
    );
    const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source));
    const reader = new ZXing.MultiFormatReader();
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.UPC_E,
      ZXing.BarcodeFormat.CODE_128,
    ]);
    reader.setHints(hints);
    const result = reader.decode(bitmap);
    return normalizeProductBarcode(result.getText());
  } catch {
    return null;
  }
}

async function tryNativeScan(uri: string): Promise<string | null> {
  try {
    const hits = await scanFromURLAsync(uri, PRODUCT_BARCODE_TYPES);
    for (const hit of hits) {
      const normalized = normalizeProductBarcode(hit.data, hit.type);
      if (normalized) return normalized;
    }
  } catch {
    // ignore
  }
  return null;
}

function resizeActions(width?: number, height?: number): ImageManipulator.Action[] {
  const w = width && width > 0 ? width : SCAN_MAX_EDGE;
  const h = height && height > 0 ? height : SCAN_MAX_EDGE;
  const longest = Math.max(w, h);
  if (longest <= SCAN_MAX_EDGE) {
    // Still force a bounded resize so we never feed a huge decode buffer.
    return w >= h
      ? [{ resize: { width: Math.min(w, SCAN_MAX_EDGE) } }]
      : [{ resize: { height: Math.min(h, SCAN_MAX_EDGE) } }];
  }
  return w >= h
    ? [{ resize: { width: SCAN_MAX_EDGE } }]
    : [{ resize: { height: SCAN_MAX_EDGE } }];
}

/**
 * Scale the photo down first, then scan locally.
 * Never runs barcode decode on the full-resolution original.
 */
export async function scanBarcodeFromImageUri(
  uri: string,
  options?: { width?: number; height?: number }
): Promise<string | null> {
  if (!uri?.trim()) return null;

  // 1) Downscale first (cheap native step) — required before any decode.
  let small: ImageManipulator.ImageResult;
  try {
    small = await ImageManipulator.manipulateAsync(
      uri,
      resizeActions(options?.width, options?.height),
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );
  } catch {
    return null;
  }
  if (!small.base64) return null;

  // 2) Fast native scan on the small JPEG file.
  const native = await tryNativeScan(small.uri);
  if (native) return native;

  // 3) One ZXing pass on the already-small image (no full-res path).
  const zxing = decodeWithZxing(small.base64);
  if (zxing) return zxing;

  // 4) One bottom crop on the small image only (barcodes are often at the bottom).
  if (small.width > 40 && small.height > 40) {
    const cropHeight = Math.max(100, Math.floor(small.height * 0.4));
    const cropY = Math.max(0, small.height - cropHeight);
    try {
      const cropped = await ImageManipulator.manipulateAsync(
        small.uri,
        [
          {
            crop: {
              originX: 0,
              originY: cropY,
              width: small.width,
              height: cropHeight,
            },
          },
        ],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
      if (cropped.base64) {
        const nativeCrop = await tryNativeScan(cropped.uri);
        if (nativeCrop) return nativeCrop;
        const zxingCrop = decodeWithZxing(cropped.base64);
        if (zxingCrop) return zxingCrop;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/** Race barcode scan against a timeout so the UI never hangs. */
export function scanBarcodeFromImageUriWithTimeout(
  uri: string,
  options?: { width?: number; height?: number; timeoutMs?: number }
): Promise<string | null> {
  const timeoutMs = options?.timeoutMs ?? 2500;
  return Promise.race([
    scanBarcodeFromImageUri(uri, options).catch(() => null),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}
