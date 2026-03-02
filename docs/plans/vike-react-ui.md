# Vike/React UI for Bifrost

This plan outlines the implementation of a modern vike/react admin UI that interacts with the bifrost Go API. The UI will replace the existing HTMX-based admin UI at `/server/admin` (which will not be modified).

## Overview

- **UI Location**: `localhost:8080/ui/*`
- **Vike Dev Server**: Proxied through Go server at `/ui/*`
- **Tech Stack**: Vike + React 19 + TypeScript + Tailwind CSS + Base UI
- **Auth**: PAT-based login with session management

---

## Setup Verification

The vike setup at `/admin-ui` is already configured with:

- [x] TypeScript strict mode (`"strict": true` in tsconfig.json)
- [x] Oxlint configuration (`oxlint.config.ts`)
- [x] Prettier configuration (`prettier.config.mjs`)
- [x] .gitignore (comprehensive Node.js ignores)
- [x] Vite + Vike + React + Tailwind CSS
- [x] Path aliases (`@/components/*`, `@/types/*`, etc.)

**Configuration Changes Needed:**

1. Update `vite.config.ts`:
   - Change `base` from `/beta/admin/` to `/ui/`
   - Update proxy configuration for new endpoint structure

2. Add API client configuration for Go backend

---

## Go API Endpoints

### Existing Endpoints (Used by UI)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | None | Health check |
| GET | `/runes` | Viewer | List runes (supports `?status=`, `?priority=`, `?assignee=`, `?branch=`, `?blocked=`, `?is_saga=` filters) |
| GET | `/rune?id=` | Viewer | Get rune details |
| POST | `/create-rune` | Member | Create a new rune |
| POST | `/update-rune` | Member | Update rune properties |
| POST | `/forge-rune` | Member | Move rune from draft to open |
| POST | `/claim-rune` | Member | Claim an open rune |
| POST | `/unclaim-rune` | Member | Unclaim a rune |
| POST | `/fulfill-rune` | Member | Mark rune as fulfilled |
| POST | `/seal-rune` | Member | Seal a rune |
| POST | `/shatter-rune` | Member | Shatter (delete) a rune |
| POST | `/sweep-runes` | Member | Shatter multiple completed runes |
| POST | `/add-dependency` | Member | Add dependency between runes |
| POST | `/remove-dependency` | Member | Remove dependency |
| POST | `/add-note` | Member | Add note to rune |
| POST | `/assign-role` | Admin | Assign role to account in realm |
| POST | `/revoke-role` | Admin | Revoke role from account |
| GET | `/realms` | SysAdmin | List all realms |
| POST | `/create-realm` | SysAdmin | Create a new realm |

### New Endpoints Required

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/ui/login` | None | Authenticate with PAT, return session token |
| POST | `/ui/logout` | Session | End session |
| GET | `/ui/session` | Session | Get current session info (account, available realms) |
| GET | `/ui/check-onboarding` | None | Check if system needs onboarding (no accounts/realms) |
| POST | `/ui/onboarding/create-admin` | None | Create first admin account + first realm |
| GET | `/accounts` | SysAdmin | List all accounts |
| GET | `/account?id=` | SysAdmin | Get account details |
| POST | `/create-account` | SysAdmin | Create new account |
| POST | `/suspend-account` | SysAdmin | Suspend an account |
| POST | `/grant-realm` | SysAdmin | Grant account access to realm |
| POST | `/revoke-realm` | SysAdmin | Revoke account access from realm |
| POST | `/create-pat` | Self/Admin | Create PAT for account |
| POST | `/revoke-pat` | Self/Admin | Revoke a PAT |
| GET | `/pats` | Self | List own PATs |
| GET | `/realm?id=` | Realm Member | Get realm details with member list |
| GET | `/my-stats` | Session | Get stats for current account (runes across all realms) |

---

## Page Endpoints (UI Routes)

| Route | Auth | Description |
|-------|------|-------------|
| `/ui/` | Public | Redirect to `/ui/onboarding` or `/ui/login` |
| `/ui/onboarding` | Public | First-time setup (no auth) |
| `/ui/login` | Public | PAT login page |
| `/ui/dashboard` | Session | Account overview and stats |
| `/ui/runes` | Session | Rune list for selected realm |
| `/ui/runes/:id` | Session | Rune detail/edit page |
| `/ui/account` | Session | Own account details |
| `/ui/account/pats` | Session | PAT management |
| `/ui/realm` | Realm Admin | Current realm settings (for realm admins) |
| `/ui/admin/accounts` | SysAdmin | Account list |
| `/ui/admin/accounts/:id` | SysAdmin | Account details |
| `/ui/admin/realms` | SysAdmin | Realm list |
| `/ui/admin/realms/:id` | SysAdmin | Realm details with members |

---

## Data Models

### Rune
```typescript
interface RuneDetail {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'open' | 'claimed' | 'fulfilled' | 'sealed' | 'shattered';
  priority: number;
  claimant?: string;
  parent_id?: string;
  branch?: string;
  dependencies: DependencyRef[];
  notes: NoteEntry[];
  created_at: string;
  updated_at: string;
}

interface DependencyRef {
  target_id: string;
  relationship: 'blocked_by' | 'blocks' | 'relates_to' | 'duplicates' | 'parent_of' | 'child_of';
}

interface NoteEntry {
  text: string;
  created_at: string;
}
```

### Account
```typescript
interface AccountListEntry {
  account_id: string;
  username: string;
  status: 'active' | 'suspended';
  realms: string[];
  roles: Record<string, string>; // realm_id -> role
  pat_count: number;
  created_at: string;
}
```

### Realm
```typescript
interface RealmListEntry {
  realm_id: string;
  name: string;
  status: 'active' | 'suspended';
  created_at: string;
}
```

### Session
```typescript
interface SessionInfo {
  account_id: string;
  username: string;
  realms: string[];
  roles: Record<string, string>;
  current_realm?: string;
  is_sysadmin: boolean; // has _admin realm access
}
```

---

## Pages

### 1. Onboarding (`/ui/onboarding`)

**Condition**: Shown only when no accounts/realms exist in database

**Steps**:
1. Create server admin account (username input)
2. Generate initial PAT (display once with warning)
3. Create first realm (name input)
4. Assign admin account as "owner" of first realm
5. Redirect to login

**State Management**:
- Check onboarding status via `/ui/check-onboarding`
- Create admin via `/ui/onboarding/create-admin`

---

### 2. Login (`/ui/login`)

**Flow**:
1. Enter PAT (Bearer token)
2. Submit to `/ui/login`
3. Receive session token (HTTP-only cookie)
4. Redirect to realm selector or dashboard

**Components**:
- PAT input field
- Submit button
- Error message display

---

### 3. Dashboard (`/ui/dashboard`)

**Content**:
- Welcome message with username
- Stats cards:
  - Total runes (all realms)
  - Open runes assigned to you
  - Fulfilled runes (this week/month)
  - Blocked runes
- Recent activity feed
- Quick actions: Create rune, View my runes

**API Calls**:
- `GET /my-stats` - Overall statistics
- `GET /runes?assignee=me` - My assigned runes

---

### 4. Runes List (`/ui/runes`)

**Features**:
- Data table with columns: Title, Status, Priority, Assignee, Branch, Created, Actions
- Filters: Status, Priority, Assignee, Blocked state, Saga status
- Search: Filter by title/description
- Sort: By any column
- Click row to navigate to rune detail
- Actions column with contextual buttons (Forge/Claim/Seal/Fulfill/Shatter)

**API Calls**:
- `GET /runes` with query filters

**Components**:
- `RuneTable` - Main table component
- `RuneFilters` - Filter sidebar/dropdown
- `RuneRow` - Individual row with actions

---

### 5. Rune Detail (`/ui/runes/:id`)

**Sections**:
1. **Header**: Title, Status badge, Priority
2. **Description**: Editable markdown
3. **Metadata**: Created, Updated, Branch, Claimant
4. **Dependencies**: List with add/remove capability
5. **Notes**: Chronological list with add capability
6. **Actions**: Forge/Claim/Seal/Fulfill/Shatter (contextual)

**API Calls**:
- `GET /rune?id=` - Load rune
- `POST /update-rune` - Save changes
- `POST /add-dependency`, `POST /remove-dependency`
- `POST /add-note`
- Action endpoints based on status

**Components**:
- `RuneHeader` - Title and status
- `RuneDescription` - Editable description
- `DependencyList` - Dependencies with management
- `NotesList` - Notes timeline
- `RuneActions` - Action buttons

---

### 6. Account Details (`/ui/account`)

**Content**:
- Username display
- Email/contact info (if applicable)
- Realm memberships with roles
- PAT management section
- Account settings

**API Calls**:
- `GET /ui/session` - Current account info
- `GET /pats` - List PATs
- `POST /create-pat` - Create new PAT
- `POST /revoke-pat` - Revoke PAT

---

### 7. Realm Settings (`/ui/realm`)

**For**: Realm admins/owners

**Content**:
- Realm name and ID
- Member list with roles
- Add member form (username + role)
- Role management for existing members

**API Calls**:
- `GET /realm?id=` - Realm details with members
- `POST /assign-role` - Assign role
- `POST /revoke-role` - Revoke role
- `POST /grant-realm` - Add account to realm

---

### 8. SysAdmin: Accounts (`/ui/admin/accounts`)

**Features**:
- Data table with columns: Username, Status, Realms, PAT Count, Created, Actions
- Filters: Status, Realm membership
- Search: By username
- Click row to view account details
- Actions: Suspend, View details

**API Calls**:
- `GET /accounts` - List all accounts

---

### 9. SysAdmin: Account Detail (`/ui/admin/accounts/:id`)

**Content**:
- Full account details
- Realm memberships with roles
- PAT count
- Actions: Suspend, Manage realms, Create PAT

**API Calls**:
- `GET /account?id=` - Account details
- `POST /suspend-account`
- `POST /grant-realm`, `POST /revoke-realm`
- `POST /create-pat`

---

### 10. SysAdmin: Realms (`/ui/admin/realms`)

**Features**:
- Data table with columns: Name, Status, Created, Actions
- Filters: Status
- Search: By name
- Click row to view realm details
- Actions: Suspend, View details, Create realm button

**API Calls**:
- `GET /realms` - List all realms
- `POST /create-realm` - Create new realm

---

### 11. SysAdmin: Realm Detail (`/ui/admin/realms/:id`)

**Content**:
- Realm name and ID
- Status
- Member list with roles
- Add member form
- Role management

**API Calls**:
- `GET /realm?id=` - Realm details
- `POST /assign-role`, `POST /revoke-role`
- `POST /grant-realm`, `POST /revoke-realm`

---

## Unique Controls

### Realm Selector

**Location**: Top navigation bar

**Behavior**:
- Dropdown showing available realms
- Current realm highlighted
- SysAdmins see all realms (except `_admin`)
- Regular users see only their assigned realms
- Selection stored in session/localStorage
- Changes trigger data refresh for current page

**Props**:
```typescript
interface RealmSelectorProps {
  realms: string[];
  currentRealm: string | null;
  onSelect: (realmId: string) => void;
  isSysadmin: boolean;
}
```

### Account Badge

**Location**: Top-right of navigation bar

**Content**:
- Username display
- Dropdown menu with:
  - "My Account" -> `/ui/account`
  - "Logout" -> clears session

**Props**:
```typescript
interface AccountBadgeProps {
  username: string;
  onLogout: () => void;
}
```

---

## Design System

### Theme

**Default**: Dark mode
**Toggle**: Light mode available

**Color Palette (Dark)**:
```css
--bg-primary: #0d1117;     /* Main background */
--bg-secondary: #161b22;   /* Card background */
--bg-tertiary: #21262d;    /* Hover states */
--border: #30363d;         /* Borders */
--text-primary: #e6edf3;   /* Primary text */
--text-secondary: #8b949e; /* Secondary text */
--accent: #58a6ff;         /* Links, focus */
--success: #3fb950;        /* Fulfilled status */
--warning: #d29922;        /* Warning states */
--danger: #f85149;         /* Error, Shattered */
--purple: #a371f7;         /* Claimed status */
```

### Typography

- **Font**: System font stack (Inter, SF Pro, Segoe UI, sans-serif)
- **Monospace**: JetBrains Mono, Fira Code, monospace (for IDs, code)

### Components

#### Navigation Bar
```
+------------------------------------------------------------------+
| [Bifrost Logo]  [Dashboard] [Runes] [Realm*]  [Accounts*] [Realms*] | [Realm Selector] [Account Badge]
+------------------------------------------------------------------+
```
*Only shown for users with appropriate permissions

#### Status Badges
- **draft**: Gray pill
- **open**: Blue pill
- **claimed**: Purple pill
- **fulfilled**: Green pill
- **sealed**: Orange pill
- **shattered**: Red pill (strikethrough text)

#### Action Buttons
Contextual based on rune status:
- **draft**: [Forge]
- **open**: [Claim] [Seal]
- **claimed**: [Unclaim] [Fulfill] [Seal]
- **fulfilled**: [Shatter]
- **sealed**: [Shatter]

---

## Architecture

### Directory Structure

```
/admin-ui/
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   └── PageLayout.tsx
│   ├── controls/
│   │   ├── RealmSelector.tsx
│   │   └── AccountBadge.tsx
│   ├── runes/
│   │   ├── RuneTable.tsx
│   │   ├── RuneRow.tsx
│   │   ├── RuneFilters.tsx
│   │   ├── RuneDetail.tsx
│   │   ├── RuneActions.tsx
│   │   └── DependencyList.tsx
│   ├── accounts/
│   │   ├── AccountTable.tsx
│   │   └── AccountDetail.tsx
│   ├── realms/
│   │   ├── RealmTable.tsx
│   │   └── RealmDetail.tsx
│   └── common/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Badge.tsx
│       ├── Card.tsx
│       ├── Table.tsx
│       ├── Modal.tsx
│       └── Toast.tsx
├── pages/
│   ├── +Layout.tsx
│   ├── +config.ts
│   ├── index/+Page.tsx (redirect)
│   ├── onboarding/
│   │   └── +Page.tsx
│   ├── login/
│   │   └── +Page.tsx
│   ├── dashboard/
│   │   └── +Page.tsx
│   ├── runes/
│   │   ├── +Page.tsx
│   │   └── [id]/
│   │       └── +Page.tsx
│   ├── account/
│   │   ├── +Page.tsx
│   │   └── pats/
│   │       └── +Page.tsx
│   ├── realm/
│   │   └── +Page.tsx
│   └── admin/
│       ├── accounts/
│       │   ├── +Page.tsx
│       │   └── [id]/
│       │       └── +Page.tsx
│       └── realms/
│           ├── +Page.tsx
│           └── [id]/
│               └── +Page.tsx
├── lib/
│   ├── api.ts          # API client
│   ├── auth.ts         # Auth utilities
│   └── hooks/
│       ├── useSession.ts
│       ├── useRealm.ts
│       └── useRune.ts
├── types/
│   ├── rune.ts
│   ├── account.ts
│   ├── realm.ts
│   └── session.ts
└── theme/
    └── index.tsx       # Theme provider
```

### State Management

**Approach**: React Context + SWR for server state

**Contexts**:
- `SessionContext` - Current user, auth state
- `RealmContext` - Selected realm, available realms
- `ThemeContext` - Dark/light mode

**Data Fetching**:
- SWR for API calls with automatic revalidation
- Optimistic updates for mutations

---

## Go Server Changes

### Proxy Configuration

Add to `server/main.go`:

```go
// Proxy /ui/* to vike dev server (development) or serve built files (production)
if cfg.AdminUIStaticPath != "" {
    // Production: serve built vike app
    mux.Handle("/ui/", http.StripPrefix("/ui/", http.FileServer(http.Dir(cfg.AdminUIStaticPath))))
} else {
    // Development: proxy to vike dev server
    // Vite dev server runs on port 3000
}
```

### New Session Management

Add session-based authentication for UI:

1. **Session Store**: In-memory or Redis-based session storage
2. **Login Endpoint**: Exchange PAT for session token
3. **Session Middleware**: Validate session and load user context
4. **Session Info Endpoint**: Return current user's realms/roles

---

## Implementation Order

### Phase 1: Foundation
1. Update vite.config.ts for `/ui/` base
2. Create API client with auth handling
3. Implement session context and hooks
4. Create base layout with navbar
5. Implement RealmSelector and AccountBadge

### Phase 2: Core Pages
1. Login page with PAT authentication
2. Dashboard with stats
3. Runes list with filtering
4. Rune detail/edit page

### Phase 3: Realm Management
1. Realm settings page (for realm admins)
2. Member management

### Phase 4: SysAdmin
1. Accounts list and detail
2. Realms list and detail
3. Account creation and management

### Phase 5: Onboarding
1. Onboarding flow for fresh installs
2. First-time setup wizard

### Phase 6: Polish
1. Light mode theme
2. Toast notifications
3. Loading states
4. Error handling
5. Responsive design

---

## API Request/Response Examples

### Login
```typescript
// POST /ui/login
Request: { "pat": "abc123..." }
Response: {
  "account_id": "acct-xxx",
  "username": "admin",
  "realms": ["realm-1", "realm-2"],
  "roles": { "realm-1": "owner", "realm-2": "member" }
}
// Sets HTTP-only session cookie
```

### List Runes
```typescript
// GET /runes?status=open&blocked=false
// Headers: Authorization: Bearer <session>, X-Bifrost-Realm: realm-1
Response: [
  {
    "id": "rune-xxx",
    "title": "Implement feature X",
    "status": "open",
    "priority": 1,
    "claimant": null,
    "created_at": "2024-01-15T10:00:00Z"
  }
]
```

### Create Rune
```typescript
// POST /create-rune
// Headers: Authorization: Bearer <session>, X-Bifrost-Realm: realm-1
Request: {
  "title": "New feature",
  "description": "Description here",
  "priority": 2
}
Response: {
  "id": "rune-yyy",
  "title": "New feature",
  "status": "draft",
  ...
}
```

---

## Security Considerations

1. **Session Tokens**: HTTP-only, Secure, SameSite cookies
2. **CSRF Protection**: Validate origin/referer headers
3. **Input Validation**: Client-side + server-side validation
4. **XSS Prevention**: React's default escaping, sanitize markdown
5. **Authorization**: All API calls verify realm/role permissions
