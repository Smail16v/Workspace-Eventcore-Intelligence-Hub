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
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  companyName: string;
  createdAt: number;
}

export type ViewMode = 'grid' | 'list';
export type GroupBy = 'none' | 'year' | 'promoter' | 'location' | 'venue';

// Declare globals injected by the environment
declare global {
  interface Window {
    __firebase_config: string;
    __initial_auth_token?: string;
    __app_id?: string;
  }
}