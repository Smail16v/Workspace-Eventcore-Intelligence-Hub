# Updates Log

## v1.2.0 - Documentation Update
**Status:** Current Release

### Documentation
- **Data Requirements**: Added `DATA_REQUIREMENTS.md` detailing the Firestore schema structure and the CSV file formats (`Q_*.csv` and `RawData_*.csv`) required for project initialization.

---

## v1.1.0 - Robustness & AI Integration
**Status:** Released

### Features
- **Mock Mode / Graceful Degradation**: 
  - Added detection for missing or invalid Firebase API keys.
  - The app now loads in a "Read-Only" state instead of crashing with `auth/invalid-api-key` errors.
  - Guest users are alerted when attempting to save data without valid configuration.
  - **Demo Data Persistence**: In Mock mode, "Initialize Hub" now saves projects to local React state, allowing full UI testing without a database connection.
- **Gemini 2.5 Integration**: 
  - Updated AI service to use `gemini-2.5-flash-preview-09-2025`.
  - Implemented `responseSchema` for strict JSON generation during event context analysis.
- **Enhanced Error Handling**:
  - Authentication failures no longer cause infinite loading loops.
  - Firestore connection failures are logged without breaking the UI.

### Bug Fixes
- Fixed `Uncaught FirebaseError` when `window.__firebase_config` was undefined.
- Fixed race conditions in `useEffect` hooks regarding authentication state.

---

## v1.0.0 - Initial Workspace Release
**Status:** Deprecated

### Features
- **Project Management**: Create, Read, Update event projects.
- **Real-time Sync**: Firestore integration for live updates.
- **Views**: Toggle between Grid and List views.
- **Grouping**: Group projects by Year, Promoter, Venue, or Location.
- **UI**: Tailwind CSS implementation with `lucide-react` icons.
- **Simulation**: UI support for "uploading" Schema and Raw Data CSVs (Metadata only).

Here are the specific updates:
types.ts: Removed role from the UserProfile interface.
services/firebase.ts: Removed role handling in registerUser and ensureUserProfileExists.
components/AuthModal.tsx: Removed the role state and updated the registration call.
components/ProfileModal.tsx: Removed role from the local state and update logic.
FIREBASE_RULES.md: Simplified rules to allow any authenticated user to create, update, or delete projects (Collaborative Workspace mode).
DATA_REQUIREMENTS.md: Updated documentation to reflect the removal of the role field.
ARCHITECTURE.md: Logged the v1.4.0 update.