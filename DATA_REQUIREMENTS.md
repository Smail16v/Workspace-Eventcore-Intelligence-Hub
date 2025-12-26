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
| `location` | String | No | City, State, Country | "New York, NY • USA" |
| `dates` | String | No | Human-readable date range | "AUG 26 - SEP 08" |
| `year` | String | Yes | Event year for grouping | "2024" |
| `promoter` | String | Yes | Organizer or sponsor entity | "USTA" |
| `logoUrl` | String | No | Public URL or Base64 string of the logo | `https://...` |
| `ownerId` | String | Yes | Firebase Auth UID of the creator | `user_123` |
| `createdAt` | Number | Yes | Unix timestamp (ms) | `1715620000000` |
| `updatedAt` | Number | No | Unix timestamp (ms) | `1715620000000` |

---

## 2. User Profile (Firestore)

User profiles are strictly one-to-one with Firebase Auth accounts. They are created during registration and used to manage personal details.

**Collection Path:** `users`
**Document ID:** `{userId}` (Matches Firebase Auth UID)

| Field | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `uid` | String | Yes | Firebase Auth User ID | `user_123` |
| `email` | String | Yes | User's email address | `jane@example.com` |
| `fullName` | String | Yes | Display Name | "Jane Doe" |
| `companyName` | String | Yes | Organization Name | "Eventcore Inc" |
| `createdAt` | Number | Yes | Unix timestamp (ms) | `1715620000000` |

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

---

## 5. Qualtrics Integration Workflow

The application supports a "One-Click Import" from a linked Qualtrics account:

1.  **Survey List**: Retrieves active surveys via `GET /surveys`.
2.  **Schema Extraction**: Parses the JSON Definition into the required `Schema CSV`.
3.  **Data Export**: Initiates an export job for `Raw Data` (CSV format).
4.  **Artifact Creation**: Unzips the result and generates the `Responses CSV`.
5.  **Metadata Auto-Fill**: Creates the Project Metadata and initializes the Hub.