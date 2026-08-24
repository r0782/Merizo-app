import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Overbudget alerts ────────────────────────────────────────────────────────

const ALERTS_KEY = "merizo_overbudget_alerts";
const NOTIF_MAP_KEY = "merizo_notif_map";

export async function getOverbudgetAlerts(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(ALERTS_KEY);
    if (v === null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

export async function setOverbudgetAlerts(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ALERTS_KEY, enabled ? "1" : "0");
  } catch {}
}

type NotifMap = Record<string, string>;

export async function getNotifMap(): Promise<NotifMap> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function setNotifId(reminderId: string, notifId: string): Promise<void> {
  try {
    const map = await getNotifMap();
    map[reminderId] = notifId;
    await AsyncStorage.setItem(NOTIF_MAP_KEY, JSON.stringify(map));
  } catch {}
}

export async function popNotifId(reminderId: string): Promise<string | null> {
  try {
    const map = await getNotifMap();
    const v = map[reminderId] || null;
    if (v) {
      delete map[reminderId];
      await AsyncStorage.setItem(NOTIF_MAP_KEY, JSON.stringify(map));
    }
    return v;
  } catch {
    return null;
  }
}
