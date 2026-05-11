import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPaginator } from '../core/paginationManager';

/**
 * React hook wrapping createPaginator.
 *
 * @param {() => Promise<*[]>} fetchAll  Stable reference — wrap in useCallback if needed.
 * @param {number}             [pageSize=50]
 * @returns {{ items, hasMore, total, loading, loadMore, refresh }}
 *
 * Example:
 *   const { items, hasMore, loading, loadMore, refresh } = usePaginator(
 *     useCallback(() => bookingsAPI.getAll(), []),
 *     50,
 *   );
 */
export function usePaginator(fetchAll, pageSize = 50) {
  const paginator = useMemo(() => createPaginator(fetchAll, pageSize), [fetchAll, pageSize]);

  const [state,   setState]   = useState({ items: [], hasMore: false, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = paginator.subscribe(setState);
    paginator.load().finally(() => setLoading(false));
    return unsub;
  }, [paginator]);

  const loadMore = useCallback(() => {
    paginator.loadMore();
  }, [paginator]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await paginator.refresh();
    setLoading(false);
  }, [paginator]);

  return { ...state, loading, loadMore, refresh };
}
