// Cliente Supabase. URL y anon key son PÚBLICAS (van en el cliente); la seguridad la da RLS (auth.uid() = user_id).
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://sqxfimanxgrzvjzbnumj.supabase.co';
export const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxeGZpbWFueGdyenZqemJudW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMzEzOTIsImV4cCI6MjEwODgwNzM5Mn0.Zj1jL9qeb_g1q5lTymgtnbM8dIkhqZj96gA3MxUEVPs';

// Estos defaults persisten la sesión en localStorage y la renuevan sola: no expira.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: true, autoRefreshToken: true } });
