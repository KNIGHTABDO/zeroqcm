
-- Create activation_keys table for ZeroQCM activation system
CREATE TABLE IF NOT EXISTS public.activation_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'inactive',
  requested_at timestamptz,
  approved_at timestamptz,
  telegram_message_id bigint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activation_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users read own activation" ON public.activation_keys;
CREATE POLICY "Users read own activation" ON public.activation_keys
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own activation" ON public.activation_keys;
CREATE POLICY "Users insert own activation" ON public.activation_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own activation" ON public.activation_keys;
CREATE POLICY "Users update own activation" ON public.activation_keys
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role bypass
DROP POLICY IF EXISTS "Service role full access" ON public.activation_keys;
CREATE POLICY "Service role full access" ON public.activation_keys
  USING (true) WITH CHECK (true);
