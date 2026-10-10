# Testing Guide - Markdown Docgen

## Running the Test Suite
Markdown Docgen uses Node.js test runner for unit tests and fixture comparisons:

```bash
npm test
```

## Snapshot Fixtures
Snapshot tests compare generated Markdown against baseline fixtures in `tests/fixtures/`:
- If an intentional output format change is made, update snapshots with:
  ```bash
  npm test -- --update-snapshots
  ```

## Writing Tests
When adding new syntax elements or parser features:
1. Create an input source file in `tests/fixtures/input/`.
2. Add a test case asserting that the AST builder produces valid token nodes.
3. Assert that the output markdown matches expected layout strings.
