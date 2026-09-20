import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
};

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const text = (value: unknown, field: string, max: number) => {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    throw new HttpError(400, `${field} is required (max ${max} characters).`);
  }
  return value.trim();
};

/** Creates a login for a tournament director or scorekeeper and adds it to the caller's event. */
async function handle(req: Request) {
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) throw new HttpError(401, 'Please sign in again.');

  const body = await req.json();
  const email = text(body.email, 'Email', 254).toLowerCase();
  const password = text(body.password, 'Password', 72);
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');

  // Everything below runs as the caller, so add_event_member's organizer and event-status checks apply.
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: isOrganizer } = await caller.rpc('is_event_member', { p_event_id: body.event_id, p_roles: ['organizer'] });
  if (!isOrganizer) throw new HttpError(403, 'Only the organizer can manage staff.');

  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError) {
    if (createError.code === 'email_exists') throw new HttpError(409, 'An account with that email already exists.');
    if (createError.status && createError.status < 500) throw new HttpError(400, createError.message);
    throw createError;
  }

  const { error } = await caller.rpc('add_event_member', {
    p_event_id: body.event_id, p_email: email, p_role: body.role, p_tatami_id: body.tatami_id,
  });
  if (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    const status = { P0001: 400, '42501': 403 }[error.code as string];
    if (!status) throw error;
    throw new HttpError(status, error.message);
  }
  return { email };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const respond = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    return respond(200, await handle(req));
  } catch (e: any) {
    if (e instanceof HttpError) return respond(e.status, { error: e.message });
    console.error(e);
    return respond(500, { error: 'Something went wrong. Please try again.' });
  }
});
