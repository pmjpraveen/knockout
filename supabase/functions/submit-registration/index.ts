import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
};

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type Athlete = { full_name: string; date_of_birth: string; gender: string; weight: number; belt_rank: string; disciplines: string[] };

const text = (value: unknown, field: string, max: number) => {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    throw new HttpError(400, `${field} is required (max ${max} characters).`);
  }
  return value.trim();
};

function parseAthlete(raw: any, belts: string[]): Athlete {
  const dob = text(raw?.date_of_birth, 'Date of birth', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob)) || Date.parse(dob) > Date.now()) {
    throw new HttpError(400, 'Date of birth must look like 2012-04-30.');
  }
  const weight = Number(raw?.weight);
  if (!(weight > 0 && weight < 300)) throw new HttpError(400, 'Weight must be between 0 and 300 kg.');
  const gender = raw?.gender;
  if (gender !== 'male' && gender !== 'female') throw new HttpError(400, 'Gender must be male or female.');
  const belt = text(raw?.belt_rank, 'Belt', 40).toLowerCase();
  if (!belts.includes(belt)) throw new HttpError(400, 'Choose a belt from the list for this event.');
  return { full_name: text(raw?.full_name, 'Athlete name', 120), date_of_birth: dob, gender, weight, belt_rank: belt, disciplines: parseDisciplines(raw?.disciplines) };
}

/** What the athlete enters: kumite, kata or both. Missing means both. */
function parseDisciplines(raw: unknown) {
  if (raw === undefined || raw === null) return ['kumite', 'kata'];
  const chosen = Array.isArray(raw) ? [...new Set(raw)] : [];
  if (chosen.length === 0 || chosen.some((d) => d !== 'kumite' && d !== 'kata')) throw new HttpError(400, 'Choose kumite, kata or both.');
  return chosen as string[];
}

async function resolveLink(token: unknown) {
  const { data: link } = await admin
    .from('registration_links')
    .select('is_active, events(id, name, venue, status, registration_opens_at, registration_closes_at, belts)')
    .eq('token', typeof token === 'string' ? token : '')
    .maybeSingle();
  if (!link?.is_active || !link.events) throw new HttpError(404, 'This registration link is not valid.');
  const event = link.events as any;
  const now = Date.now();
  const open =
    event.status === 'registration_open' &&
    (!event.registration_opens_at || Date.parse(event.registration_opens_at) <= now) &&
    (!event.registration_closes_at || Date.parse(event.registration_closes_at) >= now);
  const notYet = event.status === 'draft' || (event.registration_opens_at && Date.parse(event.registration_opens_at) > now);
  return { event, open, state: open ? 'open' : notYet ? 'not_open_yet' : 'closed' };
}

async function handle(body: any) {
  const { event, open, state } = await resolveLink(body.token);

  switch (body.action) {
    case 'info':
      return { event: { name: event.name, venue: event.venue, closes_at: event.registration_closes_at, opens_at: event.registration_opens_at, belts: event.belts }, open, state };

    case 'suggest': {
      const a = parseAthlete(body.athlete, event.belts);
      const { data, error } = await admin.rpc('suggest_categories', {
        p_event_id: event.id, p_date_of_birth: a.date_of_birth, p_gender: a.gender, p_weight: a.weight, p_belt: a.belt_rank, p_disciplines: a.disciplines,
      });
      if (error) throw error;
      return { categories: data.map((c: { label: string }) => c.label) };
    }

    case 'load': {
      const { data: entry } = await admin
        .from('club_entries')
        .select('id, club_name, club_contact, approval_status, rejection_reason, athletes(full_name, date_of_birth, gender, weight, belt_rank, disciplines)')
        .eq('id', typeof body.reference === 'string' ? body.reference : '')
        .eq('event_id', event.id)
        .maybeSingle();
      if (!entry) throw new HttpError(404, 'We could not find that submission.');
      return { entry, open };
    }

    case 'save': {
      if (!open) throw new HttpError(403, 'Registration is closed for this event.');
      if (!Array.isArray(body.athletes) || body.athletes.length < 1 || body.athletes.length > 200) {
        throw new HttpError(400, 'Add between 1 and 200 participants.');
      }
      const { data, error } = await admin.rpc('save_club_entry', {
        p_event_id: event.id,
        p_reference: body.reference ?? null,
        p_club_name: text(body.club_name, 'Club name', 120),
        p_club_contact: text(body.club_contact, 'Contact', 200),
        p_athletes: body.athletes.map((athlete: unknown) => parseAthlete(athlete, event.belts)),
      });
      if (error) throw error;
      return { reference: data };
    }

    default:
      throw new HttpError(400, 'Unknown action.');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const respond = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    return respond(200, await handle(await req.json()));
  } catch (e: any) {
    if (e instanceof HttpError) return respond(e.status, { error: e.message });
    if (e?.code === 'P0429') return respond(429, { error: e.message });
    if (e?.code === 'P0403') return respond(403, { error: e.message });
    console.error(e);
    return respond(500, { error: 'Something went wrong. Please try again.' });
  }
});
