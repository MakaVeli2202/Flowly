import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { subscribeToNotifications } from '../api/notificationBus';

// Singleton sound instance — loaded once, reused on every notification
let _sound = null;
let _soundLoading = false;
let _lastFiredAt = 0;
const FEEDBACK_COOLDOWN_MS = 10_000;

async function _getSound() {
  if (_sound) return _sound;
  if (_soundLoading) return null;
  _soundLoading = true;
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/notification.wav'),
      { shouldPlay: false, volume: 0.8 }
    );
    _sound = sound;
    return sound;
  } catch {
    return null;
  } finally {
    _soundLoading = false;
  }
}

export async function playNotificationFeedback() {
  const now = Date.now();
  if (now - _lastFiredAt < FEEDBACK_COOLDOWN_MS) return;
  _lastFiredAt = now;

  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch { /* silent */ }

  try {
    const sound = await _getSound();
    if (sound) {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    }
  } catch { /* silent */ }
}

/**
 * Subscribes to WebSocket notification events and triggers haptics + sound
 * when a new notification arrives and the unread count increases.
 *
 * @param {() => Promise<number>} fetchCount  Returns the current unread count.
 * @param {object} opts
 * @param {boolean} [opts.enabled=true]       Set false to pause.
 * @param {(count: number) => void} [opts.onCount]  Called on every successful fetch.
 */
export function useNotificationPolling(fetchCount, {
  enabled = true,
  onCount,
} = {}) {
  const prevCountRef = useRef(null);
  const cbRef = useRef({ fetchCount, onCount });
  useEffect(() => { cbRef.current = { fetchCount, onCount }; });

  useEffect(() => {
    if (!enabled) return;

    // Fetch once on mount
    cbRef.current.fetchCount?.()
      .then(count => {
        const n = Number(count || 0);
        cbRef.current.onCount?.(n);
        prevCountRef.current = n;
      })
      .catch(() => {});

    // React to WebSocket notification events
    return subscribeToNotifications(async () => {
      if (!cbRef.current.fetchCount) return;
      try {
        const count = Number(await cbRef.current.fetchCount() || 0);
        cbRef.current.onCount?.(count);
        const prev = prevCountRef.current;
        if (prev !== null && count > prev) playNotificationFeedback();
        prevCountRef.current = count;
      } catch { /* silent */ }
    });
  }, [enabled]);
}
