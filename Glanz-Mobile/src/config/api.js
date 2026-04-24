import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

// Priority:
// 1) EXPO_PUBLIC_API_BASE_URL (explicit override)
// 2) Dev host auto-detection from Expo/Metro metadata
// 3) localhost/10.0.2.2 fallback for simulator/emulator scenarios
const hostFromExpoConfig = Constants.expoConfig?.hostUri?.split(':')?.[0];
const hostFromManifest2 = Constants.manifest2?.extra?.expoGo?.debuggerHost?.split(':')?.[0];
const hostFromManifest = Constants.manifest?.debuggerHost?.split(':')?.[0];
const hostFromScriptUrl = NativeModules?.SourceCode?.scriptURL?.split('://')?.[1]?.split('/')?.[0]?.split(':')?.[0];

const hostFromExpo = hostFromExpoConfig || hostFromManifest2 || hostFromManifest || hostFromScriptUrl;
const localFallback = Platform.OS === 'android' ? 'http://10.0.2.2:5289/api' : 'http://localhost:5289/api';

export const API_BASE_URL =
	process.env.EXPO_PUBLIC_API_BASE_URL ||
	(hostFromExpo ? `http://${hostFromExpo}:5289/api` : localFallback);
