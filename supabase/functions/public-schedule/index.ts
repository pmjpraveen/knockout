import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
};

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const maxPerTatamiPerDay = 30;

// Keeps each day's first matches, so a long first day cannot push a later day off the list.
const withinDayLimit = () => {
  const seen = new Map<string, number>();
  return (m: any) => {
    const count = (seen.get(m.event_day ?? '') ?? 0) + 1;
    seen.set(m.event_day ?? '', count);
    return count <= maxPerTatamiPerDay;
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const respond = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const { token } = await req.json();
    const { data: event } = await admin
      .from('events')
      .select('id, name, venue, start_date, end_date')
      .eq('schedule_token', typeof token === 'string' ? token : '')
      .maybeSingle();
    if (!event) return respond(404, { error: 'This schedule link is not valid.' });

    const [{ data: tatamis }, { data: schedule, error }] = await Promise.all([
      admin.from('tatamis').select('id, name, status').eq('event_id', event.id).order('name'),
      admin.rpc('event_schedule', { p_event_id: event.id }),
    ]);
    if (error) throw error;

    // Names, ring, round and estimated time only: no ids, dates of birth, weights or clubs.
    return respond(200, {
      event: { name: event.name, venue: event.venue, start_date: event.start_date, end_date: event.end_date },
      updated_at: new Date().toISOString(),
      tatamis: (tatamis ?? []).map((t) => ({
        name: t.name,
        status: t.status,
        matches: (schedule ?? [])
          .filter((m: any) => m.tatami_id === t.id)
          .filter(withinDayLimit())
          .map((m: any) => ({
            position: m.queue_position,
            category: m.category_label,
            round: m.round,
            side: m.bracket_side,
            status: m.match_status,
            athlete_a: m.athlete_a,
            athlete_b: m.athlete_b,
            estimated_call_time: m.estimated_call_time,
            day: m.event_day,
          })),
      })),
    });
  } catch (e) {
    console.error(e);
    return respond(500, { error: 'Something went wrong. Please try again.' });
  }
});
