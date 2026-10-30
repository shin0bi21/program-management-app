# Authentication and Permissions

For API areas and request contracts, see the [API overview](api.md).
Unless stated otherwise, source paths in this document are relative to `backend/`.

## Session Flow

```mermaid
flowchart TD
    Login[POST /auth/login] --> Credentials{Valid credentials and active account?}
    Credentials -->|No| Denied[Reject login]
    Credentials -->|Yes| Trusted{Trusted device?}
    Trusted -->|No| Code[Email a 2FA code]
    Code --> Verify[POST /auth/verify]
    Verify --> Session[Issue access token and refresh cookie]
    Trusted -->|Yes| Session
    Session --> Refresh[POST /auth/refresh]
    Refresh --> Rotate[Replace refresh token and issue access token]
    Session --> Logout[POST /auth/logout]
    Logout --> Revoke[Revoke refresh token and blacklist access token]
```

Only active accounts may log in. Five consecutive failed password attempts lock an account for 15 minutes. A 2FA code expires after 5 minutes. Trusted-device reuse extends trust to 30 days from the current time.

| Contract | Access token | Refresh token |
|---|---|---|
| Secret | `JWT_SECRET` | `REFRESH_SECRET` |
| TTL | 4 hours | 8 hours |
| Sent as | `Authorization: Bearer` header | `httpOnly` cookie (`sameSite: 'strict'`, `secure` in production only) |
| Contains `role` + `permissions[]` | ✓ | ✗ |
| `tokenType` claim | `'access'` | `'refresh'` |
| Stored in DB | ✗ (blacklist only on logout) | ✓ (`user_refresh_tokens` table) |

<a id="3-rbac-model"></a>

## Roles and Permissions

Route access and mutations are permission-based. Roles group permissions in the database and may also shape authorized results or presentation—for example, administrators can manage staff and youth accounts while staff can manage youth accounts only. A role check must never replace the route permission check.

The [authorization and policy guide](authorization.md) owns record scope, enforcement, consumer capabilities, and permission changes.

Staff program scope is assignment-based for every program. A program's `enrollment_required` flag controls whether youth must enroll before attendance; it does not automatically grant staff access. Administrators can assign both enrolled- and open-roster programs to staff accounts. Project managers have access to all programs without individual assignments; this does not grant administrator scope over accounts or coworkers’ hours/tasks.

### Roles and Their Permissions

| Role | Permissions |
|------|-------------|
| `admin` | All currently defined permissions, including account, youth, programming, outreach, homepage, settings, and hours access |
| `project_manager` | All staff permissions plus `write:programs`; all-program scope for programs, cycles, rosters, and sessions; other workflows retain staff scope |
| `staff` | Operational permissions assigned by migrations; account results and some workflows remain policy-scoped |
| `youth` | *(none)* |

### Permission Definitions

| Permission | Grants |
|------------|--------|
| `read:accounts` | `GET /api/accounts` with policy-scoped results |
| `write:accounts` | Staff/admin account invitations and account status/invitation mutations |
| `read:youth_profiles` | `GET /api/youth` |
| `write:youth_profiles` | `POST /api/youth`, `PATCH /api/youth/:id` |
| `read:schools` | `GET /api/schools` |
| `write:schools` | `POST /api/schools`, `DELETE /api/schools/:id` |
| `read:programs` | Program, cycle, assignment, and enrollment lookups |
| `write:programs` | Manage programs, cycles, and program-cycle assignments (admin and project manager grant) |
| `write:enrollments` | Enroll and withdraw youth; required alongside outreach and youth-profile writes for Lead signup |
| `read:sessions` | Read sessions, session types, notes, attachments, and assigned scheduling reference data |
| `write:sessions` | Generate and manage sessions, notes, and attachments |
| `read:attendance` | Read session rosters and youth-centric cohort attendance records |
| `write:attendance` | Record and update attendance through session- or youth-centric workflows |
| `read:outreach` | Read leads |
| `write:outreach` | Create/update leads; Lead signup also requires `write:youth_profiles` and `write:enrollments` |
| `read:homepage` | Read managed homepage images and signup availability |
| `write:homepage` | Manage homepage images and public signup availability |
| `read:settings` | `GET /api/settings/*` *(reserved)* |
| `write:settings` | `POST /api/settings/*` *(reserved)* |
| `read:hours` | Read hours resources in policy scope: staff see themselves plus coworkers sharing any program assignment, including each visible coworker’s complete hours row; administrators see all |
| `write:hours` | Create, update, move, and delete policy-scoped logged hours; staff are self-scoped and administrators may act for any staff member |
| `read:tasks` | Read task resources in policy scope: staff see themselves plus coworkers sharing any program assignment, including each visible coworker’s complete task row; administrators see all |
| `write:tasks` | Create, update, change status, and delete policy-scoped tasks; staff are self-scoped and administrators may act for any staff member |

### How Permissions Flow into a Token

Minimal shared lookups use the consuming workflow's capability rather than
requiring program or school management access. See [Reference Data](reference-data.md)
for alternative lookup permissions, authenticated assigned-program labels, and
feature-specific staff scope. `requireAnyPermission(...)` accepts any listed
capability; `requirePermission(...)` continues to require all listed capabilities.

1. On login/verify, `authService.ts` JOINs `user_roles → user_role_has_permissions → user_permissions` to aggregate the user's full permission set into a `json_agg` array.
2. Both `role` (name string) and `permissions` (string array) are embedded in the **access token payload**.
3. `requirePermission(...required)` middleware reads `req.user.permissions` — it never reads `req.user.role`.
4. On refresh, a fresh permission set is re-fetched from DB so role changes take effect on the next rotation.

<a id="4-payload-type-hierarchy"></a>

## Token Payloads

[auth.ts](../../backend/src/types/auth.ts) owns JWT payload types. Access tokens
include role, permissions, and the `access` discriminator; refresh tokens contain
identity and the `refresh` discriminator without permissions. The base payload
allows `iat` and `exp` to be omitted when signing because `jsonwebtoken` stamps
them; verified token types require both fields.

<a id="5-signing-helpers"></a>

## Signing Helpers

`signAccessToken` and `signRefreshToken` in
[authService.ts](../../backend/src/services/auth/authService.ts) are the only
signing owners. They set the secret, expiry, and token discriminator. Required
secrets use `requireEnv()`. Access-token middleware verifies the signature,
requires the access discriminator, and checks revocation before attaching
`req.user`.

## Preserve Session Security

- Refresh checks the signature and a matching, unexpired, unrevoked database record. Replacement insertion and old-token revocation commit in one transaction.
- Tokens from one login share a token family. Reuse of a rotated-out refresh token revokes its family and requires login again.
- Refresh reloads role and permissions from the database. Permission changes take effect on rotation, not midway through an existing access token's lifetime.
- Consume one-time secrets atomically. 2FA uses a conditional update; password reset claims a valid token with a locked update. A separate read followed by a write can allow concurrent reuse.
- Password reset revokes the user's active refresh tokens and activates invited accounts.
- Logout handles either token independently and tolerates expired or invalid tokens. Access-token revocation updates the local cache immediately; other processes refresh their cache after 60 seconds.

Revocation is owned by [tokenRevocationService.ts](../../backend/src/services/auth/tokenRevocationService.ts). Logic shared by middleware and auth services belongs in services or utilities; services must not import middleware.

<a id="where-to-add-a-new-permission"></a>

## Add or Change a Permission

Follow the single [permission-change procedure](authorization.md#add-or-change-a-permission)
in the authorization guide.

## Invite an Account

The [account service](../../backend/src/services/accounts/accountService.ts) creates invited credentials with an unusable password and sends a 7-day activation link to `/reset-password?token=...`. Youth credential creation reuses this mechanism. The normal password-reset endpoint sets the password and promotes `invited` to `active`.

Account policies limit staff to youth accounts; administrators can manage staff, project manager, and administrator accounts. Project managers retain staff authority over youth accounts only.

## Record Auth Events

Use [authLogService.ts](../../backend/src/services/auth/authLogService.ts) for login, lockout, 2FA, trusted-device, logout, password-reset, and token-reuse events. Its `AuthEvent` union owns the event names. Logging failures are reported without failing the auth operation.

Pass the request IP to the service; never store it raw. Auth logs store an HMAC-SHA256 hash of the IPv4 /24 or IPv6 /64 prefix. `LOG_HMAC_SECRET` overrides the `JWT_SECRET` fallback; a separate production secret allows independent rotation. Changing the HMAC secret changes correlation across logs. Email remains stored in plaintext, so IP hashing does not make these records anonymous.
