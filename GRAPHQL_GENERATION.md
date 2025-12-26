# GraphQL Generation Specification

## Overview
This document defines the Standard Operating Configuration (SOC) for generating type-safe GraphQL operations within the Eventcore ecosystem. While the current workspace uses Firebase, this specification ensures readiness for hybrid data sources or future migrations to GraphQL backends.

## The Problem
Manual typing of API responses is error-prone and leads to "drift" between the server schema and client interfaces.

## The Solution: Code Generation
We utilize a "Schema-First" approach combined with **GraphQL Code Generator**. This pipeline automatically generates TypeScript types and React hooks from our GraphQL operations.

---

## 1. Toolchain Configuration

**Engine:** `@graphql-codegen/cli`

### Standard Configuration (`codegen.ts`)
The generator must be configured to output a single presets file for optimal type inference.

```typescript
import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
  documents: ['src/**/*.graphql'],
  ignoreNoDocuments: true, // for cleaner console output
  generates: {
    './src/generated/': {
      preset: 'client',
      plugins: [],
      presetConfig: {
        gqlTagName: 'gql',
      }
    }
  }
};

export default config;
```

---

## 2. Directory Structure & SOC (Separation of Concerns)

To maintain a clean separation between UI components and Data Logic, GraphQL operations must follow this directory structure:

```text
src/
├── components/         # UI Components (Pure, Presentational)
├── features/           # Feature-based modules
│   └── ProjectDashboard/
│       ├── index.tsx
│       └── ProjectDashboard.graphql  <-- Co-located operations
├── generated/          # AUTO-GENERATED (Do not edit)
│   ├── index.ts
│   └── graphql.ts
└── services/           # Global services
```

---

## 3. Naming Conventions

### Operations
Must use **PascalCase** and end with the operation type (`Query`, `Mutation`, `Fragment`).

*   **Correct:** `GetProjectDetailsQuery`
*   **Incorrect:** `getProject`, `projectQuery`

### Files
Must end in `.graphql`.

*   **Correct:** `ProjectDashboard.graphql`
*   **Incorrect:** `queries.ts`

---

## 4. Example Workflow

### Step A: Define the Operation
Create a `.graphql` file next to your component.

```graphql
# src/features/Project/Project.graphql

fragment ProjectCardFields on Project {
  id
  name
  venue
  dates
  logoUrl
}

query GetProject($id: ID!) {
  project(id: $id) {
    ...ProjectCardFields
    promoter
    year
  }
}
```

### Step B: Generate Code
Run the generation script (standardized in `package.json`).

```bash
npm run codegen
```

### Step C: Consume in Component
Use the generated hooks. **Do not** write manual fetchers.

```tsx
import { useQuery } from '@apollo/client';
import { GetProjectDocument } from '../../generated/graphql';

const ProjectView = ({ id }) => {
  // Completely type-safe data and variables
  const { data, loading } = useQuery(GetProjectDocument, { 
    variables: { id } 
  });

  if (loading) return <Loader />;
  
  return <h1>{data?.project?.name}</h1>;
}
```

---

## 5. Drift Detection
In CI/CD pipelines, the generation script should run with a "check" flag to ensure the generated code matches the current schema and operations, preventing deployment of broken types.
