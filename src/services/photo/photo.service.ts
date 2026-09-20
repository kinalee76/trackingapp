import { Camera } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

const PHOTOS_DIR = 'photos';

/**
 * Takes a photo with the device camera and returns a URI that stays valid
 * for the life of the app (not the camera's own temp/cache file).
 * On native, the camera's temp file is copied into the app's persistent
 * `Directory.Data` storage (the camera's own file lives in a cache dir the
 * OS can clear). On web (dev only), the browser `blob:` URL from
 * Camera.takePhoto is returned as-is — it only lives for the current page
 * session, since there is no real filesystem to persist it to.
 */
export async function capturePhoto(): Promise<string> {
  const photo = await Camera.takePhoto({ quality: 80, saveToGallery: false });
  return persistPhoto(photo);
}

async function persistPhoto(photo: { uri?: string; webPath?: string }): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    if (!photo.webPath) throw new Error('Camera.takePhoto did not return a webPath on web');
    return photo.webPath;
  }

  if (!photo.uri) throw new Error('Camera.takePhoto did not return a uri on native');

  await ensurePhotosDir();
  const filename = `${PHOTOS_DIR}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  await Filesystem.copy({ from: photo.uri, to: filename, toDirectory: Directory.Data });
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Data });
  return uri;
}

async function ensurePhotosDir(): Promise<void> {
  try {
    await Filesystem.mkdir({ path: PHOTOS_DIR, directory: Directory.Data, recursive: true });
  } catch {
    // Already exists — fine.
  }
}
