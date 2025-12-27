# Data Requirements & Specifications

This document outlines the data structures, file formats, and schema requirements necessary for the Eventcore Intelligence Hub to function correctly.

## 1. Project Metadata (Firestore)

Projects are stored as documents in the Firestore database. This metadata drives the Workspace UI and configures the dashboard.

**Collection Path:** `projects` (Root Collection)

| Field | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String | Yes | Unique document ID (Auto-generated) | `7x8d9s0f...` |
| `name` | String | Yes | Official name of the event | "US Open Tennis" |
| `venue` | String | No | Primary location name | "Arthur Ashe Stadium" |
| `location` | String | No | City, State | "New York, NY" |
| `country` | String | No | Country Code or Name | "USA" |
| `dates` | String | No | Human-readable date range | "AUG 26 - SEP 08" |
| `year` | String | Yes | Event year for grouping | "2025" |
| `promoter` | String | Yes | Organizer or sponsor entity | "USTA" |
| `logoUrl` | String | No | Public URL or Base64 string | `https://...` |
| `ownerId` | String | Yes | Firebase Auth UID of the creator | `user_123` |
| `createdAt` | Number | Yes | Unix timestamp (ms) | `1715620000000` |
| `updatedAt` | Number | No | Unix timestamp (ms) | `1715620000000` |

---

## 2. User Profile (Firestore)

User profiles are strictly one-to-one with Firebase Auth accounts. They are used for identity and access control.

**Collection Path:** `users`
**Document ID:** `{userId}` (Matches Firebase Auth UID)

| Field | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `uid` | String | Yes | Firebase Auth User ID | `user_123` |
| `email` | String | Yes | User's email address | `jane@example.com` |
| `fullName` | String | Yes | Display Name | "Jane Doe" |
| `companyName` | String | Yes | Organization Name | "Eventcore Inc" |
| `accessLevel` | Mixed | Yes | RBAC Settings | `'all'` or `["proj_id1"]` |
| `createdAt` | Number | Yes | Unix timestamp (ms) | `1715620000000` |

### Access Level Details
- **Admin**: `accessLevel` = `'all'` (String). Has full read/write access to all projects and can manage other users.
- **Guest**: `accessLevel` = `["project_id_1", "project_id_2"]` (Array of Strings). Has Read-Only access strictly to the IDs listed.

---

## 3. File Artifacts (CSV Datasets)

To initialize a Hub, two specific CSV files are required. The system can accept these via manual upload or **automatically generate them via the Qualtrics API integration**.

### A. Schema CSV (Survey Definition)
Defines the structure of the survey questions and variables.

*   **Naming Convention:** `Q_{ProjectName}.csv`
*   **Format:** standard comma-separated values.
*   **Required Columns:** `Variable`, `Label`, `Type`, `Values`.

### B. Responses CSV (Raw Data)
Contains the raw survey responses collected from attendees.

*   **Naming Convention:** `RawData_{ProjectName}.csv`
*   **Format:** standard comma-separated values.

---

## 4. Branding Assets

### Project Logo
*   **Format:** PNG, JPG, or SVG (Transparent background recommended).
*   **Aspect Ratio:** Square (1:1) is preferred for best display in cards.
