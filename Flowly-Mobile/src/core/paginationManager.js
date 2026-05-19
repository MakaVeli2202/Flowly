/**
 * Client-side pagination layer — React Native edition.
 * Identical logic to the web version (no platform-specific code needed).
 *
 * Features:
 *  - Fetches entire dataset once, caches it in memory.
 *  - Dynamic client-side filtering via setFilter(fn).
 *  - maxItems guard caps memory usage (default 1000).
 *  - Infinite-scroll: call loadMore() to extend the visible window.
 *  - refresh() re-fetches from server and resets to page 1.
 *
 * Usage:
 *   const paginator = createPaginator(() => bookingsAPI.getAll(), 50);
 *
 *   useEffect(() => {
 *     const unsub = paginator.subscribe((state) => {
 *       setItems(state.items);
 *       setHasMore(state.hasMore);
 *     });
 *     paginator.load();
 *     return unsub;
 *   }, []);
 *
 *   // Dynamic filter (e.g. status change):
 *   paginator.setFilter((b) => b.status === 'Pending');
 *
 *   <FlatList
 *     data={items}
 *     onEndReached={() => paginator.loadMore()}
 *     onEndReachedThreshold={0.4}
 *   />
 */

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_ITEMS = 1000; // memory guard — cap total rendered items

export function createPaginator(fetchAll, pageSize = DEFAULT_PAGE_SIZE, { maxItems = DEFAULT_MAX_ITEMS } = {}) {
  let _allItems = null;
  let _promise  = null;
  let _page     = 0;
  let _filterFn = null;
  const _subs   = new Set();

  function _filtered() {
    if (!_allItems) return [];
    const raw = _filterFn ? _allItems.filter(_filterFn) : _allItems;
    return maxItems < Infinity ? raw.slice(0, maxItems) : raw;
  }

  function _buildState() {
    if (_allItems === null) return { items: [], hasMore: false, total: 0 };
    const filtered = _filtered();
    const visible  = filtered.slice(0, (_page + 1) * pageSize);
    return { items: visible, hasMore: visible.length < filtered.length, total: filtered.length };
  }

  function _notify() {
    const state = _buildState();
    _subs.forEach((cb) => { try { cb(state); } catch {} });
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
      .catch((err) => { _promise = null; throw err; });
    return _promise;
  }

  function subscribe(cb) {
    _subs.add(cb);
    if (_allItems !== null) { try { cb(_buildState()); } catch {} }
    return () => _subs.delete(cb);
  }

  async function load() {
    if (_allItems !== null) { _notify(); return; }
    return _fetchFromServer();
  }

  function loadMore() {
    if (_allItems === null) return;
    if ((_page + 1) * pageSize >= _filtered().length) return;
    _page += 1;
    _notify();
  }

  async function refresh() {
    _allItems = null;
    _page     = 0;
    return _fetchFromServer();
  }

  function setData(data) {
    _allItems = Array.isArray(data) ? data : [];
    _page     = 0;
    _notify();
  }

  function setFilter(fn) {
    _filterFn = fn || null;
    _page     = 0;
    _notify();
  }

  function getState() { return _buildState(); }

  return { subscribe, load, loadMore, refresh, setData, setFilter, getState };
}
