import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

/** Max decoded image size accepted for uploads. */
export const MAX_PRODUCT_IMAGE_BYTES = 1 * 1024 * 1024;

/** Longest side after resize — enough for product review, keeps payloads small. */
const MAX_IMAGE_EDGE = 1280;

function estimateDecodedBytes(base64Payload: string): number {
  const cleaned = base64Payload.replace(/\s/g, '');
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);
}

/**
 * Resize + JPEG-compress until at or under {@link MAX_PRODUCT_IMAGE_BYTES}.
 */
async function compressToMaxBytes(
  uri: string,
  sourceWidth?: number,
  sourceHeight?: number
): Promise<string | null> {
  const hasSize = Boolean(sourceWidth && sourceHeight);
  const longest = hasSize
    ? Math.max(sourceWidth!, sourceHeight!)
    : MAX_IMAGE_EDGE;
  let maxEdge = Math.min(MAX_IMAGE_EDGE, longest);
  const qualities = [0.72, 0.58, 0.45, 0.35, 0.25];

  for (let pass = 0; pass < 6; pass++) {
    for (const quality of qualities) {
      const needsResize = !hasSize || maxEdge < longest;
      const actions: ImageManipulator.Action[] = needsResize
        ? hasSize && sourceWidth! >= sourceHeight!
          ? [{ resize: { width: maxEdge } }]
          : hasSize
            ? [{ resize: { height: maxEdge } }]
            : [{ resize: { width: maxEdge } }]
        : [];

      const result = await ImageManipulator.manipulateAsync(uri, actions, {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });

      if (!result.base64) {
        continue;
      }

      const bytes = estimateDecodedBytes(result.base64);
      if (bytes <= MAX_PRODUCT_IMAGE_BYTES) {
        return `data:image/jpeg;base64,${result.base64}`;
      }
    }
    // Still too large — shrink dimensions and retry.
    maxEdge = Math.max(480, Math.floor(maxEdge * 0.75));
  }

  return null;
}

export type PickedProductImage = {
  /** Compressed JPEG data-URI for upload / OCR. */
  dataUri: string;
  /** Original local file URI (best for on-device barcode scan). */
  localUri: string;
  width?: number;
  height?: number;
};

async function pickProductImageAsset(
  source: 'camera' | 'library'
): Promise<ImagePicker.ImagePickerAsset | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to photograph the product.');
      return null;
    }
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to upload a product image.');
      return null;
    }
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.8,
    // Prefer URI + manipulate; base64 from picker can be huge before we compress.
    base64: false,
    exif: false,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset.uri) {
    Alert.alert('Could not read image', 'Try another photo.');
    return null;
  }

  return asset;
}

/**
 * Opens camera or gallery and returns a compressed JPEG data-URI, or null if cancelled.
 */
export async function pickProductImage(
  source: 'camera' | 'library'
): Promise<string | null> {
  const picked = await pickProductImageDetailed(source);
  return picked?.dataUri ?? null;
}

/** Same as {@link pickProductImage}, but also returns the original local URI. */
export async function pickProductImageDetailed(
  source: 'camera' | 'library'
): Promise<PickedProductImage | null> {
  const asset = await pickProductImageAsset(source);
  if (!asset) return null;

  try {
    const dataUri = await compressToMaxBytes(
      asset.uri,
      asset.width,
      asset.height
    );
    if (!dataUri) {
      Alert.alert(
        'Image too large',
        'Could not compress this photo under 1 MB. Try another photo.'
      );
      return null;
    }
    return {
      dataUri,
      localUri: asset.uri,
      width: asset.width,
      height: asset.height,
    };
  } catch {
    Alert.alert('Could not process image', 'Try another photo.');
    return null;
  }
}

export function askPickProductImage(options?: {
  title?: string;
  message?: string;
}): Promise<string | null> {
  const title = options?.title ?? 'Product photo';
  const message =
    options?.message ?? 'Add a photo of the product for review (max 1 MB).';
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      {
        text: 'Camera',
        onPress: () => {
          void pickProductImage('camera').then(resolve);
        },
      },
      {
        text: Platform.OS === 'ios' ? 'Photo Library' : 'Gallery',
        onPress: () => {
          void pickProductImage('library').then(resolve);
        },
      },
    ]);
  });
}

/** Ingredients-label photo for OCR + local barcode scan (still compressed to max 1 MB). */
export function askPickIngredientsOcrImage(
  title: string,
  message: string
): Promise<PickedProductImage | null> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      {
        text: 'Camera',
        onPress: () => {
          void pickProductImageDetailed('camera').then(resolve);
        },
      },
      {
        text: Platform.OS === 'ios' ? 'Photo Library' : 'Gallery',
        onPress: () => {
          void pickProductImageDetailed('library').then(resolve);
        },
      },
    ]);
  });
}

export function askPickProfileImage(): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert('Profile photo', 'Choose a photo (max 1 MB).', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      {
        text: 'Camera',
        onPress: () => {
          void pickProductImage('camera').then(resolve);
        },
      },
      {
        text: Platform.OS === 'ios' ? 'Photo Library' : 'Gallery',
        onPress: () => {
          void pickProductImage('library').then(resolve);
        },
      },
    ]);
  });
}
