import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

/** Public Storage bucket that holds user profile photos. */
export const AVATAR_BUCKET = 'avatars';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** MIME types the `avatars` Storage bucket accepts (mirrors its allowed_mime_types). */
export const ALLOWED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

function mimeFromFileName(fileName?: string | null): string | null {
  const extension = fileName?.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return null;
}

/**
 * Resolves a picked asset to a MIME type the `avatars` bucket accepts, so the
 * upload's contentType and file extension can never disagree.
 * Returns `null` when the asset is a format the bucket cannot store.
 */
export function normalizeAvatarMimeType(
  mimeType?: string | null,
  fileName?: string | null
): string | null {
  const raw = mimeType?.trim().toLowerCase();
  if (raw && (ALLOWED_AVATAR_MIME_TYPES as readonly string[]).includes(raw)) {
    return raw;
  }

  const fromFileName = mimeFromFileName(fileName);
  if (fromFileName) return fromFileName;

  // Expo re-encodes edited picks to JPEG; treat a missing type as JPEG, but
  // reject a type we know the bucket cannot store.
  return raw ? null : 'image/jpeg';
}

export interface PickedAvatar {
  uri: string;
  mimeType: string;
  fileName: string;
}

/** Resolve a Storage-safe file extension for a picked image. */
export function extensionForImage(
  mimeType: string,
  fileName?: string | null
): string {
  const byMime = MIME_EXTENSIONS[mimeType.toLowerCase()];
  if (byMime) return byMime;

  const candidate = fileName?.split('.').pop()?.toLowerCase();
  if (candidate === 'jpg' || candidate === 'jpeg') return 'jpg';
  if (candidate === 'png' || candidate === 'webp') return candidate;
  return 'jpg';
}

/**
 * Requests photo-library permission and launches the native image picker.
 * Returns `{}` when the user cancels, or `{ error }` when permission is denied.
 */
export async function pickAvatarImage(): Promise<{
  image?: PickedAvatar;
  error?: string;
}> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return {
      error: 'Photo access is needed to add a profile picture. Enable it in Settings.',
    };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.length) {
    return {};
  }

  const asset = result.assets[0]!;
  const mimeType = normalizeAvatarMimeType(asset.mimeType, asset.fileName);
  if (!mimeType) {
    return {
      error: 'Unsupported image format. Choose a JPEG, PNG, or WebP photo.',
    };
  }

  return {
    image: {
      uri: asset.uri,
      mimeType,
      fileName: asset.fileName ?? `avatar.${extensionForImage(mimeType)}`,
    },
  };
}

export interface UploadAvatarParams {
  userId: string;
  image: PickedAvatar;
}

/**
 * Uploads a picked image to `<userId>/avatar.<ext>` in the public `avatars`
 * bucket and returns the public URL (with a cache-busting version param).
 */
export async function uploadAvatarImage({
  userId,
  image,
}: UploadAvatarParams): Promise<{ url?: string; error?: string }> {
  if (!userId) {
    return { error: 'You must be signed in to upload a profile picture' };
  }

  try {
    const response = await fetch(image.uri);
    if (!response.ok) {
      return { error: 'Could not read the selected image' };
    }
    const arrayBuffer = await response.arrayBuffer();

    const contentType = normalizeAvatarMimeType(image.mimeType, image.fileName);
    if (!contentType) {
      return { error: 'Unsupported image format. Choose a JPEG, PNG, or WebP photo.' };
    }
    const extension = extensionForImage(contentType, image.fileName);
    const path = `${userId}/avatar.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      return { error: uploadError.message };
    }

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    return { url: `${data.publicUrl}?v=${Date.now()}` };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to upload profile picture',
    };
  }
}
