-- Seed Profiles for Dev Persona Testing
INSERT INTO public.profiles (id, phone, name, birth_date, gender, interests, is_verified, trust_score, interaction_count)
VALUES
  ('00000000-0000-0000-0000-000000000001', '+919999990001', 'Alex (Host - Football)', '1995-05-15', 'male', ARRAY['football', 'running'], TRUE, 4.90, 18),
  ('00000000-0000-0000-0000-000000000002', '+919999990002', 'Sam (Joiner - Football)', '1997-08-20', 'non-binary', ARRAY['football', 'badminton'], TRUE, 4.80, 12),
  ('00000000-0000-0000-0000-000000000003', '+919999990003', 'Priya (Joiner - Badminton)', '1996-03-10', 'female', ARRAY['badminton', 'cafe_coffee'], TRUE, 5.00, 24),
  ('00000000-0000-0000-0000-000000000004', '+919999990004', 'Rohan (Unverified)', '2000-11-25', 'male', ARRAY['gaming', 'nightlife'], FALSE, 3.20, 2)
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Live Activities in Tech Park Zone
INSERT INTO public.activities (
  id, host_id, interest_id, title, description, tier,
  location, fuzzed_location, venue_name, ttl_hours, expires_at,
  max_participants, current_participants_count, status
)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'football',
    '5-a-side Turf Football Match',
    'Need 2 more players for casual match at EcoWorld turf. Bibs provided.',
    'physical',
    ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326),
    ST_SetSRID(ST_MakePoint(77.5950, 12.9720), 4326),
    'EcoWorld Turf Club Pitch 2',
    3.0,
    NOW() + INTERVAL '2 hours 30 minutes',
    10,
    3,
    'open'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    'badminton',
    'Badminton Doubles Match',
    'Court booked till 9:30 PM. Need 1 intermediate player.',
    'physical',
    ST_SetSRID(ST_MakePoint(77.6000, 12.9800), 4326),
    ST_SetSRID(ST_MakePoint(77.6005, 12.9805), 4326),
    'Smash Zone Indoor Arena',
    2.0,
    NOW() + INTERVAL '25 minutes',
    4,
    3,
    'open'
  )
ON CONFLICT (id) DO NOTHING;
