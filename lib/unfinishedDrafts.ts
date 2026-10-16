import AsyncStorage from '@react-native-async-storage/async-storage';

const key = 'unfinished-event-drafts';

/** The name a draft gets when it is saved before the organizer has typed one. */
export const untitledEvent = 'Untitled tournament';

/** Drafts saved with "Save & exit" and not yet created, by event id, with the wizard step each was left on. Kept on this device only. */
export async function unfinishedDrafts(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Remembers the step a draft was left on, or with `null` forgets it because the event was created or deleted. */
export async function setUnfinished(eventId: string, step: number | null) {
  const { [eventId]: _removed, ...rest } = await unfinishedDrafts();
  try {
    await AsyncStorage.setItem(key, JSON.stringify(step === null ? rest : { ...rest, [eventId]: step }));
  } catch {
    // The draft is saved either way; at worst it opens as a normal event page.
  }
}
