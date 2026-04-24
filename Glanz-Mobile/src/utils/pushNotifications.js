import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Vibration } from 'react-native';
import Constants from 'expo-constants';

const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId;

export async function setupAndroidChannel() {
  if (Platform.OS !== 'android') return;
  // Delete then recreate — Android ignores sound/vibration updates on existing channels,
  // so we must delete first to guarantee our settings take effect.
  await Notifications.deleteNotificationChannelAsync('default').catch(() => {});
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: '#C8A96B',
    sound: 'default',
    enableVibrate: true,
  });
}

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    return tokenData.data;
  } catch {
    return null;
  }
}

let _foregroundVibrateListener = null;

export function configureForegroundNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList:   true,
      shouldPlaySound:  true,
      shouldSetBadge:   true,
    }),
  });

  // Only register one listener — hot reloads would otherwise stack duplicates
  if (_foregroundVibrateListener) {
    _foregroundVibrateListener.remove();
  }
  _foregroundVibrateListener = Notifications.addNotificationReceivedListener(() => {
    Vibration.vibrate([0, 250, 150, 250]);
  });
}
