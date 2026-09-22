import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as ImagePicker from 'expo-image-picker';
import {
  extensionForImage,
  normalizeAvatarMimeType,
  pickAvatarImage,
  uploadAvatarImage,
} from '../services/avatar';
import { VALID_UUIDS } from './helpers/contractMocks';

vi.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
}));

vi.mock('../services/supabase', async () => {
  const { createContractMockSupabase } = await import('./helpers/contractMocks');
  return {
    supabase: createContractMockSupabase(),
  };
});

const picker = ImagePicker as unknown as {
  requestMediaLibraryPermissionsAsync: ReturnType<typeof vi.fn>;
  launchImageLibraryAsync: ReturnType<typeof vi.fn>;
};

describe('extensionForImage', () => {
  it('prefers the mime type and normalises jpeg to jpg', () => {
    expect(extensionForImage('image/jpeg')).toBe('jpg');
    expect(extensionForImage('image/png')).toBe('png');
    expect(extensionForImage('image/webp')).toBe('webp');
  });

  it('falls back to the filename extension and then jpg', () => {
    expect(extensionForImage('application/octet-stream', 'photo.PNG')).toBe('png');
    expect(extensionForImage('application/octet-stream', 'photo.jpeg')).toBe('jpg');
    expect(extensionForImage('application/octet-stream', 'photo.heic')).toBe('jpg');
    expect(extensionForImage('application/octet-stream')).toBe('jpg');
  });
});

describe('normalizeAvatarMimeType', () => {
  it('passes through allowlisted mime types case-insensitively', () => {
    expect(normalizeAvatarMimeType('image/png')).toBe('image/png');
    expect(normalizeAvatarMimeType('IMAGE/JPEG')).toBe('image/jpeg');
  });

  it('infers an allowlisted type from the filename', () => {
    expect(normalizeAvatarMimeType(undefined, 'photo.webp')).toBe('image/webp');
    expect(normalizeAvatarMimeType('application/octet-stream', 'photo.PNG')).toBe('image/png');
  });

  it('defaults a missing type to jpeg but rejects known-unsupported formats', () => {
    expect(normalizeAvatarMimeType(undefined)).toBe('image/jpeg');
    expect(normalizeAvatarMimeType('image/heic', 'IMG_0001.HEIC')).toBeNull();
    expect(normalizeAvatarMimeType('image/gif', 'anim.gif')).toBeNull();
  });
});

describe('pickAvatarImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an error when photo permission is denied', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });

    const result = await pickAvatarImage();

    expect(result.image).toBeUndefined();
    expect(result.error).toContain('Photo access');
  });

  it('returns nothing when the user cancels', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });

    const result = await pickAvatarImage();

    expect(result).toEqual({});
  });

  it('rejects an unsupported image format with a clear message', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/photo.heic', mimeType: 'image/heic', fileName: 'photo.heic' }],
    });

    const result = await pickAvatarImage();

    expect(result.image).toBeUndefined();
    expect(result.error).toContain('Unsupported image format');
  });

  it('normalises a supported asset before returning it', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/photo.jpg', mimeType: undefined, fileName: 'photo.JPG' }],
    });

    const result = await pickAvatarImage();

    expect(result.error).toBeUndefined();
    expect(result.image).toEqual({
      uri: 'file:///tmp/photo.jpg',
      mimeType: 'image/jpeg',
      fileName: 'photo.JPG',
    });
  });
});

describe('uploadAvatarImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      }))
    );
  });

  it('uploads to <userId>/avatar.<ext> and returns a versioned public URL', async () => {
    const result = await uploadAvatarImage({
      userId: VALID_UUIDS.alex,
      image: { uri: 'file:///tmp/avatar.jpg', mimeType: 'image/jpeg', fileName: 'avatar.jpg' },
    });

    expect(result.error).toBeUndefined();
    expect(result.url).toContain(
      `/storage/v1/object/public/avatars/${VALID_UUIDS.alex}/avatar.jpg`
    );
    expect(result.url).toMatch(/\?v=\d+/);
  });

  it('rejects an unsupported format instead of mislabelling the stored bytes', async () => {
    const result = await uploadAvatarImage({
      userId: VALID_UUIDS.alex,
      image: { uri: 'file:///tmp/photo.heic', mimeType: 'image/heic', fileName: 'photo.heic' },
    });

    expect(result.url).toBeUndefined();
    expect(result.error).toContain('Unsupported image format');
  });

  it('rejects when there is no authenticated user id', async () => {
    const result = await uploadAvatarImage({
      userId: '',
      image: { uri: 'file:///tmp/avatar.jpg', mimeType: 'image/jpeg', fileName: 'avatar.jpg' },
    });

    expect(result.url).toBeUndefined();
    expect(result.error).toBe('You must be signed in to upload a profile picture');
  });

  it('surfaces an error when the image cannot be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) }))
    );

    const result = await uploadAvatarImage({
      userId: VALID_UUIDS.alex,
      image: { uri: 'file:///tmp/missing.jpg', mimeType: 'image/jpeg', fileName: 'missing.jpg' },
    });

    expect(result.error).toBe('Could not read the selected image');
  });
});
