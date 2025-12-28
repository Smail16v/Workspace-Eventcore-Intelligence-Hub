export interface ProjectMetrics {
  onlinePercent: number;
  onsitePercent: number;
  dateRange: string;
  avgDuration: string;
  engagement: string; // e.g. "26.6Qs"
  surveyLength: string; // e.g. "52Questions"
  progressPercent: number;
  totalRespondents: string; // New field: "n = 1626"
  source: string; // New field: "Qualtrics Source" or "Digivey Source"
  totalDays: string; // New field for "X days"
}

export interface Project {
  id?: string;
  name: string;
  venue: string;
  location: string;
  country?: string; // New field
  dates: string;
  year: string;
  promoter: string;
  logoUrl: string;
  ownerId?: string;
  createdAt?: number;
  updatedAt?: number;
  // Storage URLs for synced CSVs
  schemaUrl?: string;
  responsesUrl?: string;
  // File Meta
  schemaSize?: number;
  responsesSize?: number;
  // Snapshot Analytics
  metrics?: ProjectMetrics;
  prizeInfo?: string; // New field for AI-extracted prize description
  // Source Linkage
  qualtricsSurveyId?: string;
  lastSyncedAt?: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  companyName: string;
  createdAt: number;
  // RBAC: 'all' = Admin, string[] = Guest with specific project access
  accessLevel: 'all' | string[];
  lastVisit?: number; // Timestamp of user's previous session
}

export type ViewMode = 'grid' | 'list';
export type GroupBy = 'none' | 'year' | 'promoter' | 'country' | 'venue';

// Declare globals injected by the environment
declare global {
  interface Window {
    __firebase_config: string;
    __initial_auth_token?: string;
    __app_id?: string;
  }
}