# Updates Log

## v1.1.0 - Robustness & AI Integration
**Status:** Current Release

### Features
- **Mock Mode / Graceful Degradation**: 
  - Added detection for missing or invalid Firebase API keys.
  - The app now loads in a "Read-Only" state instead of crashing with `auth/invalid-api-key` errors.
  - Guest users are alerted when attempting to save data without valid configuration.
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
