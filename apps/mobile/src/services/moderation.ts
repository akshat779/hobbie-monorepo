import {
  BlockActionResultSchema,
  ReportUserSchema,
  type ReportUserInput,
} from '@hobbie/shared';
import { supabase } from './supabase';

type ActionResult = { success: boolean; error?: string };

/** Blocked user ids for the current user (used to filter incoming requests). */
export async function getMyBlockedIds(): Promise<string[]> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id;
    if (!me) return [];

    const { data, error } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', me);

    if (error || !data) return [];
    return data.map((row) => row.blocked_id);
  } catch (err) {
    console.warn('getMyBlockedIds error:', err);
    return [];
  }
}

/** True when the current user has blocked `targetUserId`. */
export async function hasBlockedUser(targetUserId: string): Promise<boolean> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id;
    if (!me) return false;

    const { data, error } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', me)
      .eq('blocked_id', targetUserId)
      .maybeSingle();

    return !error && Boolean(data);
  } catch {
    return false;
  }
}

export async function blockUser(targetUserId: string): Promise<ActionResult> {
  try {
    const { data, error } = await supabase.rpc('block_user', {
      p_blocked_id: targetUserId,
    });
    if (error) return { success: false, error: error.message };

    const parsed = BlockActionResultSchema.safeParse(data);
    return parsed.success
      ? { success: true }
      : { success: false, error: 'Unexpected block response' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Block failed' };
  }
}

export async function unblockUser(targetUserId: string): Promise<ActionResult> {
  try {
    const { data, error } = await supabase.rpc('unblock_user', {
      p_blocked_id: targetUserId,
    });
    if (error) return { success: false, error: error.message };

    const parsed = BlockActionResultSchema.safeParse(data);
    return parsed.success
      ? { success: true }
      : { success: false, error: 'Unexpected unblock response' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unblock failed' };
  }
}

/** Inserts a moderation report for the target user (validated before insert). */
export async function reportUser(input: ReportUserInput): Promise<ActionResult> {
  const parsed = ReportUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid report' };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id;
    if (!me) return { success: false, error: 'You must be signed in to report a user' };

    const { error } = await supabase.from('reports').insert({
      reporter_id: me,
      target_user_id: parsed.data.targetUserId,
      activity_id: parsed.data.activityId ?? null,
      reason: parsed.data.reason,
      notes: parsed.data.notes ?? '',
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Report failed' };
  }
}
