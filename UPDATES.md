# Updates Log

## v1.5.0 - Enterprise Security & Admin Controls
**Status:** Current Release

### Security
- **RBAC Re-Implementation**: Re-introduced strict Role-Based Access Control. The "Open Access" model (v1.4.0) has been deprecated in favor of a secure Admin/Guest hierarchy.
- **Admin Dashboard**: Added a new `UserManagementModal` allowing Administrators to:
  - View all registered users.
  - Promote/Demote Admins.
  - Assign specific project access to Guest users.
- **Firestore Rules**: Updated rules to enforce read/write permissions based on the `accessLevel` field on the user profile.

### Data Model
- **Projects**: Added `country` field to better support international event filtering.
- **Users**: `accessLevel` is now the single source of truth for permissions (superseding previous role fields).

---

## v1.4.1 - Database Simplification
**Status:** Released

### Data
- **Path Update**: Simplified project storage from `artifacts/{appId}/public/data/projects` to a root-level `projects` collection. This improves visibility in the Firebase Console and simplifies security rules.

---

## v1.4.0 - Access Control Simplification
**Status:** Deprecated (Superseded by v1.5.0)

### Security
- **Open Access Model**: Removed Role-Based Access Control (RBAC). All users had full access.

---

## v1.3.0 - Security & Auth Hardening
**Status:** Released

### Security
- **Mandatory Authentication**: Removed all Guest/Demo access paths.
- **Role Management**: Removed "Role" selection from registration forms.

---

## v1.2.0 - Documentation Update
**Status:** Released

### Documentation
- **Data Requirements**: Added `DATA_REQUIREMENTS.md` detailing the Firestore schema structure and the CSV file formats.

---

## v1.1.0 - Robustness & AI Integration
**Status:** Released

### Features
- **Mock Mode**: Graceful degradation when API keys are missing.
- **Gemini 2.5 Integration**: Updated AI service to use `gemini-2.5-flash-preview-09-2025` with Search Grounding.
- **Enhanced Error Handling**: Authentication failures no longer cause infinite loading loops.
