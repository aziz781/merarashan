// True when running inside a Capacitor native shell (Android/iOS app).
export const isNativeCapacitor = (() => {
  try {
    return !!(window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
})();
