import { useState, useEffect, useCallback, useRef } from 'react';
import { createPaginator } from '../core/paginationManager';
import { bookingsAPI } from '../api/bookings';
import { onJobStatus } from '../api/realtimeService';

const PAGE_SIZE = 50;
const MAX_ITEMS = 1000;

/**
 * usePaginatedBookings — scalable client-side booking pagination for admin screens.
 *
 * Fetches the full booking list once (cached by cacheManager, 30s TTL).
 * Pages client-side in chunks of 50. Applies dynamic filter before paginating
 * so filter changes always start from the correct slice.
 *
 * Features:
 *  - One network call shared across all mounted consumers (cacheManager dedup)
 *  - Auto-refresh on WebSocket job status events
 *  - Dynamic filter (reset to page 1 on change)
 *  - Memory guard: never holds more than 1000 items in memory
 *  - loadMore() extends the visible window by one page
 *  - refresh() forces a server round-trip and resets the view
 *
 * @param {object}                           [options]
 * @param {((booking: *) => boolean) | null} [options.filterFn]  Client-side predicate
 * @param {number}                           [options.pageSize=50]
 * @returns {{ bookings, hasMore, total, loading, loadMore, refresh }}
 *
 * Example:
 *   const { bookings, hasMore, total, loading, loadMore, refresh } = usePaginatedBookings({
 *     filterFn: useCallback((b) => b.status === 'Pending', []),
 *   });
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

  // Subscribe to paginator state changes
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

  // Refresh backing data on any job status event via WebSocket
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
