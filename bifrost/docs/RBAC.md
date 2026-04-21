# Role-Based Access Control (RBAC)

Bifrost implements a hierarchical role-based access control system with multi-tenant isolation through realms.

## Role Hierarchy

The permission hierarchy follows strict inheritance - each tier inherits all permissions from below plus additional capabilities:

```
viewer ⊆ member ⊆ admin (realm) ⊆ owner ⊆ system-admin
```

| Role | Scope | Permissions |
|------|-------|-------------|
| **viewer** | Realm | View runes in the realm |
| **member** | Realm | All viewer permissions + claim/fulfill/seal/shatter runes |
| **admin** | Realm | All member permissions + assign viewer/member roles, sweep runes |
| **owner** | Realm | All admin permissions + (future: delete realm) |
| **system-admin** | System (`_admin` realm) | All permissions in all realms + create/delete realms, create users |

## System Admin vs Realm Admin

### System Admin

System admins have admin or owner role in the special `_admin` realm. They can:

- View and manage ALL realms (not just ones they have roles in)
- Create and delete realms
- Create and suspend accounts
- Manage PATs for any account
- Assign any role (including admin/owner) in any realm

### Realm Admin

Realm admins have admin or owner role in a specific realm. They can:

- View their realm's details and members
- Assign viewer or member roles to users in their realm
- Sweep completed runes in their realm
- Cannot assign admin or owner roles
- Cannot create accounts or manage PATs

## Realms

Realms provide tenant isolation. Each realm is a separate namespace containing:

- Runes (work items)
- Member roles

The `_admin` realm is reserved for system administration and contains:

- Realm registry
- Account registry
- System-wide configuration

## Authorization Checks

The admin UI implements authorization at multiple levels:

### Handler-Level Checks

Most authorization happens in handlers (not middleware) because:

1. The realm ID is determined at runtime from cookies
2. Different users have different realm access
3. Realm-specific permissions require dynamic resolution

### Helper Functions

```go
// Check if user can view runes in a realm
func canViewRealm(roles map[string]string, realmID string) bool

// Check if user can perform work actions (claim/fulfill/etc)
func canTakeAction(roles map[string]string, realmID string) bool

// Check if user is realm admin (for sweep, role assignment)
func isRealmAdmin(roles map[string]string, realmID string) bool

// Check if user is system admin
func isAdmin(roles map[string]string) bool
```

### Route Protection

```go
// Public routes (no auth)
mux.HandleFunc("GET /admin/login", handlers.LoginHandler)
mux.Handle("GET /admin/static/", StaticHandler())

// Authenticated routes with realm checks in handlers
mux.Handle("GET /admin/runes", authMiddleware(handlers.RunesListHandler))
mux.Handle("POST /admin/runes/{id}/claim", authMiddleware(handlers.RuneClaimHandler))

// Realm admin routes (handler checks realm access)
mux.Handle("GET /admin/realms/", authMiddleware(handlers.RealmDetailHandler))
mux.Handle("POST /admin/realms/{id}/roles", authMiddleware(handlers.RealmRoleHandler))

// System admin only (middleware enforces)
mux.Handle("GET /admin/realms", authMiddleware(requireAdmin(handlers.RealmsListHandler)))
mux.Handle("POST /admin/accounts/create", authMiddleware(requireAdmin(...)))
```

## Permission Matrix

| Action | viewer | member | admin | owner | system-admin |
|--------|--------|--------|-------|-------|--------------|
| View runes | ✓ | ✓ | ✓ | ✓ | ✓ |
| Claim/fulfill runes | ✗ | ✓ | ✓ | ✓ | ✓ |
| Create runes | ✗ | ✓ | ✓ | ✓ | ✓ |
| Sweep runes | ✗ | ✗ | ✓ | ✓ | ✓ |
| View realm details | ✗ | ✗ | ✓* | ✓* | ✓ |
| Assign viewer/member roles | ✗ | ✗ | ✓* | ✓* | ✓ |
| Assign admin/owner roles | ✗ | ✗ | ✗ | ✗ | ✓ |
| Create/delete realms | ✗ | ✗ | ✗ | ✗ | ✓ |
| Create/suspend accounts | ✗ | ✗ | ✗ | ✗ | ✓ |
| Manage PATs | ✗ | ✗ | ✗ | ✗ | ✓ |

*Only in realms where they have admin/owner role

## Realm Selector

The realm selector in the UI shows:

- **For regular users**: Only realms they have a role in
- **For system admins**: All realms (can select any realm to manage)

When a system admin selects a realm they don't have a direct role in, they still have full access due to their system admin status.

## Implementation Notes

1. **Context Values**: User roles are loaded during authentication and stored in request context
2. **Cookie-Based Selection**: The selected realm is stored in a cookie, validated against user's roles
3. **Fallback Selection**: If no realm is selected, the first available realm is used
4. **Admin Realm Exclusion**: The `_admin` realm is never shown in the realm selector
