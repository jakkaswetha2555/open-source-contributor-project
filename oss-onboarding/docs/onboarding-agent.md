# Onboarding Agent Tools & Service Documentation

**Module:** Onboarding Agent Tools  
**Assigned Roll Number:** 25071A0569  
**Directory:** `server/src/services/agent/`  
**Endpoint:** `POST /api/onboarding-agent`  

---

## 1. Overview & Purpose of Tools

The Onboarding Agent is an advisory, read-only system that guides new contributors to suitable starter tasks based on their goals and skills. It does not execute arbitrary code, run shell commands, alter repositories, or modify database ownership/status.

The system comprises three core read-only tools defined with LangChain.js and validated with Zod:

### Tool 1: `findIssues`
- **Purpose:** Discovers candidate open-source issues from the MongoDB `Issue` collection matching a contributor's goal, skills, and project scope.
- **Rules:**
  - Strictly queries open, unassigned issues (`status: 'open'`, `ownerId: null`).
  - Never returns assigned or closed issues.
  - Returns real database records only; never fabricates mock records when the collection is empty.
  - Bounds query results (default 5, max 20).
- **Inputs:**
  ```json
  {
    "projectId": "507f1f77bcf86cd799439011",
    "skills": ["javascript", "react"],
    "goal": "Find a task I can start this weekend",
    "limit": 5
  }
  ```
- **Outputs:**
  ```json
  {
    "issues": [
      {
        "issueId": "507f1f77bcf86cd799439012",
        "title": "Add README setup guide",
        "summary": "Document developer setup steps",
        "projectId": "507f1f77bcf86cd799439011",
        "projectName": "Contributor Portal",
        "projectSlug": "contributor-portal",
        "repoUrl": "https://github.com/example/repo",
        "requiredSkills": ["markdown", "docs"],
        "prerequisites": ["git"],
        "status": "open",
        "ownerId": null,
        "staleSetupFlag": false,
        "setupWarnings": []
      }
    ],
    "count": 1,
    "message": "Found 1 candidate open issue(s)."
  }
  ```

---

### Tool 2: `inspectPrerequisites`
- **Purpose:** Inspects setup requirements, required skills, and documentation for a specific issue from `Issue`, `Document`, and `Snapshot` collections.
- **Rules:**
  - Read-only; does not execute installation commands or mutate records.
  - Does not invent commands or documentation; extracts documented steps from snapshot documentation.
  - Surfaces warnings if maintainers have flagged `staleSetupFlag: true`.
  - Clearly identifies `missingSetupInfo: true` when documentation is absent.
- **Inputs:**
  ```json
  {
    "issueId": "507f1f77bcf86cd799439012"
  }
  ```
- **Outputs:**
  ```json
  {
    "found": true,
    "issueId": "507f1f77bcf86cd799439012",
    "title": "Add README setup guide",
    "summary": "Document developer setup steps",
    "projectId": "507f1f77bcf86cd799439011",
    "projectName": "Contributor Portal",
    "requiredSkills": ["markdown", "docs"],
    "prerequisites": ["git"],
    "staleSetupFlag": false,
    "warnings": [],
    "setupSteps": ["Review repository setup guide in docs/setup.md"],
    "documentation": [
      {
        "filePath": "docs/setup.md",
        "title": "Setup Guide",
        "type": "setup",
        "summary": "Step-by-step developer onboarding instructions..."
      }
    ],
    "evidence": [
      {
        "filePath": "docs/setup.md",
        "snapshotVersion": "v1"
      }
    ],
    "missingSetupInfo": false
  }
  ```

---

### Tool 3: `checkIssueAvailability`
- **Purpose:** Verifies that an issue is currently open and unassigned right before proposing it.
- **Rules:**
  - Treats `status: 'assigned'` or `ownerId != null` as unavailable.
  - Treats `status: 'closed'` as unavailable.
  - Re-checks availability before the final recommendation to guard against race conditions.
  - Does not reserve, assign, or alter the issue.
- **Inputs:**
  ```json
  {
    "issueId": "507f1f77bcf86cd799439012"
  }
  ```
- **Outputs:**
  ```json
  {
    "issueId": "507f1f77bcf86cd799439012",
    "available": true,
    "status": "open",
    "reason": "Issue is currently open and unassigned."
  }
  ```

---

## 2. Agent Workflow & Candidate Selection

Demonstration scenario: **"Find a task I can start this weekend"**

1. **Authentication & Identity:**
   - Identity is strictly retrieved from the authenticated session (`req.user._id`). Any client body-supplied `userId` is ignored and rejected.
2. **AgentRun Initialization:**
   - An `AgentRun` document is inserted with `status: 'running'` and an empty `toolCalls` array.
3. **Candidate Search (`findIssues`):**
   - Calls `findIssues` with the contributor goal, skills, and optional project scope.
   - Every tool call is logged with start time, duration in milliseconds, status, and concise result summary.
4. **Iterative Candidate Screening:**
   - For each candidate:
     1. Runs `checkIssueAvailability`.
     2. If assigned or closed, rejects the candidate and records it. Sets `revisedFrom` to this candidate's ID.
     3. If available, runs `inspectPrerequisites` to retrieve real setup instructions.
     4. Runs a final re-check via `checkIssueAvailability` before finalizing recommendation to prevent race conditions.
     5. If still available, selects this candidate as the final recommendation and halts iteration.
5. **Final Recommendation:**
   - Formulates structured recommendation adhering to `agentRecommendationSchema`.
   - Populates `issueId`, `title`, `project`, `reasons`, `setupSteps`, `evidence`, and `revisedFrom`.
   - If no candidates were available or the database is empty, completes with a clear explanation (`found: false`) without fabricating data.
6. **AgentRun Finalization:**
   - Saves final recommendation and transitions `AgentRun.status` to `'completed'`.
   - On unrecoverable error, transitions `AgentRun.status` to `'failed'`.

---

## 3. Agent-Run Logging

All agent operations are logged directly into MongoDB using the shared `AgentRun` Mongoose model:
- `userId`: ObjectId of the authenticated contributor.
- `projectId`: Optional ObjectId of the project.
- `goal`: Contributor's objective (max 500 characters).
- `status`: `'running'` -> `'completed'` or `'failed'`.
- `toolCalls`: Array of sub-documents recording each executed tool:
  - `name`: Name of tool (`findIssues`, `checkIssueAvailability`, `inspectPrerequisites`).
  - `args`: Sanitized input arguments (sensitive fields like passwords, secrets, or tokens are redacted).
  - `status`: `'ok'`, `'error'`, or `'skipped'`.
  - `resultSummary`: Human-readable summary string.
  - `startedAt`: Timestamp when tool call began.
  - `durationMs`: Duration of tool call in milliseconds.
- `recommendation`: The structured recommendation payload.

---

## 4. API Specification

### Endpoint: `POST /api/onboarding-agent`

**Headers:**
- `Content-Type: application/json`
- `Cookie: sessionToken=<token>` OR `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "projectId": "507f1f77bcf86cd799439011",
  "goal": "Find a task I can start this weekend",
  "skills": ["javascript", "react"],
  "hoursAvailable": 10
}
```

**Success Response (200 OK):**
```json
{
  "runId": "64b0f912a4b3d8123456789a",
  "status": "completed",
  "recommendation": {
    "issueId": "507f1f77bcf86cd799439012",
    "title": "Add README setup guide",
    "summary": "Document developer setup steps",
    "project": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Contributor Portal",
      "slug": "contributor-portal",
      "repoUrl": "https://github.com/example/repo"
    },
    "requiredSkills": ["markdown", "docs"],
    "prerequisites": ["git"],
    "setupSteps": ["Review repository setup guide in docs/setup.md"],
    "evidence": [
      {
        "filePath": "docs/setup.md",
        "snapshotVersion": "v1"
      }
    ],
    "revisedFrom": null,
    "warnings": [],
    "reasons": [
      "Aligned with contributor goal: \"Find a task I can start this weekend\"",
      "Requires relevant skills: markdown, docs",
      "Verified as open, unassigned, and currently eligible for contribution"
    ],
    "explanation": "Issue \"Add README setup guide\" in Contributor Portal is a suitable starter issue for your goal. It is confirmed open and unassigned."
  },
  "toolCalls": [
    {
      "name": "findIssues",
      "args": { "goal": "Find a task I can start this weekend", "limit": 5 },
      "status": "ok",
      "resultSummary": "Found 1 candidate issues",
      "startedAt": "2026-10-10T07:00:00.000Z",
      "durationMs": 4
    },
    {
      "name": "checkIssueAvailability",
      "args": { "issueId": "507f1f77bcf86cd799439012" },
      "status": "ok",
      "resultSummary": "Issue 507f1f77bcf86cd799439012 is open and available",
      "startedAt": "2026-10-10T07:00:00.005Z",
      "durationMs": 2
    },
    {
      "name": "inspectPrerequisites",
      "args": { "issueId": "507f1f77bcf86cd799439012" },
      "status": "ok",
      "resultSummary": "Prerequisites inspected for 507f1f77bcf86cd799439012. Skills: 2, Steps: 1",
      "startedAt": "2026-10-10T07:00:00.008Z",
      "durationMs": 3
    },
    {
      "name": "checkIssueAvailability",
      "args": { "issueId": "507f1f77bcf86cd799439012" },
      "status": "ok",
      "resultSummary": "Issue 507f1f77bcf86cd799439012 is open and available",
      "startedAt": "2026-10-10T07:00:00.012Z",
      "durationMs": 1
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: Authentication required or invalid/expired session.
  ```json
  {
    "error": { "code": "unauthorized", "message": "Authentication required" }
  }
  ```
- `422 Unprocessable Entity`: Body validation failed (e.g. goal too short).
  ```json
  {
    "error": {
      "code": "validation_error",
      "message": "Invalid request",
      "details": [{ "path": "goal", "message": "String must contain at least 3 character(s)" }]
    }
  }
  ```
- `500 Internal Server Error`: Server errors are sanitized without leaking stack traces.
  ```json
  {
    "error": { "code": "server_error", "message": "Internal server error" }
  }
  ```

---

## 5. Running Tests

Run the test suite using Node.js built-in test runner:

```bash
cd oss-onboarding/server
npm test
```

All unit and API integration tests run with mocked database queries in memory and do not require a live Atlas cluster.

---

## 6. Environment Configuration

Defined in `.env` (copied from `server/.env.example`):
- `MONGODB_URI`: MongoDB connection string.
- `SESSION_SECRET`: Random secret string (min 16 chars) for session tokens.
- `CLIENT_ORIGIN`: Allowed CORS origin (default `http://localhost:5173`).
- `PORT`: HTTP port (default `5000`).
- `NODE_ENV`: Environment mode (`development`, `test`, `production`).
