import { Stack, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AuthProvider } from "../contexts/AuthContext";
import { setupPushNotifications, addNotificationResponseReceivedListener } from "../utils/pushNotifications";

export default function RootLayout() {
  const router = useRouter();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    setupPushNotifications();

    const notificationSub = notificationListener.current;
    responseListener.current = addNotificationResponseReceivedListener(response => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string') {
        router.push(url as any);
      }
    });

    return () => {
      const responseSub = responseListener.current;
      
      if (notificationSub) {
        notificationSub.remove();
      }
      if (responseSub) {
        responseSub.remove();
      }
    };
  }, [router]);

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </AuthProvider>
  );
}
