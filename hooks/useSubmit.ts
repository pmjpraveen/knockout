import { useState } from 'react';

type Result = { error: { message: string } | null };

export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => PromiseLike<Result>) => {
    setBusy(true);
    setError(null);
    const { error: failure } = await action();
    setBusy(false);
    setError(failure?.message ?? null);
    return !failure;
  };

  return { run, busy, error };
}
