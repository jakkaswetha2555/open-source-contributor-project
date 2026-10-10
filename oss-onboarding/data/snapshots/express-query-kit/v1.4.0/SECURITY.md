# Security Policy - Express Query Kit

## Supported Versions
Security updates are actively maintained on the latest stable minor release series:
| Version | Supported |
|---|---|
| 1.4.x | Yes |
| 1.3.x | Critical fixes only |
| < 1.3 | Unsupported (upgrade to 1.4.0+) |

## Reporting a Vulnerability
If you discover a security vulnerability in Express Query Kit (such as an operator bypass or ReDoS vector):
1. **Do not open a public GitHub issue.**
2. Email security findings to `security@project.org`.
3. Provide reproduction steps, payload samples, and affected versions.
4. The maintainer team will acknowledge receipt within 48 hours and coordinate a coordinated disclosure timeline.

## Secure Usage Best Practices
- Always specify an explicit `allowedFilters` list in your application middleware.
- Never pass unvalidated user input directly to MongoDB query selectors without using `sanitizeQuery()`.
- Set an explicit `maxLimit` for all paginated endpoints.
