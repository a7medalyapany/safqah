import { useCallback } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * Returns a function that invalidates several react-query keys at once, replacing
 * the repeated `Promise.all([queryClient.invalidateQueries(...), ...])` boilerplate
 * found in mutation `onSuccess` handlers.
 *
 * Each argument is a full query key, so it works with both plain keys and
 * structured key factories:
 *
 *   const invalidate = useInvalidate();
 *   await invalidate(["payments"], ["customers"], salesKeys.detail(id));
 */
export function useInvalidate() {
  const queryClient = useQueryClient();

  return useCallback(
    (...keys: QueryKey[]) =>
      Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
    [queryClient],
  );
}
