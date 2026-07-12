// Web no-op twin of tracking.native.ts.
export async function requestTrackingPermission(): Promise<boolean> {
  return true;
}
