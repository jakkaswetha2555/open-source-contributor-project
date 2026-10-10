# Module 4: Public and Contributor APIs

**Roll Number:** 25071A0534  
**Role:** Public and Contributor APIs  
**Branch:** `feat/projects-issues-0534`  
**Folders / Files Owned:**
- `server/src/routes/projects.routes.js`
- `server/src/routes/issues.routes.js`
- `server/src/routes/plans.routes.js`
- `server/src/middleware/auth.js`
- `server/tests/projectsApi.test.js`
- `server/tests/issuesApi.test.js`
- `server/tests/plansApi.test.js`
- `server/src/seed/seed.js`

---

## 1. Module Overview & Responsibilities

In accordance with Project 12 (*Open Source Contributor Onboarding*):
- **First-Hour Deliverable:**
  - `GET /api/projects`: Browse approved public projects (verified public only).
  - `GET /api/projects/:id/issues`: Open issue summaries and contribution requirements (filters out assigned/closed issues, supports slug or ObjectId, blocks private project leakage).
  - `POST /api/issues/:id/interest`: Save contributor interest in an issue (requires auth, strict Zod validation, prevents duplicates).
  - **Proof Delivered:** Real JSON responses from the seeded database.
- **Milestone 2 Deliverables (Target 11 October):**
  - `POST /api/contribution-plans`: Create plan with mandatory repository evidence (enforces server-side authorId from session, blocks body spoofing).
  - `GET /api/contribution-plans/:id`: Read contribution plan (strictly enforces ownership: only author or project maintainer can view).
  - `PATCH /api/issues/:id`: Update issue status, flag stale setup instructions, update summary/skills (maintainer only).
  - `POST /api/projects/:id/imports`: Maintainer snapshot import endpoint.
  - `POST /api/contribution-plans/:id/review`: Maintainer review endpoint.

---

## 2. API Endpoints Specification & Access Control

| Method | Endpoint | Access Level | Description |
|---|---|---|---|
| `GET` | `/api/projects` | **Public** | Lists verified public projects. Excludes unverified or private projects. |
| `GET` | `/api/projects/:id` | **Public / Maintainer** | Get project details by ObjectId or slug. Blocks unauthorized access to private projects. |
| `GET` | `/api/projects/:id/issues` | **Public / Maintainer** | Returns open issues and required skills/prerequisites for a project. Default filter: `status: 'open'`. |
| `POST` | `/api/issues/:id/interest` | **Contributor** | Record contributor interest. Strict body (`{}`), session cookie/bearer auth required. |
| `PATCH` | `/api/issues/:id` | **Project Maintainer** | Update issue fields, flag stale setup instructions, assign owner. Rejects non-maintainers with `403`. |
| `POST` | `/api/contribution-plans` | **Contributor** | Submit structured plan with snapshot evidence. `authorId` forced from session. |
| `GET` | `/api/contribution-plans/:id` | **Author or Maintainer** | View plan details. Rejects other contributors or moderators with `403`. |
| `POST` | `/api/contribution-plans/:id/review` | **Project Maintainer** | Approve or request changes. Approving assigns issue to contributor. |
| `POST` | `/api/projects/:id/imports` | **Project Maintainer** | Import snapshot docs and issues. |

---

## 3. Proof of Deliverables (Real Seeded Database Output)

The following outputs are generated against a live Express server (`http://localhost:5000`) connected to a live local MongoDB instance seeded with 2 public projects, 1 private project, and 12 issues.

### 3.1. `GET /api/projects` (Public Project Discovery)
**Command:**
```bash
curl -s http://localhost:5000/api/projects
```
**Response (HTTP 200):**
```json
{
  "count": 2,
  "projects": [
    {
      "_id": "6aca518c183db44232e2d695",
      "name": "Markdown Docgen",
      "slug": "markdown-docgen",
      "description": "CLI tool to generate documentation structures and API references from JSDoc.",
      "repoUrl": "https://github.com/oss-hub/markdown-docgen",
      "visibility": "public",
      "verificationStatus": "verified",
      "createdAt": "2026-10-10T14:54:04.500Z",
      "updatedAt": "2026-10-10T14:54:04.500Z"
    },
    {
      "_id": "6aca518c183db44232e2d694",
      "name": "Express Query Kit",
      "slug": "express-query-kit",
      "description": "A composable request validation, pagination and filtering toolkit for Express.",
      "repoUrl": "https://github.com/oss-hub/express-query-kit",
      "visibility": "public",
      "verificationStatus": "verified",
      "createdAt": "2026-10-10T14:54:04.498Z",
      "updatedAt": "2026-10-10T14:54:04.514Z",
      "currentSnapshotId": "6aca518c183db44232e2d69a"
    }
  ]
}
```
*Note: Private project `internal-metrics-core` is strictly omitted from the public catalog.*

---

### 3.2. `GET /api/projects/:id/issues` (Open Issues for Project)
**Command (by slug or ID):**
```bash
curl -s http://localhost:5000/api/projects/express-query-kit/issues
```
**Response (HTTP 200):**
```json
{
  "project": {
    "_id": "6aca518c183db44232e2d694",
    "name": "Express Query Kit",
    "slug": "express-query-kit",
    "visibility": "public",
    "verificationStatus": "verified"
  },
  "count": 4,
  "issues": [
    {
      "_id": "6aca518c183db44232e2d6a3",
      "projectId": "6aca518c183db44232e2d694",
      "snapshotId": "6aca518c183db44232e2d69a",
      "title": "Fix edge case with null values in query boolean flags",
      "summary": "When ?active=null is passed, coerce gracefully rather than failing with TypeError.",
      "requiredSkills": ["JavaScript"],
      "prerequisites": ["Node 20 installed"],
      "status": "open",
      "ownerId": null,
      "staleSetupFlag": false,
      "createdAt": "2026-10-10T14:54:04.534Z",
      "updatedAt": "2026-10-10T14:54:04.534Z"
    },
    {
      "_id": "6aca518c183db44232e2d69f",
      "projectId": "6aca518c183db44232e2d694",
      "snapshotId": "6aca518c183db44232e2d69a",
      "title": "Add query parameter type casting for numeric ranges",
      "summary": "Allow users to parse numeric query filters like ?minPrice=10&maxPrice=100 into numbers automatically.",
      "requiredSkills": ["JavaScript", "Node.js", "Express"],
      "prerequisites": ["Node 20 installed", "Basic Express middleware knowledge"],
      "status": "open",
      "ownerId": null,
      "staleSetupFlag": false,
      "createdAt": "2026-10-10T14:54:04.533Z",
      "updatedAt": "2026-10-10T14:54:04.533Z"
    },
    {
      "_id": "6aca518c183db44232e2d6a1",
      "projectId": "6aca518c183db44232e2d694",
      "snapshotId": "6aca518c183db44232e2d69a",
      "title": "Update outdated setup instructions for Docker Compose",
      "summary": "The docker-compose.yml configuration needs updates to match Node 20 LTS image.",
      "requiredSkills": ["Docker", "DevOps"],
      "prerequisites": ["Docker Desktop installed"],
      "status": "open",
      "ownerId": null,
      "staleSetupFlag": true,
      "createdAt": "2026-10-10T14:54:04.533Z",
      "updatedAt": "2026-10-10T14:54:04.533Z"
    },
    {
      "_id": "6aca518c183db44232e2d6a2",
      "projectId": "6aca518c183db44232e2d694",
      "snapshotId": "6aca518c183db44232e2d69a",
      "title": "Add unit tests for nested object query parsing",
      "summary": "Expand test suite coverage for query keys with bracket notation like filter[user][name].",
      "requiredSkills": ["Node.js", "Testing", "Jest"],
      "prerequisites": ["Node 20 installed"],
      "status": "open",
      "ownerId": null,
      "staleSetupFlag": false,
      "createdAt": "2026-10-10T14:54:04.533Z",
      "updatedAt": "2026-10-10T14:54:04.533Z"
    }
  ]
}
```

---

### 3.3. Private Project Leakage Defense Test
**Command:**
```bash
curl -s http://localhost:5000/api/projects/6aca518c183db44232e2d696/issues
```
**Response (HTTP 403 Forbidden):**
```json
{
  "error": {
    "code": "forbidden",
    "message": "Access denied to private project"
  }
}
```

---

### 3.4. `POST /api/issues/:id/interest` (Save Interest)
**Command (Authenticated Contributor):**
```bash
curl -s -X POST http://localhost:5000/api/issues/6aca518c183db44232e2d69f/interest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer contributor-session-token-xyz789" \
  -d "{}"
```
**Response (HTTP 201 Created):**
```json
{
  "message": "Interest recorded successfully",
  "interest": {
    "_id": "6aca52049ce4f0e6972cb31e",
    "issueId": "6aca518c183db44232e2d69f",
    "userId": "6aca518c183db44232e2d68f",
    "createdAt": "2026-10-10T14:56:04.531Z",
    "updatedAt": "2026-10-10T14:56:04.531Z"
  }
}
```

**Testing Strict Zod Rejection (extraneous body key):**
```bash
curl -s -X POST http://localhost:5000/api/issues/6aca518c183db44232e2d69f/interest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer contributor-session-token-xyz789" \
  -d '{"extra":"malicious"}'
```
**Response (HTTP 422 Unprocessable Content):**
```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid request",
    "details": [
      {
        "path": "",
        "message": "Unrecognized key(s) in object: 'extra'"
      }
    ]
  }
}
```

---

### 3.5. `POST /api/contribution-plans` (Create Plan with Evidence)
**Command:**
```bash
curl -s -X POST http://localhost:5000/api/contribution-plans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer contributor-session-token-xyz789" \
  -d '{
    "issueId": "6aca518c183db44232e2d69f",
    "approach": "I plan to add a middleware transform function that parses query strings and coerces integer and float values.",
    "steps": ["Read query parameters", "Convert numeric types", "Add test cases"],
    "evidence": [{"filePath": "README.md", "snapshotVersion": "v1.4.0"}]
  }'
```
**Response (HTTP 201 Created):**
```json
{
  "message": "Contribution plan created successfully",
  "plan": {
    "_id": "6aca523a9ce4f0e6972cb31f",
    "issueId": "6aca518c183db44232e2d69f",
    "projectId": "6aca518c183db44232e2d694",
    "authorId": "6aca518c183db44232e2d68f",
    "approach": "I plan to add a middleware transform function that parses query strings and coerces integer and float values.",
    "steps": ["Read query parameters", "Convert numeric types", "Add test cases"],
    "evidence": [
      {
        "filePath": "README.md",
        "snapshotVersion": "v1.4.0"
      }
    ],
    "status": "submitted",
    "createdAt": "2026-10-10T14:56:58.181Z",
    "updatedAt": "2026-10-10T14:56:58.181Z"
  }
}
```

---

### 3.6. `GET /api/contribution-plans/:id` (Ownership Verification)
**Author Request (HTTP 200):**
```json
{
  "plan": {
    "_id": "6aca523a9ce4f0e6972cb31f",
    "issueId": {
      "_id": "6aca518c183db44232e2d69f",
      "title": "Add query parameter type casting for numeric ranges",
      "summary": "Allow users to parse numeric query filters like ?minPrice=10&maxPrice=100 into numbers automatically.",
      "status": "open"
    },
    "projectId": {
      "_id": "6aca518c183db44232e2d694",
      "name": "Express Query Kit",
      "slug": "express-query-kit",
      "visibility": "public"
    },
    "authorId": {
      "_id": "6aca518c183db44232e2d68f",
      "name": "Alex Contributor",
      "email": "contributor@student.edu",
      "role": "contributor"
    },
    "approach": "I plan to add a middleware transform function that parses query strings and coerces integer and float values.",
    "status": "submitted"
  }
}
```

---

### 3.7. `PATCH /api/issues/:id` (Maintainer Update & Stale Flagging)
**Command (Maintainer):**
```bash
curl -s -X PATCH http://localhost:5000/api/issues/6aca518c183db44232e2d69f \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer maintainer-session-token-abc123" \
  -d '{
    "staleSetupFlag": true,
    "summary": "Allow users to parse numeric query filters like ?minPrice=10&maxPrice=100 into numbers automatically. Updated with new schema constraints.",
    "requiredSkills": ["JavaScript", "Node.js", "Express", "Zod"]
  }'
```
**Response (HTTP 200 OK):**
```json
{
  "message": "Issue updated successfully",
  "issue": {
    "_id": "6aca518c183db44232e2d69f",
    "projectId": "6aca518c183db44232e2d694",
    "title": "Add query parameter type casting for numeric ranges",
    "summary": "Allow users to parse numeric query filters like ?minPrice=10&maxPrice=100 into numbers automatically. Updated with new schema constraints.",
    "requiredSkills": ["JavaScript", "Node.js", "Express", "Zod"],
    "status": "open",
    "staleSetupFlag": true,
    "updatedAt": "2026-10-10T14:57:49.945Z"
  }
}
```

**Non-Maintainer Check (HTTP 403 Forbidden):**
```json
{
  "error": {
    "code": "forbidden",
    "message": "Only maintainers of this project can update issues"
  }
}
```

---

## 4. Test Suite Execution Results

Running `npm test` runs all 33 automated tests across schemas, models, and API routes:

```text
> oss-onboarding-server@0.1.0 test
> node --test

[routes] mounted health.routes.js
[routes] mounted issues.routes.js
[routes] mounted plans.routes.js
[routes] mounted projects.routes.js
✔ GET /api/health responds ok (1145.3ms)
✔ unknown route returns consistent JSON 404 (25.6ms)

✔ GET /api/issues/:id: returns 404 on invalid id or not found (385.5ms)
✔ GET /api/issues/:id: returns issue details for public project (33.1ms)
✔ POST /api/issues/:id/interest: rejects unauthenticated requests with 401 (49.7ms)
✔ POST /api/issues/:id/interest: rejects unknown body fields with 422 (47.7ms)
✔ POST /api/issues/:id/interest: saves contributor interest successfully with 201 (19.2ms)
✔ PATCH /api/issues/:id: rejects non-maintainer with 403 (17.9ms)
✔ PATCH /api/issues/:id: allows maintainer to update issue and flag stale setup (25.6ms)

✔ user: invalid role is rejected, default role is contributor (17.7ms)
✔ issue: invalid status rejected, embedding must be 768 dims (4.3ms)
✔ contribution plan: requires at least one piece of evidence (6.2ms)
✔ chunk and session: required fields enforced (1.8ms)

✔ POST /api/contribution-plans: rejects unauthenticated requests with 401 (416.1ms)
✔ POST /api/contribution-plans: rejects plan without evidence with 422 (31.9ms)
✔ POST /api/contribution-plans: rejects body containing authorId (spoof attempt) (39.0ms)
✔ POST /api/contribution-plans: creates plan owned by authenticated contributor with 201 (25.9ms)
✔ GET /api/contribution-plans/:id: forbids another contributor from viewing plan (17.4ms)
✔ GET /api/contribution-plans/:id: author can view their own plan (15.6ms)
✔ POST /api/contribution-plans/:id/review: maintainer can approve plan and assign issue (32.1ms)

✔ GET /api/projects: returns only verified public projects (445.4ms)
✔ GET /api/projects/:id: returns 404 if project does not exist (25.7ms)
✔ GET /api/projects/:id: blocks unauthenticated access to private project (16.3ms)
✔ GET /api/projects/:id/issues: returns open issues for public project (17.1ms)
✔ GET /api/projects/:id/issues: blocks unauthenticated access to private project issues (14.5ms)
✔ POST /api/projects/:id/imports: rejects non-maintainer with 403 (43.4ms)
✔ POST /api/projects/:id/imports: allows maintainer to import snapshot documents and issues (26.5ms)

✔ signup: staff role cannot be self-assigned (6.3ms)
✔ plan: evidence is mandatory, unknown fields rejected (1.5ms)
✔ review: feedback required when requesting changes (1.2ms)
✔ issue update: needs at least one valid field (0.5ms)
✔ chat and agent request bodies (0.8ms)
✔ LLM output and tool arguments are validated (1.4ms)

ℹ tests 33
ℹ suites 0
ℹ pass 33
ℹ fail 0
ℹ duration_ms 1732.3
```

---

## 5. Defense & Mentor Review Answers (1-Minute Summaries)

### Q: What is your module and what did you build?
**Answer:**  
"I own the Public and Contributor APIs (`server/src/routes/projects*`, `issues*`, and `plans*`). I implemented the core public browsing and contributor workflow: `GET /api/projects` for verified project discovery, `GET /api/projects/:id/issues` for open contribution tasks, `POST /api/issues/:id/interest` for recording student interest, `POST /api/contribution-plans` for submitting evidence-linked starter plans, `GET /api/contribution-plans/:id` with strict author/maintainer ownership, and `PATCH /api/issues/:id` allowing maintainers to flag stale setup steps and assign ownership. Every endpoint enforces server-side session authentication, Zod `.strict()` validation, and prevents private repository leakage."

### Q: How do you prevent private-project leakage in your APIs?
**Answer:**  
"Before returning any project details or issues, our route checks the project's `visibility` field. If `visibility === 'private'`, unauthenticated requests are immediately rejected with `403 Forbidden`. If authenticated, we check if the user is an active project maintainer via `isProjectMaintainer()` querying `MaintainerGrant`. If not, access is strictly denied so private tasks are never leaked."

### Q: How do you ensure contributors cannot impersonate other users or edit others' plans?
**Answer:**  
"All user identifiers such as `authorId` and `userId` are derived directly from the verified server-side session (`req.user._id`), never from the request body. In fact, our Zod schema uses `.strict()`, so any attempt to send `authorId` in the request body is rejected with a 422 validation error. When reading a plan, the server verifies `plan.authorId.equals(req.user._id)` before granting access."
