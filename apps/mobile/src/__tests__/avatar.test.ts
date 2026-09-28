import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as ImagePicker from 'expo-image-picker';
import {
  extensionForImage,
  normalizeAvatarMimeType,
  pickAvatarImage,
  preparePhoto,
  uploadAvatarImage,
} from '../services/avatar';
import { VALID_UUIDS } from './helpers/contractMocks';

vi.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
}));

const { mockSaveAsync, mockResize, mockManipulate } = vi.hoisted(() => {
  const mockSaveAsync = vi.fn(async () => ({
    uri: 'file:///tmp/prepared.jpg',
    width: 1600,
    height: 1200,
  }));
  const mockResize = vi.fn();
  const mockManipulate = vi.fn();
  return { mockSaveAsync, mockResize, mockManipulate };
});

vi.mock('expo-image-manipulator', () => {
  const context = {
    resize: (size: unknown) => {
      mockResize(size);
      return context;
    },
    renderAsync: async () => ({ saveAsync: mockSaveAsync }),
  };
  return {
    ImageManipulator: {
      manipulate: (uri: string) => {
        mockManipulate(uri);
        return context;
      },
    },
    SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  };
});

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

  it('converts a HEIC asset to a compressed JPEG instead of rejecting it', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///tmp/photo.heic',
          mimeType: 'image/heic',
          fileName: 'photo.heic',
          width: 3024,
          height: 4032,
        },
      ],
    });

    const result = await pickAvatarImage();

    expect(result.error).toBeUndefined();
    expect(mockManipulate).toHaveBeenCalledWith('file:///tmp/photo.heic');
    // Portrait source is capped by height.
    expect(mockResize).toHaveBeenCalledWith({ height: 1600 });
    expect(result.image).toEqual({
      uri: 'file:///tmp/prepared.jpg',
      mimeType: 'image/jpeg',
      fileName: expect.stringMatching(/^photo-\d+\.jpg$/),
      width: 1600,
      height: 1200,
    });
  });

  it('normalises a supported asset to the prepared JPEG', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///tmp/photo.jpg',
          mimeType: undefined,
          fileName: 'photo.JPG',
          width: 4000,
          height: 3000,
        },
      ],
    });

    const result = await pickAvatarImage();

    expect(result.error).toBeUndefined();
    // Landscape source is capped by width.
    expect(mockResize).toHaveBeenCalledWith({ width: 1600 });
    expect(result.image?.mimeType).toBe('image/jpeg');
    expect(result.image?.uri).toBe('file:///tmp/prepared.jpg');
  });
});

describe('preparePhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('re-encodes any picked image (including HEIC) as JPEG', async () => {
    const result = await preparePhoto({
      uri: 'file:///tmp/IMG_0001.HEIC',
      mimeType: 'image/heic',
      fileName: 'IMG_0001.HEIC',
      width: 4032,
      height: 3024,
    });

    expect(result.error).toBeUndefined();
    expect(result.image?.mimeType).toBe('image/jpeg');
    expect(result.image?.fileName).toMatch(/\.jpg$/);
    expect(result.image?.uri).toBe('file:///tmp/prepared.jpg');
  });

  it('surfaces a clear error when the native manipulator fails', async () => {
    mockManipulate.mockImplementationOnce(() => {
      throw new Error('decode failed');
    });

    const result = await preparePhoto({
      uri: 'file:///tmp/broken.heic',
      mimeType: 'image/heic',
      fileName: 'broken.heic',
    });

    expect(result.image).toBeUndefined();
    expect(result.error).toBe('decode failed');
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
