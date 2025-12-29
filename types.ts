export interface ProjectMetrics {
  onlinePercent: number;
  onsitePercent: number;
  dateRange: string;
  avgDuration: string;
  engagement: string; 
  surveyLength: string; 
  progressPercent: number;
  totalRespondents: string; 
  source: string; 
  totalDays: string; 
}

export interface Project {
  id?: string;
  name: string;
  venue: string;
  location: string;
  country?: string;
  dates: string;
  year: string;
  promoter: string;
  logoUrl: string;
  ownerId?: string;
  createdAt?: number;
  updatedAt?: number;
  schemaUrl?: string;
  responsesUrl?: string;
  schemaSize?: number;
  responsesSize?: number;
  metrics?: ProjectMetrics;
  prizeInfo?: string; 
  qualtricsSurveyId?: string;
  lastSyncedAt?: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  companyName: string;
  createdAt: number;
  accessLevel: 'all' | string[];
  lastVisit?: number; 
}

// Workspace Layout View Mode
export type ViewMode = 'grid' | 'list';
export type GroupBy = 'none' | 'year' | 'promoter' | 'country' | 'venue';

// --- NEW TYPES ADDED FROM HUB 2 ENGINE ---

/** * Renamed to DashboardViewMode to prevent conflict 
 * with the workspace 'ViewMode' (grid/list) 
 */
export type DashboardViewMode = 'topline' | 'raw' | 'schema';

export interface QuestionDef {
  id: string; // e.g., "Q1"
  text: string; // The full question text
  type: string; // Single, Multi, Matrix, etc.
  choices: string[]; 
  rows?: string[]; // For Matrix questions
  columns?: string[]; // For Matrix questions
  block?: string; 
}

export interface SurveyResponse {
  [key: string]: string; // Column ID -> Answer Value
}

export interface FilterState {
  [questionId: string]: string[]; // Mapping for the interactive filtering system
}

export interface ApiSurvey {
  id: string;
  name: string;
  isActive: boolean;
  creationDate: string;
  lastModifiedDate: string;
}

export interface LoadingStatus {
  isActive: boolean;
  message: string;
}

// Global window declarations
declare global {
  interface Window {
    __firebase_config: string;
    __initial_auth_token?: string;
    __app_id?: string;
  }
}