import { vi } from 'vitest';

// Real in-memory key-value store for AsyncStorage during testing
const store = new Map<string, string>();

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}

if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
}

export const asyncStorageMock = {
  setItem: vi.fn(async (key: string, value: string) => {
    store.set(key, String(value));
  }),
  getItem: vi.fn(async (key: string) => {
    return store.get(key) ?? null;
  }),
  removeItem: vi.fn(async (key: string) => {
    store.delete(key);
  }),
  clear: vi.fn(async () => {
    store.clear();
  }),
  getAllKeys: vi.fn(async () => {
    return Array.from(store.keys());
  }),
  multiGet: vi.fn(async (keys: string[]) => {
    return keys.map((k) => [k, store.get(k) ?? null]);
  }),
  multiSet: vi.fn(async (entries: [string, string][]) => {
    entries.forEach(([k, v]) => store.set(k, String(v)));
  }),
  multiRemove: vi.fn(async (keys: string[]) => {
    keys.forEach((k) => store.delete(k));
  }),
};

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock,
  ...asyncStorageMock,
}));
