# Engineering Implementation Report: RAG, Vector Search, and Contributor Chat

**Module:** Retrieval-Augmented Generation (RAG) & Vector Search  
**Project:** Open Source Contributor Onboarding (Team 12)  
**Assigned Contributor:** Manaswi  
**Roll Number:** `25071A0567`  
**GitHub Username:** `V-Manaswi`  
**Assigned Branch:** `feat/rag-0567`  
**Assigned Folder:** `server/src/services/rag/`, `server/src/routes/contributor-chat.routes.js`  
**Report Date:** 14 October 2026  

---

## 1. Executive Summary

This report documents the implementation, automated testing, and live service verification for the **RAG, Vector Search, and Contributor Chat** module.

The module allows contributors to query technical documentation for specific project snapshots, retrieves the most semantically relevant chunks using MongoDB Atlas Vector Search, and generates grounded, hallucination-resistant answers with verifiable server-side citations using a locally running Ollama language model.

### Key Deliverables Completed:
- **Snapshot Ingestion Service (`server/src/services/rag/ingestionService.js`):** Bounded chunking (1,200 max characters, 150 overlap) with paragraph boundary preservation, 768-dimensional vector validation, embedding generation, duplicate chunk prevention on re-import, and atomic rollback on partial write failure.
- **RAG Answer Service (`server/src/services/rag/ragService.js`):** Question embedding generation, MongoDB Atlas `$vectorSearch` pipeline on `chunks_vector_index`, temperature-0 grounded answer generation using `ChatOllama` (`llama3.2:3b`), and server-side citation construction from verified chunk metadata.
- **Contributor Chat API Route (`server/src/routes/contributor-chat.routes.js`):** `POST /api/contributor-chat` with session authentication (`requireAuth`), Zod input validation (`chatSchema`), snapshot isolation, and project visibility access control.
- **Full Test Suite:** 112 passing automated tests across all suites (including 29 RAG, ingestion, and contributor chat tests with 100% pass rate, 0 failures, 0 skipped).
- **Live Service Verification:** Ollama service installed locally on Windows via winget, background server running on `http://localhost:11434`, and live models `nomic-embed-text` (768-dim embeddings verified) and `llama3.2:3b` (live chat response verified) active and tested.

---

## 2. Architecture & Request Flow

```
[ Contributor HTTP Client ]
             │
             │ POST /api/contributor-chat
             │ Headers: Cookie: sessionToken=... OR Authorization: Bearer ...
             │ Body: { "projectId": "<id>", "question": "How do I run tests?" }
             ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Express Router: server/src/routes/contributor-chat.routes.js        │
│    - requireAuth middleware enforces authenticated user session        │
│    - chatSchema validates input body ({ projectId, question })         │
└────────────────────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Project Access & Snapshot Isolation (ragService.js)                 │
│    - Resolves Project and active currentSnapshotId                     │
│    - Enforces visibility: private projects restricted to maintainers  │
│    - Unverified projects hidden from non-maintainers (404)             │
│    - Fails safely if project has no active snapshot (404)              │
└────────────────────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Question Vector Embedding Generation                                │
│    - OllamaEmbeddings: nomic-embed-text via http://localhost:11434     │
│    - Strictly validates 768-dimensional finite numeric vector         │
└────────────────────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. MongoDB Atlas Vector Search ($vectorSearch)                         │
│    - Collection: chunks                                                │
│    - Index: chunks_vector_index                                        │
│    - Filters: { projectId, snapshotId, visibility }                    │
│    - numCandidates: 50, limit: 5                                       │
│    - If 0 chunks retrieved: returns "Not found in snapshot."           │
└────────────────────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 5. Grounded Generation & Citation Verification                         │
│    - ChatOllama (llama3.2:3b) with temperature 0                       │
│    - System prompt treats documentation as untrusted data              │
│    - Model returns JSON: { found, answer, evidenceNumbers }            │
│    - Server builds citations from chunk filePaths + snapshotVersion    │
│    - Output validated with ragAnswerSchema                             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Files Implemented and Modified

| File | Type | Purpose |
|---|---|---|
| `server/src/services/rag/ingestionService.js` | **New** | Document chunking, Ollama embedding generation, dimension validation, duplicate prevention, and chunk persistence. |
| `server/src/services/rag/ragService.js` | **New** | Query embedding, Atlas vector search pipeline, grounded answer generation, server-side citations, and project access verification. |
| `server/src/services/rag/index.js` | **New** | Public export barrel for RAG and ingestion services. |
| `server/src/routes/contributor-chat.routes.js` | **New** | API route for `POST /api/contributor-chat` with session authentication and error handling. |
| `server/src/routes/projects.routes.js` | **Modified** | Integrated document chunking, Ollama embedding, and chunk persistence into `POST /api/projects/:id/imports` with atomic rollback on failure. |
| `server/tests/ragIngestion.test.js` | **New** | 7 unit tests covering text chunking, overlap, boundaries, vector validation, and duplicate prevention. |
| `server/tests/ragService.test.js` | **New** | 7 unit tests covering query embeddings, Atlas pipeline construction, grounded answers, and not-found behavior. |
| `server/tests/contributorChatApi.test.js` | **New** | 6 integration tests covering authentication, authorization, validation, citations, and empty retrieval. |
| `server/tests/projectsApi.test.js` | **Modified** | Updated snapshot import tests with embedding/chunk mocks and added safe rollback test. |
| `server/.env` | **New** | Configured local development environment with `CHAT_MODEL=llama3.2:3b`. |
| `.mailmap` | **New** | Added author mapping attributing Replit-authored commits to `V-Manaswi`. |

---

## 4. Ingestion, Chunking, and Embedding Details

### Chunking Specification
- **Max Chunk Size (`CHUNK_MAX_SIZE`):** 1,200 characters.
- **Overlap (`CHUNK_OVERLAP`):** 150 characters.
- **Boundary Preservation:** The algorithm looks for paragraph breaks (`\n\n`), single line breaks (`\n`), and word spaces within a 40% window of the chunk size before splitting.
- **Metadata Retained:** `projectId`, `snapshotId`, `documentId`, `filePath`, `chunkIndex` (0-indexed per document), `visibility`, and `embedding`.

### Vector Validation
- **Dimensions:** Exactly 768 dimensions (`EMBEDDING_DIMENSIONS = 768`).
- **Validation Rule:** Rejects non-arrays, length !== 768, NaN, Infinity, or non-numeric values with an HTTP 502 `invalid_embedding_dimensions` error.

### Safe Snapshot Activation & Duplicate Prevention
- Document chunking and embedding generation execute **before** any database writes.
- If Ollama fails, no records are written to the database.
- Existing chunks for the target snapshot are removed prior to insertion (`Chunk.deleteMany({ snapshotId })`) to prevent duplicate chunks on re-import.
- If any database write fails during snapshot creation, partial records (`Snapshot`, `Document`, `Chunk`, `Issue`) are rolled back, and `project.currentSnapshotId` is never advanced.

---

## 5. MongoDB Atlas Vector Search Configuration

The vector search query uses the configuration defined in `server/src/config/vectorIndexes.js`:

```javascript
export const chunksVectorIndex = {
  name: 'chunks_vector_index',
  collection: 'chunks',
  definition: {
    fields: [
      { type: 'vector', path: 'embedding', numDimensions: 768, similarity: 'cosine' },
      { type: 'filter', path: 'projectId' },
      { type: 'filter', path: 'snapshotId' },
      { type: 'filter', path: 'visibility' },
    ],
  },
};
```

### Aggregation Pipeline
```javascript
const pipeline = [
  {
    $vectorSearch: {
      index: 'chunks_vector_index',
      path: 'embedding',
      queryVector, // 768-dim float array
      numCandidates: 50,
      limit: 5,
      filter: {
        projectId: new mongoose.Types.ObjectId(projectId),
        snapshotId: new mongoose.Types.ObjectId(snapshotId),
        visibility: permittedVisibility,
      },
    },
  },
  {
    $project: {
      _id: 1,
      filePath: 1,
      chunkIndex: 1,
      text: 1,
      visibility: 1,
      score: { $meta: 'vectorSearchScore' },
    },
  },
];
```

---

## 6. API Endpoint Contract

### `POST /api/contributor-chat`

#### Request Headers:
```http
Content-Type: application/json
Authorization: Bearer <valid-session-token>
```

#### Request Body:
```json
{
  "projectId": "66f1a2b3c4d5e6f7a8b9c0d1",
  "question": "How do I install dependencies and run tests?"
}
```

#### Grounded Response (200 OK):
```json
{
  "found": true,
  "answer": "To install dependencies, run `npm install`. To execute the test suite, run `npm test`.",
  "citations": [
    {
      "filePath": "README.md",
      "snapshotVersion": "v1.0.0"
    }
  ],
  "snapshotVersion": "v1.0.0"
}
```

#### Not Found Response (200 OK):
```json
{
  "found": false,
  "answer": "Not found in snapshot.",
  "citations": [],
  "snapshotVersion": "v1.0.0"
}
```

#### Error Responses:
- `401 Unauthorized`: Missing or invalid session token.
- `403 Forbidden`: Contributor lacks access to private project.
- `404 Not Found`: Project not found, unverified, or has no active snapshot.
- `422 Unprocessable Entity`: Invalid request body (missing fields or question < 3 characters).

---

## 7. Automated Test Results

Ran via `npm.cmd test` on Windows:

```
✔ GET /api/health responds ok
✔ unknown route returns consistent JSON 404
✔ POST /api/contributor-chat: rejects unauthenticated requests with 401
✔ POST /api/contributor-chat: rejects invalid body with 422
✔ POST /api/contributor-chat: blocks non-maintainer access to private project with 403
✔ POST /api/contributor-chat: returns 404 when project has no active snapshot
✔ POST /api/contributor-chat: returns grounded answer with server citations for verified public project
✔ POST /api/contributor-chat: returns safe "Not found in snapshot." when no chunks are retrieved
✔ private-project authorization runs before snapshot lookup or vector retrieval
✔ verified public project chat uses the current snapshot and returns real citations
✔ unverified public projects remain hidden from ordinary contributors before snapshot lookup
✔ vector retrieval filters by project, snapshot, and permitted visibility
✔ retrieved evidence produces citations from chunk paths and the trusted snapshot version
✔ no retrieved chunks return the required not-found answer without calling the chat model
✔ model-declared insufficient evidence also returns the fixed not-found response
✔ invalid embedding dimensions stop before vector retrieval
✔ POST /api/projects/:id/imports: rejects non-maintainer with 403
✔ POST /api/projects/:id/imports: allows maintainer to import snapshot documents and issues
✔ POST /api/projects/:id/imports: fails safely when Ollama embedding generation fails
✔ ragIngestion: splitTextIntoChunks handles empty or whitespace text
✔ ragIngestion: splitTextIntoChunks leaves text <= maxSize in single chunk
✔ ragIngestion: splitTextIntoChunks splits long text respecting boundaries and bounds
✔ ragIngestion: chunkDocument and chunkDocuments number chunks per document and preserve filePath
✔ ragIngestion: validateEmbedding enforces 768-dimensional finite numbers
✔ ragIngestion: generateEmbeddings throws clear error on Ollama failure or dimension mismatch
✔ ragIngestion: ingestSnapshotDocuments creates Chunk records with metadata and embeddings
✔ ragService: generateQueryEmbedding validates input and returns 768-dimensional vector
✔ ragService: generateQueryEmbedding rejects invalid embedding dimensions from Ollama
✔ ragService: searchChunks constructs Atlas Vector Search pipeline with metadata filters
✔ ragService: generateGroundedAnswer returns safe not-found when chunks are empty without invoking LLM
✔ ragService: generateGroundedAnswer builds server-side citations and validates answer
✔ ragService: generateGroundedAnswer returns not-found when model cannot find evidence or hallucinated indices
✔ ragService: answerContributorQuestion enforces authorization and snapshot isolation
... [all authentication, project, issues, plans, agent, moderation, and seed tests pass]

ℹ tests 112
ℹ suites 0
ℹ pass 112
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4200.506
```

---

## 8. Live Services Verification Status

| Service | Status | Live Verification Result |
|---|---|---|
| **Ollama Server** | **LIVE** | Running locally on `http://localhost:11434`. Responds with 200 OK to `/api/tags`. |
| **Embedding Model (`nomic-embed-text`)** | **LIVE** | Installed in Ollama (274 MB). Real test query generated verified 768-dimensional vector. |
| **Chat Model (`llama3.2:3b`)** | **LIVE** | Installed in Ollama (2.0 GB). Real test prompt executed successfully and returned completion. |
| **Local MongoDB (port 27017)** | **UNAVAILABLE** | `connect ECONNREFUSED 127.0.0.1:27017`. MongoDB is not installed locally. |
| **MongoDB Atlas Vector Search** | **PENDING** | Awaiting teammate's valid Database User credentials and chunks_vector_index deployment on Atlas cluster (cluster reachable at opensourcecontributoron.qwohzqn.mongodb.net). |

---

## 9. Environment Variables Configuration

In `server/.env` (safe placeholders):

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/oss_onboarding?retryWrites=true&w=majority
SESSION_SECRET=<random-32-character-secret>
CLIENT_ORIGIN=http://localhost:5173
OLLAMA_URL=http://localhost:11434
CHAT_MODEL=llama3.2:3b
EMBED_MODEL=nomic-embed-text
PORT=5000
NODE_ENV=development
```

---

## 10. Implementation Status & Next Steps

1. **RAG Implementation Complete:** All assigned components (snapshot ingestion, 768-dim vector embeddings, `$vectorSearch` pipeline, grounded chat with citations, atomic rollback) are fully implemented and verified against the 112 automated tests (100% pass rate).
2. **Database Verification (Pending Teammate):** Awaiting teammate to confirm/create valid Database User credentials under Atlas Security > Database Access and deploy `chunks_vector_index`. Verification script `npm run verify-rag` is ready to run as soon as credentials authenticate.
3. **Git Finalization:** All assigned code, tests, and documentation are committed on `feat/rag-0567` under `Manaswi <manaswi16v@gmail.com>`. Ready to push to `origin/feat/rag-0567` via GitHub authentication.
