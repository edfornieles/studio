import { useCallback, useEffect, useState } from 'react';

/** Load async data and expose a refresh function. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const refresh = useCallback(() => {
    load().then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { data, refresh };
}
