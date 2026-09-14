const store = new Map<string, string>();

const asyncStorageMock = {
  setItem: async (key: string, value: string) => {
    store.set(key, String(value));
  },
  getItem: async (key: string) => {
    return store.get(key) ?? null;
  },
  removeItem: async (key: string) => {
    store.delete(key);
  },
  clear: async () => {
    store.clear();
  },
  getAllKeys: async () => {
    return Array.from(store.keys());
  },
  multiGet: async (keys: string[]) => {
    return keys.map((k) => [k, store.get(k) ?? null]);
  },
  multiSet: async (entries: [string, string][]) => {
    entries.forEach(([k, v]) => store.set(k, String(v)));
  },
  multiRemove: async (keys: string[]) => {
    keys.forEach((k) => store.delete(k));
  },
};

export default asyncStorageMock;
export const setItem = asyncStorageMock.setItem;
export const getItem = asyncStorageMock.getItem;
export const removeItem = asyncStorageMock.removeItem;
export const clear = asyncStorageMock.clear;
export const getAllKeys = asyncStorageMock.getAllKeys;
export const multiGet = asyncStorageMock.multiGet;
export const multiSet = asyncStorageMock.multiSet;
export const multiRemove = asyncStorageMock.multiRemove;
