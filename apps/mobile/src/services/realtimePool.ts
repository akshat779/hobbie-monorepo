import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';
export interface PostgresChangeConfig {
  event: PostgresChangeEvent;
  schema: 'public';
  table: string;
  filter?: string;
}

let subscriptionSequence = 0;

/** Owns channel naming, stale-channel replacement, and teardown in one place. */
export function subscribeToPostgresChanges(
  key: string,
  config: PostgresChangeConfig,
  onPayload: (payload: unknown) => void,
  onError?: (message: string) => void,
): () => void {
  const prefix = `realtime:${key}`;
  supabase.getChannels()
    .filter((channel) => channel.topic.startsWith(prefix))
    .forEach((channel) => void supabase.removeChannel(channel));

  const channel = supabase
    .channel(`${key}_${subscriptionSequence++}`)
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
