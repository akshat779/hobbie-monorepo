import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';
export interface PostgresChangeConfig {
  event: PostgresChangeEvent;
  schema: 'public';
  table: string;
  filter?: string;
}

/** Owns channel naming, stale-channel replacement, and teardown in one place. */
export function subscribeToPostgresChanges(
  key: string,
  config: PostgresChangeConfig,
  onPayload: (payload: unknown) => void,
  onError?: (message: string) => void,
): () => void {
  const existing = supabase.getChannels().find((c) => c.topic === `realtime:${key}`);
  if (existing) {
    void supabase.removeChannel(existing);
  }

  const channel = supabase
    .channel(key)
    .on('postgres_changes', config, (payload) => onPayload(payload))
    .subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.(error?.message ?? `Realtime ${status.toLowerCase()}`);
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
