# Express Query Kit

Express Query Kit is an open-source composable request validation, pagination, and query-filtering toolkit for Express.js applications.

## Overview
Building search filters and pagination for RESTful APIs is often repetitive and prone to SQL/NoSQL injection vulnerabilities. Express Query Kit solves this by translating HTTP query string parameters into safe, sanitised database query filters for Mongoose, Prisma, and Knex.

## Features
- **Declarative Filtering:** Define allowed query fields, data types, and filtering operators (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `like`).
- **Automatic Type Coercion:** Coerces strings to integers, floats, booleans, and ISO 8601 timestamps.
- **Pagination & Sorting:** Built-in cursor-based and offset-based pagination with sorting allowlists.
- **Zod Validation Integration:** Validate request query schemas seamlessly before executing queries.

## Quick Start
```bash
npm install express-query-kit
```

```javascript
import express from 'express';
import { queryParser } from 'express-query-kit';

const app = express();
app.use(queryParser({
  allowedFilters: ['status', 'category', 'price'],
  maxLimit: 100,
  defaultLimit: 20
}));
```

## Documentation
- [SETUP.md](SETUP.md) - Local development environment setup.
- [CONTRIBUTING.md](CONTRIBUTING.md) - Guidelines for new contributors.
- [ARCHITECTURE.md](ARCHITECTURE.md) - Internal design and query AST transformation pipeline.
- [QUERY_PARSING.md](QUERY_PARSING.md) - Query parsing specifications and supported operators.
- [TESTING.md](TESTING.md) - How to run unit and integration tests.
- [SECURITY.md](SECURITY.md) - Security policies and safe operator sanitization.

## License
MIT © Open Source Contributors
