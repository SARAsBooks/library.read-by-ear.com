interface Student {
  studentId: string;
  name: string;
  PIE: string;
}

interface Notifications {
  reminders: boolean;
  studentProgress: boolean;
  bookRecommendations: boolean;
  newFeatures: boolean;
}

export interface Session {
  sessionId?: string;
  studentId?: string;
  anonymous: boolean;
  authenticated: boolean;
  deviceOwnership?: "public" | "private" | "family" | "school";
  saveProgress?: "local" | "sync";
  userId?: string;
  students?: Student[];
  progressiveWebApp?: "iOS" | "Android" | "other";
  notificationsEnabled?: Notifications;
}
