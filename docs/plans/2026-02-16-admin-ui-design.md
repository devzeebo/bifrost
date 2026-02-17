# Bifrost Admin UI Design

**Date:** 2026-02-16
**Status:** Approved

## Overview

A server-rendered admin UI using Go HTML templates with htmx for dynamic interactions. The UI provides a unified interface that adapts based on user role — viewers see read-only content, members can manage runes, admins have full access.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth method | JWT in HttpOnly cookie | Stateless, no session storage needed, PAT revocation handled by checking PAT status |
| UI scope | Unified (role-adaptive) | Single UI serves all users, adapts based on permissions |
| Page model | Hybrid (htmx for actions) | Traditional pages for navigation, htmx for quick interactions |
| Feature set | Full | Dashboard, runes, realms, accounts, PATs |
| Architecture | Dedicated admin module | Clean separation from API handlers |

## Architecture

```
server/
├── admin/
│   ├── handlers.go       # All admin UI HTTP handlers
│   ├── middleware.go     # JWT validation, role checking
│   ├── templates.go      # Template loading and rendering
│   └── static.go         # Embedded CSS/JS assets
├── admin/templates/
│   ├── base.html         # Layout with nav, dark theme CSS
│   ├── dashboard.html    # Overview page
│   ├── runes/
│   │   ├── list.html     # Filterable rune list
│   │   └── detail.html   # Rune detail with actions
│   ├── realms/
│   │   ├── list.html
│   │   └── detail.html
│   └── accounts/
│       ├── list.html
│       ├── detail.html
│       └── pats.html
└── admin/static/
    └── style.css         # Dark theme, minimal CSS (embedded)
```

## Authentication

### JWT-Based Auth Flow

1. **Login**: User submits PAT at `/admin/login`
2. **Validation**: Server validates PAT against account events
3. **JWT Creation**: Server signs JWT with `{sub: account_id, pat: pat_id, exp: timestamp}`
4. **Cookie**: Sets `admin_token=<jwt>` (HttpOnly, Secure, SameSite=Strict)
5. **Requests**: Middleware verifies JWT, then checks PAT is still active

### JWT Payload

```json
{
  "sub": "<account_id>",
  "pat": "<pat_id>",
  "exp": 1735689600
}
```

### Security Properties

- PAT never stored in browser, only JWT
- JWT expiry provides session timeout (24h default)
- PAT revocation invalidates JWT on next request (PAT check after JWT verification)
- Signing key from server config or generated on startup

## Routes

| Route | Method | Role Required | Description |
|-------|--------|---------------|-------------|
| `/admin/login` | GET/POST | none | Login page, PAT submission |
| `/admin/logout` | POST | any | Clear cookie, redirect to login |
| `/admin/` | GET | viewer | Dashboard with overview stats |
| `/admin/runes` | GET | viewer | Rune list, filterable by status/priority/assignee |
| `/admin/runes/{id}` | GET | viewer | Rune detail view |
| `/admin/runes/{id}/claim` | POST | member | Claim a rune (htmx) |
| `/admin/runes/{id}/fulfill` | POST | member | Fulfill a rune (htmx) |
| `/admin/runes/{id}/seal` | POST | member | Seal a rune (htmx) |
| `/admin/runes/{id}/note` | POST | member | Add note (htmx) |
| `/admin/realms` | GET | admin | Realm list |
| `/admin/realms/{id}` | GET | admin | Realm detail with members |
| `/admin/realms/create` | POST | admin | Create new realm |
| `/admin/realms/{id}/suspend` | POST | admin | Suspend realm |
| `/admin/accounts` | GET | admin | Account list |
| `/admin/accounts/{id}` | GET | admin | Account detail with roles |
| `/admin/accounts/create` | POST | admin | Create account |
| `/admin/accounts/{id}/suspend` | POST | admin | Suspend account |
| `/admin/accounts/{id}/roles` | POST | admin | Assign/revoke role |
| `/admin/accounts/{id}/pats` | GET/POST | admin | List/create/revoke PATs |
| `/admin/static/style.css` | GET | none | Embedded CSS |

## Navigation Structure

- **Dashboard** — Visible to all authenticated users
- **Runes** — Visible to all, actions depend on role
- **Realms** — Visible to admins only
- **Accounts** — Visible to admins only

## Styling

### Dark Theme Palette

```css
:root {
  --bg-primary: #0d1117;      /* Main background */
  --bg-secondary: #161b22;    /* Cards, nav */
  --bg-tertiary: #21262d;     /* Inputs, buttons */
  --text-primary: #e6edf3;    /* Main text */
  --text-secondary: #8b949e;  /* Muted text */
  --border: #30363d;          /* Borders */
  --accent: #58a6ff;          /* Links, focus */
  --success: #3fb950;         /* Fulfilled, sealed */
  --warning: #d29922;         /* Claimed */
  --danger: #f85149;          /* Errors, suspended */
}
```

### Components

- **Nav** — Horizontal bar with logo, nav links, user info, logout button
- **Table** — Striped rows, hover states, sort headers
- **Card** — Rounded corners, subtle border, padding
- **Form** — Dark inputs with focus ring, primary/secondary buttons
- **Status badge** — Colored pills (open=neutral, claimed=yellow, fulfilled=green, sealed=gray)
- **Toast** — Fixed bottom-right, auto-dismiss after 3s

## htmx Patterns

- Action buttons return partial HTML (updated status badge + button swap)
- Forms use `hx-post` with `hx-target="closest form"` for inline feedback
- Error responses return toast HTML that gets swapped into toast container
- All responses are HTML — no JSON from admin routes

## Template Structure

### Base Template

```html
<!DOCTYPE html>
<html>
<head>
  <title>{{.Title}} | Bifrost Admin</title>
  <link rel="stylesheet" href="/admin/static/style.css">
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
</head>
<body>
  <nav>
    <a href="/admin/">Bifrost</a>
    <a href="/admin/runes">Runes</a>
    {{if eq .Account.Role "admin"}}
    <a href="/admin/realms">Realms</a>
    <a href="/admin/accounts">Accounts</a>
    {{end}}
    <span>{{.Account.Username}}</span>
    <form action="/admin/logout" method="post"><button>Logout</button></form>
  </nav>
  <main>
    {{template "content" .}}
  </main>
  <div id="toasts"></div>
</body>
</html>
```

### Template Data

All templates receive:
- `.Title` — Page title
- `.Account` — Current user info (Username, Role, Realms map)
- Page-specific data (`.Rune`, `.Runes`, `.Realm`, etc.)

## Data Flow

1. Middleware validates JWT, loads account state from projection store
2. Handler calls existing domain handlers and projection store
3. No new domain logic — UI layer over existing commands/queries
4. Templates render with role-aware conditional content
