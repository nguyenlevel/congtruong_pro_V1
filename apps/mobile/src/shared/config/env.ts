export interface MobileEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Optional fixed id (tests, CI). When empty the app creates and persists its own. */
  deviceId: string;
  features: {
    /** Attendance is DEFERRED by owner decision; it stays hidden until the flag is on. */
    attendance: boolean;
  };
}

/** Read Expo public env variables (EXPO_PUBLIC_*). Single access point. */
export function readMobileEnv(env: Record<string, string | undefined>): MobileEnv {
  return {
    supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    deviceId: env.EXPO_PUBLIC_DEVICE_ID ?? '',
    features: { attendance: env.EXPO_PUBLIC_FEATURE_ATTENDANCE === 'true' },
  };
}
