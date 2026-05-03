-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT,
  empresa TEXT,
  cif TEXT,
  plan TEXT NOT NULL DEFAULT 'starter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, empresa, plan)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'empresa', ''), 'starter');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CONVERSATIONS
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nueva conversación',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own conversations" ON public.conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own conversations" ON public.conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own conversations" ON public.conversations FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_conversations_user ON public.conversations(user_id, updated_at DESC);

-- MESSAGES
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own messages" ON public.messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own messages" ON public.messages FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at);

-- RESERVATIONS
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ciudad TEXT,
  alojamiento TEXT,
  precio NUMERIC,
  fecha_inicio DATE,
  fecha_fin DATE,
  trabajador_nombre TEXT,
  trabajador_contacto TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  factura_solicitada BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own reservations" ON public.reservations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own reservations" ON public.reservations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reservations" ON public.reservations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own reservations" ON public.reservations FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER reservations_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();