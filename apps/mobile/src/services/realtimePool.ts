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
  config: PostgresChangeConfig | PostgresChangeConfig[],
  onPayload: (payload: unknown) => void,
  onError?: (message: string) => void,
): () => void {
  const existing = supabase.getChannels().find((c) => c.topic === `realtime:${key}`);
  if (existing) {
    void supabase.removeChannel(existing);
  }

  // Multiple filters can be AND-combined as separate `.on` bindings on a single
  // channel (one channel vs. one per filter).
  const configs = Array.isArray(config) ? config : [config];
  const channel = configs.reduce(
    (ch, cfg) => ch.on('postgres_changes', cfg, (payload) => onPayload(payload)),
    supabase.channel(key)
  );

  channel.subscribe((status, error) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      onError?.(error?.message ?? `Realtime ${status.toLowerCase()}`);
    }
  });

  return () => {
    void supabase.removeChannel(channel);
  };
}
