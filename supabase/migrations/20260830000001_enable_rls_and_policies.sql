-- Enable Row Level Security (RLS) across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kept_connections ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Public profiles are viewable by authenticated users"
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 2. Activities Policies
CREATE POLICY "Active activities are viewable by authenticated users"
ON public.activities FOR SELECT TO authenticated
USING (status IN ('open', 'full', 'in_progress') AND expires_at > NOW());

CREATE POLICY "Hosts can create activities"
ON public.activities FOR INSERT TO authenticated
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their own activities"
ON public.activities FOR UPDATE TO authenticated
USING (auth.uid() = host_id);

-- 3. Join Requests Policies
CREATE POLICY "Requesters and hosts can view join requests"
ON public.join_requests FOR SELECT TO authenticated
USING (
  auth.uid() = user_id OR
  auth.uid() IN (SELECT host_id FROM public.activities WHERE id = activity_id)
);

CREATE POLICY "Authenticated users can create join requests"
ON public.join_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Hosts can update join request status"
ON public.join_requests FOR UPDATE TO authenticated
USING (auth.uid() IN (SELECT host_id FROM public.activities WHERE id = activity_id));

-- 4. Activity Members Policies
CREATE POLICY "Room members can view other members"
ON public.activity_members FOR SELECT TO authenticated
USING (
  auth.uid() IN (SELECT user_id FROM public.activity_members WHERE activity_id = public.activity_members.activity_id)
);

-- 5. Ephemeral Room Messages Policies
CREATE POLICY "Accepted members can read room messages"
ON public.room_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.activity_members
    WHERE activity_members.activity_id = room_messages.activity_id
      AND activity_members.user_id = auth.uid()
  )
);

CREATE POLICY "Accepted members can send room messages"
ON public.room_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.activity_members
    WHERE activity_members.activity_id = room_messages.activity_id
      AND activity_members.user_id = auth.uid()
  )
);

-- 6. Ratings Policies
CREATE POLICY "Users can view ratings they received or gave"
ON public.ratings FOR SELECT TO authenticated
USING (auth.uid() = reviewer_id OR auth.uid() = target_user_id);

CREATE POLICY "Users can create ratings"
ON public.ratings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reviewer_id);

-- 7. Kept Connections Policies
CREATE POLICY "Connected users can view their kept connections"
ON public.kept_connections FOR SELECT TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b);
