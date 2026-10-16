import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { unfinishedDrafts } from '@/lib/unfinishedDrafts';

/** Draft ids that were saved part-way through the create wizard, refreshed whenever the screen gains focus. */
export function useUnfinishedDrafts() {
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  useFocusEffect(useCallback(() => { unfinishedDrafts().then(setDrafts); }, []));
  return drafts;
}
