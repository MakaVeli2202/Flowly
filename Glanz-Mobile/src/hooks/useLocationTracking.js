import { useState, useCallback, useRef, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert, AppState } from 'react-native';
import { locationAPI } from '../api/location';

const LOCATION_UPDATE_INTERVAL = 8000;

export function useLocationTracking() {
  const [isLocationSharing, setIsLocationSharing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);
  
  const trackingRef = useRef(null);
  const subscriptionRef = useRef(null);
  const currentBookingIdRef = useRef(null);

  const requestPermission = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please enable location services to track your position for customers.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      return true;
    } catch (error) {
      setLocationError('Failed to request location permission');
      return false;
    }
  }, []);

  const getCurrentLocation = useCallback(async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
      });
      return location;
    } catch (error) {
      setLocationError('Failed to get current location');
      return null;
    }
  }, []);

  const startTracking = useCallback(async (bookingId) => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return false;
    }

    if (!bookingId) {
      setLocationError('No booking ID provided');
      return false;
    }

    currentBookingIdRef.current = bookingId;

    try {
      const location = await getCurrentLocation();
      if (!location) return false;

      setIsLocationSharing(true);
      setLocationError(null);

      trackingRef.current = setInterval(async () => {
        try {
          const currentLoc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          const locData = {
            latitude: currentLoc.coords.latitude,
            longitude: currentLoc.coords.longitude,
          };

          setCurrentLocation({
            ...locData,
            timestamp: currentLoc.timestamp,
          });

          try {
            await locationAPI.updateLocation(bookingId, locData.latitude, locData.longitude);
          } catch (apiError) {
            console.warn('Failed to send location update:', apiError);
          }
        } catch (locError) {
          console.warn('Failed to get location:', locError);
        }
      }, LOCATION_UPDATE_INTERVAL);

      const firstUpdate = await locationAPI.updateLocation(
        bookingId,
        location.coords.latitude,
        location.coords.longitude
      );

      return true;
    } catch (error) {
      setLocationError('Failed to start location tracking');
      setIsLocationSharing(false);
      return false;
    }
  }, [hasPermission, requestPermission, getCurrentLocation]);

  const stopTracking = useCallback(async () => {
    if (trackingRef.current) {
      clearInterval(trackingRef.current);
      trackingRef.current = null;
    }

    const bookingId = currentBookingIdRef.current;
    if (bookingId) {
      try {
        await locationAPI.stopLocation(bookingId);
      } catch (error) {
        console.warn('Failed to stop location on server:', error);
      }
    }

    currentBookingIdRef.current = null;
    setIsLocationSharing(false);
  }, []);

  const toggleLocationSharing = useCallback(async (bookingId) => {
    if (isLocationSharing) {
      await stopTracking();
    } else {
      await startTracking(bookingId);
    }
  }, [isLocationSharing, startTracking, stopTracking]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' && isLocationSharing) {
      } else if (nextAppState === 'active' && isLocationSharing && currentBookingIdRef.current) {
        getCurrentLocation();
      }
    });

    return () => {
      appStateSubscription.remove();
      if (trackingRef.current) {
        clearInterval(trackingRef.current);
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
    };
  }, [isLocationSharing, getCurrentLocation]);

  return {
    isLocationSharing,
    currentLocation,
    locationError,
    hasPermission,
    startTracking,
    stopTracking,
    toggleLocationSharing,
    requestPermission,
    getCurrentLocation,
  };
}

export default useLocationTracking;