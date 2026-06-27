// Per-device identity. No login — just a stable device id (merge key) and a display
// name for attribution. Persisted in localStorage.
import { newDeviceId } from "../domain/ids";

export function getIdentity(): { deviceId: string; displayName: string } {
  let deviceId = localStorage.getItem("ductmanage.deviceId");
  if (!deviceId) {
    deviceId = newDeviceId();
    localStorage.setItem("ductmanage.deviceId", deviceId);
  }
  const displayName = localStorage.getItem("ductmanage.displayName") || "Site user";
  return { deviceId, displayName };
}
