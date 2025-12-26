export interface Project {
  id?: string;
  name: string;
  venue: string;
  location: string;
  dates: string;
  year: string;
  promoter: string;
  logoUrl: string;
  ownerId?: string;
  createdAt?: number;
  updatedAt?: number;
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