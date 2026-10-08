// Single source of truth for enums shared by Mongoose models and Zod schemas.
export const ROLES = ['contributor', 'maintainer', 'moderator'];
export const VISIBILITY = ['public', 'private'];
export const VERIFICATION_STATUS = ['pending', 'verified', 'rejected'];
export const GRANT_STATUS = ['pending', 'active', 'revoked'];
export const ISSUE_STATUS = ['open', 'assigned', 'closed'];
export const PLAN_STATUS = ['draft', 'submitted', 'changes_requested', 'approved'];
export const REVIEW_DECISION = ['approved', 'changes_requested'];
export const DOC_TYPES = ['readme', 'contributing', 'setup', 'architecture', 'component', 'other'];
export const TOOL_STATUS = ['ok', 'error', 'skipped'];
export const AGENT_RUN_STATUS = ['running', 'completed', 'failed'];

// nomic-embed-text produces 768-dimension vectors. The Atlas vector indexes must match.
export const EMBEDDING_DIMENSIONS = 768;
