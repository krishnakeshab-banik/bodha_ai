/**
 * Native camera / gallery for the Android build only.
 * Returns null on the website so ImageUpload keeps its existing file input.
 */

import { isNativeAndroid } from './platform';

export async function captureProductPhoto(): Promise<string | null> {
  if (!(await isNativeAndroid())) return null;

  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const photo = await Camera.getPhoto({
    quality: 80,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Prompt,
    width: 1280,
    correctOrientation: true,
    promptLabelHeader: 'Product photo',
    promptLabelPhoto: 'Choose from gallery',
    promptLabelPicture: 'Take a photo',
  });

  return photo.dataUrl ?? null;
}
