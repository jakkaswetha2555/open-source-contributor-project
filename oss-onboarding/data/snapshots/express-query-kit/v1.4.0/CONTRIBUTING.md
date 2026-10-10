# Contributing to Express Query Kit

We are excited to welcome new contributors! Express Query Kit is designed to be accessible for first-time open source contributors.

## Contributor Workflow

1. **Pick an Issue:**
   - Check the issue tracker for issues tagged `good-first-issue` or `help-wanted`.
   - Ensure the issue status is `open` and not already assigned (`status: assigned`).
   - Leave a comment expressing your intent to work on the issue.

2. **Branching Strategy:**
   - Create a feature branch off `main`:
     ```bash
     git checkout -b feat/your-feature-name
     ```
   - Use clear commit messages following Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`).

3. **Code Style & Guidelines:**
   - Run linter before committing: `npm run lint`.
   - Never expose internal database projection errors or unescaped query operators.
   - All parser additions must include corresponding Zod schemas and unit tests.

4. **Submitting a Pull Request:**
   - Push your branch to your fork and submit a PR against `main`.
   - Reference the issue number in the PR description (`Closes #123`).
   - Make sure all test suites pass with `npm test`.
