-- Migration: 20260917000000_add_cancelled_to_activity_status.sql
-- Description: Add 'cancelled' value to activity_status enum for when an activity is disbanded/cancelled by the host.

ALTER TYPE public.activity_status ADD VALUE IF NOT EXISTS 'cancelled';
