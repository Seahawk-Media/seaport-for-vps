# Security Policy

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, email **security@seahawkmedia.com** with details of the vulnerability.

### What to include

- Description of the vulnerability
- Steps to reproduce or proof of concept
- Affected component(s) and version(s)
- Potential impact and severity assessment
- Any suggested fix (optional but appreciated)

### Response timeline

- **48 hours** — We will acknowledge receipt of your report.
- **7 days** — We will provide an initial assessment and expected resolution timeline.
- **Ongoing** — We will keep you informed of progress toward a fix and disclosure.

We will coordinate disclosure with you and credit reporters unless anonymity is requested.

## Scope

### In scope

- Server-side code (API routes, tRPC procedures, middleware)
- Authentication and session management (Better Auth)
- Data access controls and authorization logic
- AI agent runtime and tool execution
- Database queries and data exposure
- Docker image and default configuration security

### Out of scope

- Vulnerabilities in self-hosted deployments caused by user misconfiguration
- Social engineering attacks
- Denial of service attacks against self-hosted instances
- Issues in third-party dependencies (report these upstream; let us know so we can update)
- Security issues that require physical access to the host

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Disclosure Policy

We follow coordinated disclosure. We ask that you give us reasonable time to address the issue before any public disclosure. We aim to release patches within 30 days of a confirmed vulnerability.
