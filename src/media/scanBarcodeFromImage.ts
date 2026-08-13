import { scanFromURLAsync } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import jpeg from 'jpeg-js';

import { SCANNER_BARCODE_TYPES } from '../components/ScannerCamera';

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

/**
 * Keep enough pixels for 1D bars to stay readable across the whole frame.
 * 720 was too aggressive and often wiped fine EAN lines.
 */
const SCAN_MAX_EDGE = 1600;
const SCAN_JPEG_QUALITY = 0.92;

type CropRect = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

/** Accept grocery-style 1D codes only; reject QR and other 2D formats. */
export function normalizeProductBarcode(
  raw: string,
  typeHint?: string
): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;

  const hint = (typeHint ?? '').toLowerCase();
  const is2d =
    hint.includes('qr') ||
    hint.includes('pdf417') ||
    hint.includes('aztec') ||
    hint.includes('datamatrix') ||
    hint.includes('data_matrix');
  if (is2d) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 8 && digits.length <= 14) {
    return digits;
  }

  return null;
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

function zxingFormats(zx: ZXingNamespace): unknown[] {
  return [
    zx.BarcodeFormat.EAN_13,
    zx.BarcodeFormat.EAN_8,
    zx.BarcodeFormat.UPC_A,
    zx.BarcodeFormat.UPC_E,
    zx.BarcodeFormat.CODE_128,
    zx.BarcodeFormat.CODE_39,
    zx.BarcodeFormat.CODE_93,
    zx.BarcodeFormat.ITF,
    zx.BarcodeFormat.CODABAR,
  ];
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
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, zxingFormats(ZXing));
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints);
    const result = reader.decode(bitmap);
    return normalizeProductBarcode(result.getText());
  } catch {
    return null;
  }
}

async function tryNativeScan(uri: string): Promise<string | null> {
  try {
    // Same barcode types as CameraView on the home scanner.
    const hits = await scanFromURLAsync(uri, SCANNER_BARCODE_TYPES);
    for (const hit of hits) {
      const normalized = normalizeProductBarcode(hit.data, hit.type);
      if (normalized) return normalized;
    }
  } catch {
    // ignore
  }
  return null;
}

async function tryDecodeUri(
  uri: string,
  base64?: string | null
): Promise<string | null> {
  const native = await tryNativeScan(uri);
  if (native) return native;
  if (base64) {
    const zxing = decodeWithZxing(base64);
    if (zxing) return zxing;
  }
  return null;
}

function resizeActions(width?: number, height?: number): ImageManipulator.Action[] {
  const w = width && width > 0 ? width : SCAN_MAX_EDGE;
  const h = height && height > 0 ? height : SCAN_MAX_EDGE;
  const longest = Math.max(w, h);
  if (longest <= SCAN_MAX_EDGE) {
    return [];
  }
  return w >= h
    ? [{ resize: { width: SCAN_MAX_EDGE } }]
    : [{ resize: { height: SCAN_MAX_EDGE } }];
}

/**
 * Overlapping tiles that together cover the entire image so a barcode
 * anywhere (center, edge, corner) gets a closer pass.
 */
function fullCoverageCrops(width: number, height: number): CropRect[] {
  if (width < 48 || height < 48) return [];

  const crops: CropRect[] = [];
  const push = (originX: number, originY: number, w: number, h: number) => {
    const x = Math.max(0, Math.floor(originX));
    const y = Math.max(0, Math.floor(originY));
    const cw = Math.min(width - x, Math.floor(w));
    const ch = Math.min(height - y, Math.floor(h));
    if (cw < 40 || ch < 40) return;
    crops.push({ originX: x, originY: y, width: cw, height: ch });
  };

  // 3×3 grid with overlap (~55% tile size, stepped by ~40%).
  const tileW = Math.max(80, Math.floor(width * 0.55));
  const tileH = Math.max(80, Math.floor(height * 0.55));
  const stepX = Math.max(40, Math.floor(width * 0.4));
  const stepY = Math.max(40, Math.floor(height * 0.4));

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      push(x, y, tileW, tileH);
    }
  }

  // Always include full-height left / center / right strips (tall barcodes).
  const stripW = Math.max(80, Math.floor(width * 0.5));
  push(0, 0, stripW, height);
  push((width - stripW) / 2, 0, stripW, height);
  push(width - stripW, 0, stripW, height);

  // Full-width top / middle / bottom bands.
  const bandH = Math.max(80, Math.floor(height * 0.45));
  push(0, 0, width, bandH);
  push(0, (height - bandH) / 2, width, bandH);
  push(0, height - bandH, width, bandH);

  return crops;
}

/**
 * Scan the whole photo for a product barcode (native expo-camera + ZXing).
 * Tries the full frame first, then overlapping tiles across the entire image.
 */
export async function scanBarcodeFromImageUri(
  uri: string,
  options?: { width?: number; height?: number }
): Promise<string | null> {
  if (!uri?.trim()) return null;

  // 1) Native scan on the original file first (best fidelity).
  const fromOriginal = await tryNativeScan(uri);
  if (fromOriginal) return fromOriginal;

  // 2) Bounded working copy of the FULL image (not a side/middle crop).
  let full: ImageManipulator.ImageResult;
  try {
    full = await ImageManipulator.manipulateAsync(
      uri,
      resizeActions(options?.width, options?.height),
      {
        compress: SCAN_JPEG_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );
  } catch {
    return null;
  }
  if (!full.base64) return null;

  const fromFull = await tryDecodeUri(full.uri, full.base64);
  if (fromFull) return fromFull;

  // 3) Walk overlapping tiles that cover every part of the image.
  for (const crop of fullCoverageCrops(full.width, full.height)) {
    try {
      const tile = await ImageManipulator.manipulateAsync(
        full.uri,
        [{ crop }],
        {
          compress: SCAN_JPEG_QUALITY,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
      if (!tile.base64) continue;
      const hit = await tryDecodeUri(tile.uri, tile.base64);
      if (hit) return hit;
    } catch {
      // try next tile
    }
  }

  return null;
}

/** Race barcode scan against a timeout so the UI never hangs. */
export function scanBarcodeFromImageUriWithTimeout(
  uri: string,
  options?: { width?: number; height?: number; timeoutMs?: number }
): Promise<string | null> {
  // Full-frame + tile walk needs more headroom than the old bottom-only crop.
  const timeoutMs = options?.timeoutMs ?? 12000;
  return Promise.race([
    scanBarcodeFromImageUri(uri, options).catch(() => null),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}
