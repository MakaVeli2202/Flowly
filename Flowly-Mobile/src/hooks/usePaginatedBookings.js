import { useState, useEffect, useCallback, useRef } from 'react';
import { createPaginator } from '../core/paginationManager';
import { bookingsAPI } from '../api/bookings';
import { onJobStatus } from '../api/realtimeService';

const PAGE_SIZE = 50;
const MAX_ITEMS = 1000;

/**
 * usePaginatedBookings — scalable client-side booking pagination for mobile admin screens.
 *
 * Mirror of the web hook (same API, same logic).
 * All network calls share the cacheManager deduplication layer.
 * Backing data refreshes on WebSocket job status events.
 *
 * @param {object}                           [options]
 * @param {((booking: *) => boolean) | null} [options.filterFn]  Client-side predicate
 * @param {number}                           [options.pageSize=50]
 * @returns {{ bookings, hasMore, total, loading, loadMore, refresh }}
 */
export function usePaginatedBookings({ filterFn = null, pageSize = PAGE_SIZE } = {}) {
  const paginatorRef = useRef(null);
  if (!paginatorRef.current) {
    paginatorRef.current = createPaginator(
      () => bookingsAPI.getAll(),
      pageSize,
      { maxItems: MAX_ITEMS },
    );
  }

  const [state,   setState]   = useState({ items: [], hasMore: false, total: 0 });
  const [loading, setLoading] = useState(false);

  // Subscribe to paginator state
  useEffect(() => {
    const unsub = paginatorRef.current.subscribe(setState);
    setLoading(true);
    paginatorRef.current.load().finally(() => setLoading(false));
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep filter in sync — resets to page 0 automatically via paginator.setFilter
  useEffect(() => {
    paginatorRef.current.setFilter(filterFn || null);
  }, [filterFn]);

  // Refresh backing data on WebSocket job status events
  useEffect(() => {
    return onJobStatus(() => {
      bookingsAPI.getAll()
        .then(freshData => { if (Array.isArray(freshData)) paginatorRef.current.setData(freshData); })
        .catch(() => {});
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    paginatorRef.current.loadMore();
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await paginatorRef.current.refresh();
    setLoading(false);
  }, []);

  return { bookings: state.items, hasMore: state.hasMore, total: state.total, loading, loadMore, refresh };
}
