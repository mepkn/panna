import { Stack } from "expo-router";
import { strings } from "@/lib/strings";

// title is also the browser tab title on web, so it stays the app name on
// every screen; headerTitle is what the screen header shows.
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerTitleAlign: "left", title: strings.appName }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" options={{ headerTitle: strings.settings.title }} />
    </Stack>
  );
}
