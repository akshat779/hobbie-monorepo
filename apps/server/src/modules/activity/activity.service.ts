import {
  CreateActivityOutput,
  DiscoveryQuery,
  RequestToJoinInput,
  RespondJoinRequestInput,
  SendMessageInput,
  SubmitFeedbackInput,
  toEwktPoint,
} from '@hobbie/shared';
import { fuzzCoordinates } from '../matching/matching.service.js';
import { supabaseAdmin } from '../../shared/supabase.js';

export class ActivityService {
  /**
   * Discovery: Execute PostGIS geospatial radius search and filter by taxonomy.
   */
  async getDiscoveryActivities(params: DiscoveryQuery) {
    const { latitude, longitude, radiusKm, interestIds } = params;

    const { data, error } = await supabaseAdmin.rpc('get_nearby_activities', {
      user_lat: latitude,
      user_lng: longitude,
      radius_km: radiusKm,
    });

    if (error) {
      throw new Error(`Failed to fetch nearby activities: ${error.message}`);
    }

    let activities = data || [];
    if (interestIds && interestIds.length > 0) {
      activities = activities.filter((act) =>
        interestIds.includes(act.interest_id as any)
      );
    }

    return activities;
  }

  /**
   * Create Activity: Fuzz coordinates, compute TTL expiration, and insert atomic activity record.
   */
  async createActivity(userId: string, data: CreateActivityOutput) {
    const fuzzed = fuzzCoordinates(data.location);
    const now = new Date();
    const ttlHours = data.ttlHours ?? 3;
    const expiresAt = new Date(
      now.getTime() + ttlHours * 60 * 60 * 1000
    );

    const { data: activity, error } = await supabaseAdmin
      .from('activities')
      .insert({
        host_id: userId,
        interest_id: data.interestId,
        title: data.title,
        description: data.description ?? null,
        tier: data.tier,
        location: toEwktPoint(data.location),
        fuzzed_location: toEwktPoint(fuzzed),
        venue_name: data.venueName ?? null,
        ttl_hours: ttlHours,
        expires_at: expiresAt.toISOString(),
        max_participants: data.maxParticipants,
        current_participants_count: 1,
        filter_gender: data.filterGender,
        filter_age_min: data.filterAgeMin ?? null,
        filter_age_max: data.filterAgeMax ?? null,
        status: 'open',
      })
      .select()
      .single();

    if (error || !activity) {
      throw new Error(error?.message || 'Failed to insert activity record');
    }

    return activity;
  }

  /**
   * Request to Join: Execute atomic SECURITY DEFINER RPC.
   */
  async submitJoinRequest(userId: string, data: RequestToJoinInput) {
    const { data: rpcData, error } = await supabaseAdmin.rpc(
      'request_to_join_activity',
      {
        p_activity_id: data.activityId,
        p_user_id: userId,
        p_message: data.message || '',
      }
    );

    if (error || !rpcData) {
      throw new Error(error?.message || 'Failed to submit join request');
    }

    return rpcData;
  }

  /**
   * Send Ephemeral Room Message: Inserts into room_messages.
   */
  async sendRoomMessage(userId: string, data: SendMessageInput) {
    const { data: message, error } = await supabaseAdmin
      .from('room_messages')
      .insert({
        activity_id: data.activityId,
        sender_id: userId,
        content: data.content,
      })
      .select()
      .single();

    if (error || !message) {
      throw new Error(error?.message || 'Failed to insert room message');
    }

    return message;
  }

  /**
   * Respond to Join Request: Accepts (via atomic transaction RPC) or declines request.
   */
  async respondToJoinRequest(userId: string, data: RespondJoinRequestInput) {
    if (data.action === 'accept') {
      const { data: result, error } = await supabaseAdmin.rpc(
        'accept_join_request_tx',
        {
          p_request_id: data.requestId,
          p_host_id: userId,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      return result;
    } else {
      const { data: result, error } = await supabaseAdmin.rpc(
        'decline_join_request',
        {
          p_request_id: data.requestId,
          p_host_id: userId,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      return result;
    }
  }

  /**
   * Submit Feedback: Records post-activity trust rating.
   */
  async submitRating(userId: string, data: SubmitFeedbackInput) {
    const { data: rating, error } = await supabaseAdmin
      .from('ratings')
      .insert({
        activity_id: data.activityId,
        reviewer_id: userId,
        target_user_id: data.targetUserId,
        score: data.score,
        tags: data.tags || null,
      })
      .select()
      .single();

    if (error || !rating) {
      throw new Error(error?.message || 'Failed to insert feedback rating');
    }

    return rating;
  }
}

export const activityService = new ActivityService();
