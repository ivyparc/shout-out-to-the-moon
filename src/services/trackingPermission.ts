import { Platform } from "react-native";
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from "expo-tracking-transparency";

export async function requestTrackingPermission(): Promise<string> {
  if (Platform.OS !== "ios") {
    return "not-ios";
  }

  const current = await getTrackingPermissionsAsync();
  if (current.status !== "undetermined") {
    return current.status;
  }

  const requested = await requestTrackingPermissionsAsync();
  return requested.status;
}
