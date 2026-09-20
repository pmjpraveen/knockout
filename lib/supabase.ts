import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from '@/lib/database.types';
import { reachable } from '@/lib/hosts';

export const supabaseUrl = reachable(process.env.EXPO_PUBLIC_SUPABASE_URL!);

export const supabase = createClient<Database>(
  supabaseUrl,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, flowType: 'pkce', detectSessionInUrl: Platform.OS === 'web' } },
);
