# Eventcore Workspace Architecture

## Overview
The Eventcore Workspace is a React-based Single Page Application (SPA) designed to manage event intelligence projects. It acts as a dashboard for configuring event metadata (Venues, Promoters, Dates) and associating raw datasets (CSV schemas and responses).

## Technology Stack
- **Frontend Framework**: React 19 (via ESM imports)
- **Styling**: Tailwind CSS (CDN loaded) + Lucide React (Icons)
- **Backend / Data**: Firebase v12 (Firestore for database, Auth for identity)
- **AI Integration**: Google Gemini API (`@google/genai` SDK)

## Global Configuration
The application relies on global variables injected into the `window` object by the hosting environment for configuration:
- `window.__firebase_config`: JSON string containing Firebase initialization keys.
- `window.__initial_auth_token`: Optional custom token for seamless authentication.
- `window.__app_id`: The specific workspace identifier used in Firestore paths.

## Key Services

### 1. Firebase Service (`services/firebase.ts`)
- **Initialization**: Parses the global config.
- **Authentication**: Strict enforcement. The app requires a valid Firebase configuration and a signed-in user to function.
- **Auto-Healing**: Automatically ensures a User Profile exists in Firestore upon successful login to prevent synchronization issues.
- **Exports**: `auth`, `db`, `appId`.

### 2. Gemini AI Service (`services/geminiService.ts`)
- **Model**: Uses `gemini-2.5-flash-preview-09-2025`.
- **Functionality**: `analyzeEventContext(textOrUrl)`
    - Accepts a URL or raw text description.
    - Generates a structured JSON object extraction (Name, Venue, Dates, etc.).
    - Uses `responseSchema` with `Type.OBJECT` to ensure strict JSON output.
    - Includes fallback logic for demo purposes if the API key is invalid or quota is exceeded.

## Data Model (Firestore)
**Path:** `artifacts/{appId}/public/data/projects/{projectId}`

**Schema:**
```typescript
interface Project {
  id: string;
  name: string;      // e.g., "US Open"
  venue: string;     // e.g., "Arthur Ashe Stadium"
  promoter: string;  // e.g., "USTA"
  year: string;      // e.g., "2024"
  dates: string;     // e.g., "AUG 26 - SEP 08"
  logoUrl: string;   // URL to image
  ownerId: string;   // UID of creator
  createdAt: number; // Timestamp
}
```

## Component Hierarchy

1.  **`App.tsx` (Root Controller)**
    -   Manages global state: `user`, `projects` list, `loading`.
    -   **Authentication Flow**:
        -   Listens to `onAuthStateChanged`.
        -   Forces the `AuthModal` if no user is present.
        -   Loads data only after successful authentication.
    -   Handles Filter/Group logic (Memoized).

2.  **`ProjectModal.tsx` (Editor)**
    -   Handles creation and editing of projects.
    -   **AI Feature**: Calls `geminiService` to auto-fill form data based on a pasted URL.
    -   **Validation**: Checks if "Schema" and "Responses" CSVs are "uploaded" (UI simulation).

3.  **`ProjectDashboard.tsx` (Detail View)**
    -   A placeholder view representing the active state of a specific event hub.

4.  **`ProjectCard.tsx`**
    -   Polymorphic component rendering either a Grid card or a List row based on `viewMode`.

## Standards & Specifications

### Data Requirements
Refer to `DATA_REQUIREMENTS.md` for detailed CSV formatting (Schema/Raw Data) and Firestore metadata definitions.

### GraphQL Generation
Refer to `GRAPHQL_GENERATION.md` for the Standard Operating Configuration (SOC) regarding type-safe operation generation. This specification is reserved for future scalability phases or hybrid implementations where a GraphQL API gateway is introduced.

## State Management
- Local React State (`useState`) is used for UI controls (Modals, View Modes, Search).
- Firestore Real-time listeners act as the "Server State" manager, automatically syncing changes across clients.

# Updates Log

## v1.3.0 - Security & Auth Hardening
**Status:** Current Release

### Security
- **Mandatory Authentication**: Removed all Guest/Demo access paths. The application now strictly requires a logged-in user to access any functionality.
- **Role Management**: Removed "Role" selection from registration and profile forms. New users default to `venue_user`. Admin role escalation is now handled exclusively via backend database administration.
- **Code Cleanup**: Removed legacy mock data generators and anonymous login logic.

## v1.2.0 - Documentation Update
**Status:** Released

### Documentation
- **Data Requirements**: Added `DATA_REQUIREMENTS.md` detailing the Firestore schema structure and the CSV file formats.

## v1.1.0 - Robustness & AI Integration
**Status:** Released

### Features
- **Gemini 2.5 Integration**: Updated AI service to use `gemini-2.5-flash-preview-09-2025`.
- **Enhanced Error Handling**: Authentication failures no longer cause infinite loading loops.