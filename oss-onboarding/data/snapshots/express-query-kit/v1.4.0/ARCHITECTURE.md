# System Architecture - Express Query Kit

## High-Level Design
Express Query Kit sits as middleware between incoming HTTP requests and application route handlers. It extracts the raw `req.query` object, runs validation checks, sanitizes operator tokens, and constructs an abstract query specification (QuerySpec).

```
[HTTP Request] -> [Express Server]
                       │
                       ▼
        [Express Query Kit Middleware]
           ├── Query Sanitizer (anti-injection)
           ├── Type Coercion Engine (number, bool, date)
           ├── Filter Parser (AST generator)
           └── Pagination & Sorting Normalizer
                       │
                       ▼
            [req.queryKit Specification]
                       │
                       ▼
        [Route Handler / DB Query Builder]
```

## Directory Structure
- `src/middleware/`: Express middleware entry points.
- `src/parsers/`: Parsing logic for filtering syntax (e.g. bracket notation `filter[price][gt]=50`).
- `src/coercers/`: Automatic string-to-primitive conversion functions.
- `src/validators/`: Input bounds checking and allowlist verification.
- `src/adapters/`: Database query dialect builders (Mongoose, SQL Knex).

## Security Guardrails
1. **Allowlist-First:** Any query key not explicitly permitted by `allowedFilters` is stripped.
2. **Denial of Service Prevention:** Pagination `limit` is capped at `maxLimit` (default 100) to prevent full-table memory exhaustion.
3. **Prototype Pollution Protection:** Bracket notation queries sanitize `__proto__`, `constructor`, and `prototype` keys.
