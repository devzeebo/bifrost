# Security Policy

## Supported versions

Only the **latest release** of Bifrost receives security fixes. Older versions
get best-effort support. Please update before reporting.

| Version  | Supported          |
| -------- | ------------------ |
| latest   | :white_check_mark: |
| < latest | :x: (best effort)  |

## Reporting a vulnerability

**Do not open a public GitHub issue for security reports.**

Preferred — use GitHub's private vulnerability reporting:

1. Go to the **[Security](https://github.com/devzeebo/bifrost/security)** tab.
2. Click **Report a vulnerability**.
3. Describe the issue, include reproduction steps, and (if possible) a fix
   suggestion.

This creates a private advisory visible only to repository maintainers and can
be published as a CVE/GHSA once fixed.

Alternatively, email the maintainer at **[INSERT SECURITY EMAIL]**.

<!-- TODO(maintainer): replace [INSERT SECURITY EMAIL] with a real address, or
     rely solely on GitHub private vulnerability reporting and remove this line. -->

Please include:

- A clear description of the vulnerability and its impact.
- Steps to reproduce (proof of concept if possible).
- Affected versions / components.
- Any suggested remediation.

## Response timeline

- **Acknowledgement:** within 72 hours.
- **Status update / ETA:** once the report is validated.
- **Fix:** prioritized by severity. Coordinated disclosure is preferred.

Please give us a reasonable window to address the issue before any public
disclosure.

## Scope

**In scope:** the Bifrost server, `bf` CLI, the `orchestrator/` system, and the
admin UI (`bifrost/ui/`).

**Out of scope:**

- Vulnerabilities in third-party dependencies — report these upstream to the
  relevant package.
- Issues caused by insecure custom configuration, weak JWT keys, or exposing the
  server without authentication.
- Self-hosted deployments missing security patches.

Thank you for helping keep Bifrost and its users safe.
