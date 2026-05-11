/**
 * Client-side pagination layer for large datasets.
 *
 * Problem: GET /Bookings/all returns the full dataset.  At scale this causes
 * memory pressure and slow renders.  This manager fetches the full list once,
 * caches it, and vends it out in slices so the UI only renders N items at a
 * time — without any backend changes.
 *
 * Features:
 *  - Fetches entire dataset once, caches pages already "seen".
 *  - Infinite-scroll: call loadMore() to extend the visible window.
 *  - Subscriber model: components receive state updates automatically.
 *  - refresh() re-fetches from server and resets to page 1.
 *
 * Usage (shared — works in web and React Native):
 *
 *   import { createPaginator } from '../core/paginationManager';
 *
 *   // Create once per screen (outside the component or in a ref):
 *   const paginator = createPaginator(() => bookingsAPI.getAll(), 50);
 *
 *   // Subscribe in useEffect:
 *   useEffect(() => {
 *     const unsub = paginator.subscribe((state) => {
 *       setItems(state.items);
 *       setHasMore(state.hasMore);
 *       setTotal(state.total);
 *     });
 *     paginator.load();
 *     return unsub;
 *   }, []);
 *
 *   // Infinite scroll:
 *   <FlatList onEndReached={() => paginator.loadMore()} ... />
 *
 *   // Pull-to-refresh:
 *   paginator.refresh().then(() => setRefreshing(false));
 *
 * Web hook wrapper: see hooks/usePaginator.js
 */

const DEFAULT_PAGE_SIZE = 50;

/**
 * Create a standalone paginator instance.
 *
 * @param {() => Promise<*[]>} fetchAll   Async function returning the full array
 * @param {number}             [pageSize] Items to show per "page" (default 50)
 * @returns {Paginator}
 */
export function createPaginator(fetchAll, pageSize = DEFAULT_PAGE_SIZE) {
  let _allItems   = null;   // null = not loaded yet; [] = empty dataset
  let _promise    = null;   // inflight fetch promise (prevents duplicate calls)
  let _page       = 0;      // current page index (0-based)
  let _filterFn   = null;   // optional client-side filter
  const _subs     = new Set();

  /* ── Internal helpers ────────────────────────────────────────────────── */
  function _buildState() {
    if (_allItems === null) return { items: [], hasMore: false, total: 0 };
    const filtered = _filterFn ? _allItems.filter(_filterFn) : _allItems;
    const visible = filtered.slice(0, (_page + 1) * pageSize);
    return {
      items:   visible,
      hasMore: visible.length < filtered.length,
      total:   filtered.length,
    };
  }

  function _notify() {
    const state = _buildState();
    _subs.forEach((cb) => { try { cb(state); } catch { /* silent */ } });
  }

  async function _fetchFromServer() {
    if (_promise) return _promise;
    _promise = fetchAll()
      .then((data) => {
        _allItems = Array.isArray(data) ? data : [];
        _page     = 0;
        _promise  = null;
        _notify();
        return _allItems;
      })
      .catch((err) => {
        _promise = null;
        throw err;
      });
    return _promise;
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  /**
   * Subscribe to state changes.  The callback receives { items, hasMore, total }.
   * If data is already loaded the callback is invoked immediately.
   *
   * @param {(state: {items, hasMore, total}) => void} cb
   * @returns {() => void} Unsubscribe function
   */
  function subscribe(cb) {
    _subs.add(cb);
    if (_allItems !== null) {
      try { cb(_buildState()); } catch { /* silent */ }
    }
    return () => _subs.delete(cb);
  }

  /**
   * Trigger the initial load.  Idempotent — safe to call multiple times.
   * @returns {Promise<void>}
   */
  async function load() {
    if (_allItems !== null) {
      _notify(); // already loaded — just notify with current state
      return;
    }
    return _fetchFromServer();
  }

  /**
   * Extend the visible window by one page.
   * Does nothing if all items are already visible.
   */
  function loadMore() {
    if (_allItems === null) return;
    const filtered = _filterFn ? _allItems.filter(_filterFn) : _allItems;
    if ((_page + 1) * pageSize >= filtered.length) return;
    _page += 1;
    _notify();
  }

  /**
   * Re-fetch all data from the server and reset to page 1.
   * @returns {Promise<void>}
   */
  async function refresh() {
    _allItems = null;
    _page     = 0;
    return _fetchFromServer();
  }

  /**
   * Inject a new full dataset (e.g. after an optimistic update) without
   * hitting the network.
   * @param {*[]} data
   */
  function setData(data) {
    _allItems = Array.isArray(data) ? data : [];
    _page     = 0;
    _notify();
  }

  /**
   * Set or clear the client-side filter function.
   * Resets to page 0 so the filtered view starts from the beginning.
   * @param {((item: *) => boolean) | null} fn
   */
  function setFilter(fn) {
    _filterFn = fn || null;
    _page     = 0;
    _notify();
  }

  /** Return the current state snapshot synchronously. */
  function getState() {
    return _buildState();
  }

  return { subscribe, load, loadMore, refresh, setData, setFilter, getState };
}
