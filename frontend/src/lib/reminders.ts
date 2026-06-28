import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type ReminderSettings = {
  reminders_enabled: boolean;
  reminder_interval: number; // minutes
  reminder_start: string; // "HH:MM"
  reminder_end: string; // "HH:MM"
};

export async function ensureNotificationPermission(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> {
  if (Platform.OS === "web") return { granted: false, canAskAgain: false };
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return { granted: true, canAskAgain: true };
  if (!current.canAskAgain) return { granted: false, canAskAgain: false };
  const req = await Notifications.requestPermissionsAsync();
  return { granted: req.granted, canAskAgain: req.canAskAgain };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

// Schedules a daily local notification at each interval slot within the window.
export async function scheduleHydrationReminders(
  s: ReminderSettings,
  body: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!s.reminders_enabled) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("hydration", {
      name: "Hydration",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const start = toMinutes(s.reminder_start || "08:00");
  const end = toMinutes(s.reminder_end || "22:00");
  const step = Math.max(30, s.reminder_interval || 120);

  for (let t = start; t <= end; t += step) {
    const hour = Math.floor(t / 60);
    const minute = t % 60;
    await Notifications.scheduleNotificationAsync({
      content: { title: "Aquadify 💧", body, channelId: "hydration" },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  }
}
