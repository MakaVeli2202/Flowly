import { useState, useEffect } from 'react';
import { getConnectionState, onConnectionStateChange } from '../api/realtimeService';

/**
 * Returns the current WebSocket connection state.
 * @returns {'connected' | 'reconnecting' | 'disconnected'}
 */
export function useRealtimeStatus() {
  const [status, setStatus] = useState(getConnectionState);

  useEffect(() => {
    return onConnectionStateChange(setStatus);
  }, []);

  return status;
}
