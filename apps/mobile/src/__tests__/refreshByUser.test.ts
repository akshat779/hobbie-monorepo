import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRefreshByUser } from '../hooks/useRefreshByUser';

let mockState = false;
const mockSetState = vi.fn((val: any) => {
  mockState = typeof val === 'function' ? val(mockState) : val;
});

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: () => [mockState, mockSetState],
    useCallback: (fn: any) => fn,
  };
});

describe('useRefreshByUser (TkDodo Pull-To-Refresh Hook)', () => {
  beforeEach(() => {
    mockState = false;
    mockSetState.mockClear();
  });

  it('initializes with isRefetchingByUser = false and sets true during in-flight refetch', async () => {
    const mockRefetch = vi.fn().mockResolvedValue({ data: 'refreshed' });
    const hook = useRefreshByUser(mockRefetch);

    expect(hook.isRefetchingByUser).toBe(false);

    const refreshPromise = hook.refetchByUser();
    expect(mockSetState).toHaveBeenCalledWith(true);

    await refreshPromise;
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(mockSetState).toHaveBeenCalledWith(false);
  });

  it('safely resets isRefetchingByUser to false even if refetch throws', async () => {
    const mockRefetch = vi.fn().mockRejectedValue(new Error('Network drop'));
    const hook = useRefreshByUser(mockRefetch);

    await hook.refetchByUser().catch(() => {});
    expect(mockSetState).toHaveBeenCalledWith(true);
    expect(mockSetState).toHaveBeenCalledWith(false);
  });
});
