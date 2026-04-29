import { useState, useEffect, useCallback, useRef } from 'react';
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
  const paginatorRef = useRef(null);
  if (!paginatorRef.current) {
    paginatorRef.current = createPaginator(fetchAll, pageSize);
  }

  const [state,   setState]   = useState({ items: [], hasMore: false, total: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = paginatorRef.current.subscribe(setState);
    setLoading(true);
    paginatorRef.current.load().finally(() => setLoading(false));
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    paginatorRef.current.loadMore();
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await paginatorRef.current.refresh();
    setLoading(false);
  }, []);

  return { ...state, loading, loadMore, refresh };
}
