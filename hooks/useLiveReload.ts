import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/** Reloads on Realtime changes to the given tables, and every 30s so estimated times keep up with the clock. */
export function useLiveReload(reload: () => void, tables: string[]) {
  useEffect(() => {
    const channel = supabase.channel(`live-${tables.join('-')}-${Math.random().toString(36).slice(2)}`);
    tables.forEach((table) => channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => reload()));
    channel.subscribe();
    const timer = setInterval(reload, 30000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);
}
