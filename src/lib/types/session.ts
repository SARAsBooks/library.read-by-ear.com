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

export type Session = {
  sessionId?: string;
  studentId?: string;
  lastActive: number;
  anonymous: boolean;
  authenticated: boolean;
  deviceOwnership?: "public" | "private" | "family" | "school";
  saveProgress?: "local" | "sync";
  userId?: string;
  students?: Student[];
  progressiveWebApp?: "iOS" | "Android" | "other";
  notificationsEnabled?: Notifications;
}
