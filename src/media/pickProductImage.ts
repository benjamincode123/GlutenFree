import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

/** Max decoded image size accepted for uploads. */
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

function estimateDecodedBytes(base64Payload: string): number {
  const cleaned = base64Payload.replace(/\s/g, '');
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);
}

function stripDataUri(value: string): string {
  const idx = value.indexOf('base64,');
  return idx >= 0 ? value.slice(idx + 'base64,'.length) : value;
}

/**
 * Opens camera or gallery and returns a data-URI base64 string, or null if cancelled.
 */
export async function pickProductImage(
  source: 'camera' | 'library'
): Promise<string | null> {
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
    quality: 0.5,
    base64: true,
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
  if (!asset.base64) {
    Alert.alert('Could not read image', 'Try another photo.');
    return null;
  }

  const decodedBytes =
    typeof asset.fileSize === 'number' && asset.fileSize > 0
      ? asset.fileSize
      : estimateDecodedBytes(asset.base64);

  if (decodedBytes > MAX_PRODUCT_IMAGE_BYTES) {
    Alert.alert(
      'Image too large',
      'Max image size is 5 MB. Try a smaller photo or lower quality.'
    );
    return null;
  }

  const mime =
    asset.mimeType && asset.mimeType.startsWith('image/')
      ? asset.mimeType
      : 'image/jpeg';
  const dataUri = `data:${mime};base64,${asset.base64}`;
  if (estimateDecodedBytes(stripDataUri(dataUri)) > MAX_PRODUCT_IMAGE_BYTES) {
    Alert.alert(
      'Image too large',
      'Max image size is 5 MB. Try a smaller photo or lower quality.'
    );
    return null;
  }
  return dataUri;
}

export function askPickProductImage(): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert('Product photo', 'Add a photo of the product for review (max 5 MB).', [
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

export function askPickProfileImage(): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert('Profile photo', 'Choose a photo (max 5 MB).', [
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
