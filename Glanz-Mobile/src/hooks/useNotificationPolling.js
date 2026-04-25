import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

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
      // Place a short chime at assets/notification.wav
      // Any small WAV/MP3 works — ~0.5 s is ideal
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
 * Polls a fetch function on a fixed interval, pausing when the app goes
 * to the background. Triggers haptics + sound when newCount > prevCount.
 *
 * @param {() => Promise<number>} fetchCount  Returns the current unread count.
 * @param {object} opts
 * @param {number}  [opts.intervalMs=15000]   Poll interval in ms.
 * @param {boolean} [opts.enabled=true]       Set false to pause polling.
 * @param {(count: number) => void} [opts.onCount]  Called on every successful poll.
 */
export function useNotificationPolling(fetchCount, {
  intervalMs = 15_000,
  enabled = true,
  onCount,
} = {}) {
  const prevCountRef = useRef(null);
  const cbRef        = useRef({ fetchCount, onCount });
  useEffect(() => { cbRef.current = { fetchCount, onCount }; });

  const poll = useCallback(async () => {
    if (!cbRef.current.fetchCount) return;
    try {
      const count = Number(await cbRef.current.fetchCount() || 0);
      cbRef.current.onCount?.(count);

      const prev = prevCountRef.current;
      if (prev !== null && count > prev) {
        playNotificationFeedback();
      }
      prevCountRef.current = count;
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    poll();
    const id     = setInterval(poll, intervalMs);
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') poll();
    });

    return () => {
      clearInterval(id);
      appSub.remove();
    };
  }, [enabled, intervalMs, poll]);
}
