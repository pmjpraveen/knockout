import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
};

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/**
 * Deletes the caller's own account. A tournament belongs to its organizer, so deleting the organizer deletes their
 * tournaments and everything in them (participants, results, cover images) before the login itself. A tournament
 * director or scorekeeper only loses their login and roles; the events they worked on stay.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const respond = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return respond(401, { error: 'Please sign in again.' });

    const { confirm } = await req.json();
    if (confirm !== 'DELETE') return respond(400, { error: 'Type DELETE to confirm.' });

    // events.organizer_id does not cascade, so the login cannot go while the user still owns events.
    const { error: eventsError } = await admin.from('events').delete().eq('organizer_id', user.id);
    if (eventsError) throw eventsError;
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return respond(200, { ok: true });
  } catch (e) {
    console.error(e);
    return respond(500, { error: 'Something went wrong. Please try again.' });
  }
});
