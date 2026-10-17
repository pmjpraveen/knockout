type Details = { athlete_name?: string; category_label?: string; athletes?: number };

/** A one-line description of an audit log entry. Unknown actions fall back to their name. */
export function activityTitle(action: string, changes: unknown) {
  const { athlete_name, category_label, athletes } = (changes ?? {}) as Details;
  switch (action) {
    case 'add_athlete': return 'Participant added';
    case 'edit_athlete': return 'Participant edited';
    case 'withdraw_registration': return `${athlete_name ?? 'Participant'} withdrawn from ${category_label}`;
    case 'import_athletes': return `${athletes ?? ''} participants imported`.trim();
    case 'override_result': return 'Match result overridden';
    case 'release_scoreboard': return 'Scoreboard released';
    case 'withdraw_athlete': return 'Athlete withdrawn from the bracket';
    default: return action.replace(/_/g, ' ');
  }
}
