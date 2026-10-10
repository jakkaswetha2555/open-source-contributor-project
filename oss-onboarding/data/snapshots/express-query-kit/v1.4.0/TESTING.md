# Testing Procedures - Express Query Kit

Express Query Kit enforces rigorous test coverage across all parser branches and database dialect transformers.

## Running Tests
Run all test suites using Node's native test runner:
```bash
npm test
```

To run tests in watch mode during development:
```bash
npm run test:watch
```

## Test Structure
```
tests/
├── parsers.test.js       # Unit tests for filter string tokenization
├── coercers.test.js      # Type conversion edge cases (null, undefined, invalid numbers)
├── security.test.js      # Injection, prototype pollution, and DoS limits
└── integration.test.js   # End-to-end tests with Express application instances
```

## Adding New Tests
When contributing a bug fix or new operator, add tests in `tests/parsers.test.js`.
Always verify:
1. Valid operator input returns the expected AST.
2. Malformed or unsupported operators throw a graceful validation error or are safely ignored.
3. Empty queries (`?`) produce clean default pagination options.
