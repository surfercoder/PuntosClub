import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      return null;
    }

    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
      
      if (!projectId) {
        return null;
      }

      const pushTokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      
      token = pushTokenData.data;
    } catch (e) {
      return null;
    }
  } else {
    return null;
  }

  return token;
}

export async function savePushTokenToBackend(expoPushToken: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      return false;
    }

    const deviceId = Device.modelName || Device.deviceName || 'unknown';
    const platform = Platform.OS;

    // Get API URL - must be explicitly set in environment variables
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    
    if (!apiUrl) {
      return false;
    }

    // Validate URL format
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      return false;
    }
    
    const response = await fetch(`${apiUrl}/api/push-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        expoPushToken,
        deviceId,
        platform,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

export async function setupPushNotifications() {
  const token = await registerForPushNotificationsAsync();
  
  if (token) {
    await savePushTokenToBackend(token);
  }
  
  return token;
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
