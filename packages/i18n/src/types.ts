export interface Dictionary {
  appName: string;
  nav: {
    projects: string;
    workers: string;
    attendance: string;
    safety: string;
    incidents: string;
    reports: string;
  };
  actions: {
    create: string;
    edit: string;
    delete: string;
    save: string;
    cancel: string;
    submit: string;
    approve: string;
    reject: string;
  };
  common: {
    loading: string;
    empty: string;
    error: string;
    retry: string;
    offline: string;
  };
  sync: {
    statusIdle: string;
    statusSyncing: string;
    statusRetry: string;
    syncNow: string;
    unsynced: string;
    conflicts: string;
    failed: string;
    lastSync: string;
    never: string;
    keepServer: string;
    keepMine: string;
    retryFailed: string;
    conflictHint: string;
    offlineBanner: string;
  };
  auth: {
    logout: string;
    logoutWarnTitle: string;
    logoutWarnBody: string;
    syncThenLogout: string;
    logoutAnyway: string;
    deviceBusy: string;
    offlineFirstLogin: string;
  };
  workerForm: {
    add: string;
    code: string;
    fullName: string;
    phone: string;
    submit: string;
    saved: string;
    invalid: string;
  };
}
