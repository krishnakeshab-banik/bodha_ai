/**
 * PDF hand-off on Android (Share sheet). The website still uses <a download>.
 */

import { isNativeApp } from './platform';

export async function sharePdfBlob(blob: Blob, filename: string): Promise<boolean> {
  if (!(await isNativeApp())) return false;

  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');

  const data = await blobToBase64(blob);
  await Filesystem.writeFile({
    path: filename,
    data,
    directory: Directory.Cache,
  });
  const { uri } = await Filesystem.getUri({
    path: filename,
    directory: Directory.Cache,
  });
  await Share.share({
    title: filename,
    url: uri,
    dialogTitle: 'Save Bodha AI report',
  });
  return true;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.split(',')[1] ?? '' : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
