export interface WebEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  demoTenantId: string;
  features: {
    /** Attendance is DEFERRED by owner decision; it stays hidden until the flag is on. */
    attendance: boolean;
  };
}

/** Read Vite env variables (VITE_*). Kept in shared/config for one access point. */
export function readWebEnv(env: ImportMetaEnv): WebEnv {
  return {
    supabaseUrl: env.VITE_SUPABASE_URL ?? '',
    supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY ?? '',
    demoTenantId: env.VITE_DEMO_TENANT_ID ?? '',
    features: { attendance: env.VITE_FEATURE_ATTENDANCE === 'true' },
  };
}
