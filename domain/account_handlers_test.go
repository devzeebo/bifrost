package domain

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestRebuildAccountState(t *testing.T) {
	t.Run("returns empty state for no events", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.no_account_events()

		// When
		tc.account_state_is_rebuilt()

		// Then
		tc.account_state_does_not_exist()
	})

	t.Run("rebuilds state from AccountCreated event", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.events_from_created_account()

		// When
		tc.account_state_is_rebuilt()

		// Then
		tc.account_state_exists()
		tc.account_state_has_id("acct-a1b2")
		tc.account_state_has_username("alice")
		tc.account_state_has_status("active")
	})

	t.Run("applies AccountSuspended", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.events_from_created_and_suspended_account()

		// When
		tc.account_state_is_rebuilt()

		// Then
		tc.account_state_has_status("suspended")
	})

	t.Run("applies RealmGranted as member role", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.events_from_created_account_with_realm_granted()

		// When
		tc.account_state_is_rebuilt()

		// Then
		tc.account_state_has_realm("bf-a1b2")
		tc.account_state_has_realm_with_role("bf-a1b2", RoleMember)
	})

	t.Run("applies RealmRevoked", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.events_from_created_account_with_realm_granted_and_revoked()

		// When
		tc.account_state_is_rebuilt()

		// Then
		tc.account_state_does_not_have_realm("bf-a1b2")
	})

	t.Run("applies PATCreated", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.events_from_created_account_with_pat()

		// When
		tc.account_state_is_rebuilt()

		// Then
		tc.account_state_has_pat("pat-c3d4")
		tc.account_state_pat_is_not_revoked("pat-c3d4")
	})

	t.Run("applies PATRevoked", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.events_from_created_account_with_pat_revoked()

		// When
		tc.account_state_is_rebuilt()

		// Then
		tc.account_state_pat_is_revoked("pat-c3d4")
	})

	t.Run("applies RoleAssigned", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.events_from_created_account_with_role_assigned()

		// When
		tc.account_state_is_rebuilt()

		// Then
		tc.account_state_has_realm("bf-a1b2")
		tc.account_state_has_realm_with_role("bf-a1b2", RoleAdmin)
	})

	t.Run("applies RoleRevoked", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.events_from_created_account_with_role_assigned_and_revoked()

		// When
		tc.account_state_is_rebuilt()

		// Then
		tc.account_state_does_not_have_realm("bf-a1b2")
	})

	t.Run("replays mixed legacy and new role events correctly", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.events_from_mixed_legacy_and_new_role_events()

		// When
		tc.account_state_is_rebuilt()

		// Then
		tc.account_state_has_realm_with_role("bf-a1b2", RoleAdmin)
		tc.account_state_does_not_have_realm("bf-c3d4")
	})
}

func TestHandleCreateAccount(t *testing.T) {
	t.Run("creates account with generated ID and initial PAT", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.a_projection_store()
		tc.username_is_available("alice")
		tc.a_create_account_command("alice")

		// When
		tc.handle_create_account()

		// Then
		tc.no_account_error()
		tc.create_account_result_has_account_id_matching_pattern()
		tc.create_account_result_has_raw_token()
		tc.account_created_event_was_appended_to_admin_realm()
		tc.account_created_event_stream_has_account_prefix()
		tc.pat_created_event_was_also_appended()
		tc.pat_created_event_has_hashed_key()
	})

	t.Run("returns error when username is taken", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.a_projection_store()
		tc.username_is_taken("alice")
		tc.a_create_account_command("alice")

		// When
		tc.handle_create_account()

		// Then
		tc.account_error_contains(`username "alice" already exists`)
	})
}

func TestHandleSuspendAccount(t *testing.T) {
	t.Run("suspends an active account", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_in_stream("acct-a1b2", "active")
		tc.a_suspend_account_command("acct-a1b2", "policy violation")

		// When
		tc.handle_suspend_account()

		// Then
		tc.no_account_error()
		tc.account_event_was_appended_to_stream("account-acct-a1b2")
		tc.appended_account_event_has_type(EventAccountSuspended)
	})

	t.Run("returns error when account does not exist", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.empty_account_stream("acct-missing")
		tc.a_suspend_account_command("acct-missing", "reason")

		// When
		tc.handle_suspend_account()

		// Then
		tc.account_error_is_not_found("account", "acct-missing")
	})

	t.Run("returns error when account is already suspended", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_in_stream("acct-a1b2", "suspended")
		tc.a_suspend_account_command("acct-a1b2", "another reason")

		// When
		tc.handle_suspend_account()

		// Then
		tc.account_error_contains("suspended")
	})
}

func TestHandleGrantRealm(t *testing.T) {
	t.Run("grants realm to active account", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_in_stream("acct-a1b2", "active")
		tc.a_grant_realm_command("acct-a1b2", "bf-c3d4")

		// When
		tc.handle_grant_realm()

		// Then
		tc.no_account_error()
		tc.account_event_was_appended_to_stream("account-acct-a1b2")
		tc.appended_account_event_has_type(EventRoleAssigned)
		tc.appended_role_assigned_event_has_role(RoleMember)
	})

	t.Run("is idempotent when realm already granted", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_with_realm_granted("acct-a1b2", "bf-c3d4")
		tc.a_grant_realm_command("acct-a1b2", "bf-c3d4")

		// When
		tc.handle_grant_realm()

		// Then
		tc.no_account_error()
		tc.no_events_were_appended()
	})

	t.Run("returns error when account does not exist", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.empty_account_stream("acct-missing")
		tc.a_grant_realm_command("acct-missing", "bf-c3d4")

		// When
		tc.handle_grant_realm()

		// Then
		tc.account_error_is_not_found("account", "acct-missing")
	})

	t.Run("returns error when account is suspended", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_in_stream("acct-a1b2", "suspended")
		tc.a_grant_realm_command("acct-a1b2", "bf-c3d4")

		// When
		tc.handle_grant_realm()

		// Then
		tc.account_error_contains("suspended")
	})
}

func TestHandleRevokeRealm(t *testing.T) {
	t.Run("revokes granted realm from active account", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_with_realm_granted("acct-a1b2", "bf-c3d4")
		tc.a_revoke_realm_command("acct-a1b2", "bf-c3d4")

		// When
		tc.handle_revoke_realm()

		// Then
		tc.no_account_error()
		tc.account_event_was_appended_to_stream("account-acct-a1b2")
		tc.appended_account_event_has_type(EventRoleRevoked)
	})

	t.Run("returns error when account does not exist", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.empty_account_stream("acct-missing")
		tc.a_revoke_realm_command("acct-missing", "bf-c3d4")

		// When
		tc.handle_revoke_realm()

		// Then
		tc.account_error_is_not_found("account", "acct-missing")
	})

	t.Run("returns error when account is suspended", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_in_stream("acct-a1b2", "suspended")
		tc.a_revoke_realm_command("acct-a1b2", "bf-c3d4")

		// When
		tc.handle_revoke_realm()

		// Then
		tc.account_error_contains("suspended")
	})

	t.Run("returns error when realm is not granted", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_in_stream("acct-a1b2", "active")
		tc.a_revoke_realm_command("acct-a1b2", "bf-c3d4")

		// When
		tc.handle_revoke_realm()

		// Then
		tc.account_error_contains("not granted")
	})
}

func TestHandleAssignRole(t *testing.T) {
	t.Run("assigns valid role to active account", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_in_stream("acct-a1b2", "active")
		tc.an_assign_role_command("acct-a1b2", "bf-c3d4", RoleAdmin)

		// When
		tc.handle_assign_role()

		// Then
		tc.no_account_error()
		tc.account_event_was_appended_to_stream("account-acct-a1b2")
		tc.appended_account_event_has_type(EventRoleAssigned)
		tc.appended_role_assigned_event_has_role(RoleAdmin)
	})

	t.Run("rejects invalid role with descriptive error", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_in_stream("acct-a1b2", "active")
		tc.an_assign_role_command("acct-a1b2", "bf-c3d4", "superuser")

		// When
		tc.handle_assign_role()

		// Then
		tc.account_error_contains("invalid role")
	})

	t.Run("is idempotent when same role already assigned", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_with_role("acct-a1b2", "bf-c3d4", RoleAdmin)
		tc.an_assign_role_command("acct-a1b2", "bf-c3d4", RoleAdmin)

		// When
		tc.handle_assign_role()

		// Then
		tc.no_account_error()
		tc.no_events_were_appended()
	})

	t.Run("assigns different role replacing previous", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_with_role("acct-a1b2", "bf-c3d4", RoleMember)
		tc.an_assign_role_command("acct-a1b2", "bf-c3d4", RoleAdmin)

		// When
		tc.handle_assign_role()

		// Then
		tc.no_account_error()
		tc.account_event_was_appended_to_stream("account-acct-a1b2")
		tc.appended_account_event_has_type(EventRoleAssigned)
		tc.appended_role_assigned_event_has_role(RoleAdmin)
	})

	t.Run("returns error when account does not exist", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.empty_account_stream("acct-missing")
		tc.an_assign_role_command("acct-missing", "bf-c3d4", RoleAdmin)

		// When
		tc.handle_assign_role()

		// Then
		tc.account_error_is_not_found("account", "acct-missing")
	})

	t.Run("returns error when account is suspended", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_in_stream("acct-a1b2", "suspended")
		tc.an_assign_role_command("acct-a1b2", "bf-c3d4", RoleAdmin)

		// When
		tc.handle_assign_role()

		// Then
		tc.account_error_contains("suspended")
	})
}

func TestHandleRevokeRole(t *testing.T) {
	t.Run("revokes existing role from active account", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_with_role("acct-a1b2", "bf-c3d4", RoleAdmin)
		tc.a_revoke_role_command("acct-a1b2", "bf-c3d4")

		// When
		tc.handle_revoke_role()

		// Then
		tc.no_account_error()
		tc.account_event_was_appended_to_stream("account-acct-a1b2")
		tc.appended_account_event_has_type(EventRoleRevoked)
	})

	t.Run("returns error when account has no role for realm", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_in_stream("acct-a1b2", "active")
		tc.a_revoke_role_command("acct-a1b2", "bf-c3d4")

		// When
		tc.handle_revoke_role()

		// Then
		tc.account_error_contains("not granted")
	})

	t.Run("returns error when account does not exist", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.empty_account_stream("acct-missing")
		tc.a_revoke_role_command("acct-missing", "bf-c3d4")

		// When
		tc.handle_revoke_role()

		// Then
		tc.account_error_is_not_found("account", "acct-missing")
	})

	t.Run("returns error when account is suspended", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_in_stream("acct-a1b2", "suspended")
		tc.a_revoke_role_command("acct-a1b2", "bf-c3d4")

		// When
		tc.handle_revoke_role()

		// Then
		tc.account_error_contains("suspended")
	})
}

func TestHandleCreatePAT(t *testing.T) {
	t.Run("creates PAT for active account", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_in_stream("acct-a1b2", "active")
		tc.a_create_pat_command("acct-a1b2", "CI token")

		// When
		tc.handle_create_pat()

		// Then
		tc.no_account_error()
		tc.create_pat_result_has_pat_id_matching_pattern()
		tc.create_pat_result_has_raw_token()
		tc.account_event_was_appended_to_stream("account-acct-a1b2")
		tc.appended_account_event_has_type(EventPATCreated)
		tc.appended_pat_created_event_has_hashed_key()
	})

	t.Run("returns error when account does not exist", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.empty_account_stream("acct-missing")
		tc.a_create_pat_command("acct-missing", "CI token")

		// When
		tc.handle_create_pat()

		// Then
		tc.account_error_is_not_found("account", "acct-missing")
	})

	t.Run("returns error when account is suspended", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_in_stream("acct-a1b2", "suspended")
		tc.a_create_pat_command("acct-a1b2", "CI token")

		// When
		tc.handle_create_pat()

		// Then
		tc.account_error_contains("suspended")
	})
}

func TestHandleRevokePAT(t *testing.T) {
	t.Run("revokes existing PAT", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_with_pat("acct-a1b2", "pat-c3d4")
		tc.a_revoke_pat_command("acct-a1b2", "pat-c3d4")

		// When
		tc.handle_revoke_pat()

		// Then
		tc.no_account_error()
		tc.account_event_was_appended_to_stream("account-acct-a1b2")
		tc.appended_account_event_has_type(EventPATRevoked)
	})

	t.Run("returns error when account does not exist", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.empty_account_stream("acct-missing")
		tc.a_revoke_pat_command("acct-missing", "pat-c3d4")

		// When
		tc.handle_revoke_pat()

		// Then
		tc.account_error_is_not_found("account", "acct-missing")
	})

	t.Run("returns error when account is suspended", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_in_stream("acct-a1b2", "suspended")
		tc.a_revoke_pat_command("acct-a1b2", "pat-c3d4")

		// When
		tc.handle_revoke_pat()

		// Then
		tc.account_error_contains("suspended")
	})

	t.Run("returns error when PAT does not exist", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_in_stream("acct-a1b2", "active")
		tc.a_revoke_pat_command("acct-a1b2", "pat-missing")

		// When
		tc.handle_revoke_pat()

		// Then
		tc.account_error_contains("not found")
	})

	t.Run("returns error when PAT is already revoked", func(t *testing.T) {
		tc := newAccountHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_account_with_revoked_pat("acct-a1b2", "pat-c3d4")
		tc.a_revoke_pat_command("acct-a1b2", "pat-c3d4")

		// When
		tc.handle_revoke_pat()

		// Then
		tc.account_error_contains("already revoked")
	})
}

// --- Test Context ---

type accountHandlerTestContext struct {
	t *testing.T

	eventStore      *mockEventStore
	projectionStore *mockProjectionStore
	ctx             context.Context

	createAccountCmd  CreateAccount
	suspendAccountCmd SuspendAccount
	grantRealmCmd     GrantRealm
	revokeRealmCmd    RevokeRealm
	createPATCmd      CreatePAT
	revokePATCmd      RevokePAT
	assignRoleCmd     AssignRole
	revokeRoleCmd     RevokeRole

	createAccountResult CreateAccountResult
	createPATResult     CreatePATResult
	accountState        AccountState
	accountEvents       []core.Event
	err                 error
}

func newAccountHandlerTestContext(t *testing.T) *accountHandlerTestContext {
	t.Helper()
	return &accountHandlerTestContext{
		t:   t,
		ctx: context.Background(),
	}
}

// --- Given ---

func (tc *accountHandlerTestContext) an_event_store() {
	tc.t.Helper()
	if tc.eventStore == nil {
		tc.eventStore = newMockEventStore()
	}
}

func (tc *accountHandlerTestContext) a_projection_store() {
	tc.t.Helper()
	if tc.projectionStore == nil {
		tc.projectionStore = newMockProjectionStore()
	}
}

func (tc *accountHandlerTestContext) no_account_events() {
	tc.t.Helper()
	tc.accountEvents = []core.Event{}
}

func (tc *accountHandlerTestContext) events_from_created_account() {
	tc.t.Helper()
	tc.accountEvents = []core.Event{
		makeEvent(EventAccountCreated, AccountCreated{
			AccountID: "acct-a1b2", Username: "alice",
		}),
	}
}

func (tc *accountHandlerTestContext) events_from_created_and_suspended_account() {
	tc.t.Helper()
	tc.accountEvents = []core.Event{
		makeEvent(EventAccountCreated, AccountCreated{
			AccountID: "acct-a1b2", Username: "alice",
		}),
		makeEvent(EventAccountSuspended, AccountSuspended{
			AccountID: "acct-a1b2", Reason: "policy violation",
		}),
	}
}

func (tc *accountHandlerTestContext) events_from_created_account_with_realm_granted() {
	tc.t.Helper()
	tc.accountEvents = []core.Event{
		makeEvent(EventAccountCreated, AccountCreated{
			AccountID: "acct-a1b2", Username: "alice",
		}),
		makeEvent(EventRealmGranted, RealmGranted{
			AccountID: "acct-a1b2", RealmID: "bf-a1b2",
		}),
	}
}

func (tc *accountHandlerTestContext) events_from_created_account_with_realm_granted_and_revoked() {
	tc.t.Helper()
	tc.accountEvents = []core.Event{
		makeEvent(EventAccountCreated, AccountCreated{
			AccountID: "acct-a1b2", Username: "alice",
		}),
		makeEvent(EventRealmGranted, RealmGranted{
			AccountID: "acct-a1b2", RealmID: "bf-a1b2",
		}),
		makeEvent(EventRealmRevoked, RealmRevoked{
			AccountID: "acct-a1b2", RealmID: "bf-a1b2",
		}),
	}
}

func (tc *accountHandlerTestContext) events_from_created_account_with_pat() {
	tc.t.Helper()
	tc.accountEvents = []core.Event{
		makeEvent(EventAccountCreated, AccountCreated{
			AccountID: "acct-a1b2", Username: "alice",
		}),
		makeEvent(EventPATCreated, PATCreated{
			AccountID: "acct-a1b2", PATID: "pat-c3d4", KeyHash: "somehash", Label: "CI token",
		}),
	}
}

func (tc *accountHandlerTestContext) events_from_created_account_with_pat_revoked() {
	tc.t.Helper()
	tc.accountEvents = []core.Event{
		makeEvent(EventAccountCreated, AccountCreated{
			AccountID: "acct-a1b2", Username: "alice",
		}),
		makeEvent(EventPATCreated, PATCreated{
			AccountID: "acct-a1b2", PATID: "pat-c3d4", KeyHash: "somehash", Label: "CI token",
		}),
		makeEvent(EventPATRevoked, PATRevoked{
			AccountID: "acct-a1b2", PATID: "pat-c3d4",
		}),
	}
}

func (tc *accountHandlerTestContext) events_from_created_account_with_role_assigned() {
	tc.t.Helper()
	tc.accountEvents = []core.Event{
		makeEvent(EventAccountCreated, AccountCreated{
			AccountID: "acct-a1b2", Username: "alice",
		}),
		makeEvent(EventRoleAssigned, RoleAssigned{
			AccountID: "acct-a1b2", RealmID: "bf-a1b2", Role: RoleAdmin,
		}),
	}
}

func (tc *accountHandlerTestContext) events_from_created_account_with_role_assigned_and_revoked() {
	tc.t.Helper()
	tc.accountEvents = []core.Event{
		makeEvent(EventAccountCreated, AccountCreated{
			AccountID: "acct-a1b2", Username: "alice",
		}),
		makeEvent(EventRoleAssigned, RoleAssigned{
			AccountID: "acct-a1b2", RealmID: "bf-a1b2", Role: RoleAdmin,
		}),
		makeEvent(EventRoleRevoked, RoleRevoked{
			AccountID: "acct-a1b2", RealmID: "bf-a1b2",
		}),
	}
}

func (tc *accountHandlerTestContext) events_from_mixed_legacy_and_new_role_events() {
	tc.t.Helper()
	tc.accountEvents = []core.Event{
		makeEvent(EventAccountCreated, AccountCreated{
			AccountID: "acct-a1b2", Username: "alice",
		}),
		// Legacy grant -> member
		makeEvent(EventRealmGranted, RealmGranted{
			AccountID: "acct-a1b2", RealmID: "bf-a1b2",
		}),
		// Upgrade to admin via new event
		makeEvent(EventRoleAssigned, RoleAssigned{
			AccountID: "acct-a1b2", RealmID: "bf-a1b2", Role: RoleAdmin,
		}),
		// Second realm via legacy grant
		makeEvent(EventRealmGranted, RealmGranted{
			AccountID: "acct-a1b2", RealmID: "bf-c3d4",
		}),
		// Revoke second realm via legacy revoke
		makeEvent(EventRealmRevoked, RealmRevoked{
			AccountID: "acct-a1b2", RealmID: "bf-c3d4",
		}),
	}
}

func (tc *accountHandlerTestContext) existing_account_in_stream(accountID string, status string) {
	tc.t.Helper()
	tc.an_event_store()
	events := []core.Event{
		makeEvent(EventAccountCreated, AccountCreated{
			AccountID: accountID, Username: "alice",
		}),
	}
	if status == "suspended" {
		events = append(events, makeEvent(EventAccountSuspended, AccountSuspended{
			AccountID: accountID, Reason: "suspended",
		}))
	}
	tc.eventStore.streams["account-"+accountID] = events
}

func (tc *accountHandlerTestContext) existing_account_with_realm_granted(accountID string, realmID string) {
	tc.t.Helper()
	tc.an_event_store()
	tc.eventStore.streams["account-"+accountID] = []core.Event{
		makeEvent(EventAccountCreated, AccountCreated{
			AccountID: accountID, Username: "alice",
		}),
		makeEvent(EventRealmGranted, RealmGranted{
			AccountID: accountID, RealmID: realmID,
		}),
	}
}

func (tc *accountHandlerTestContext) existing_account_with_pat(accountID string, patID string) {
	tc.t.Helper()
	tc.an_event_store()
	tc.eventStore.streams["account-"+accountID] = []core.Event{
		makeEvent(EventAccountCreated, AccountCreated{
			AccountID: accountID, Username: "alice",
		}),
		makeEvent(EventPATCreated, PATCreated{
			AccountID: accountID, PATID: patID, KeyHash: "somehash", Label: "CI token",
		}),
	}
}

func (tc *accountHandlerTestContext) existing_account_with_revoked_pat(accountID string, patID string) {
	tc.t.Helper()
	tc.an_event_store()
	tc.eventStore.streams["account-"+accountID] = []core.Event{
		makeEvent(EventAccountCreated, AccountCreated{
			AccountID: accountID, Username: "alice",
		}),
		makeEvent(EventPATCreated, PATCreated{
			AccountID: accountID, PATID: patID, KeyHash: "somehash", Label: "CI token",
		}),
		makeEvent(EventPATRevoked, PATRevoked{
			AccountID: accountID, PATID: patID,
		}),
	}
}

func (tc *accountHandlerTestContext) empty_account_stream(accountID string) {
	tc.t.Helper()
	tc.an_event_store()
	tc.eventStore.streams["account-"+accountID] = []core.Event{}
}

func (tc *accountHandlerTestContext) username_is_available(username string) {
	tc.t.Helper()
	tc.a_projection_store()
	// No entry means username is available (Get returns NotFoundError)
}

func (tc *accountHandlerTestContext) username_is_taken(username string) {
	tc.t.Helper()
	tc.a_projection_store()
	tc.projectionStore.data["account_lookup:username:"+username] = "acct-existing"
}

func (tc *accountHandlerTestContext) a_create_account_command(username string) {
	tc.t.Helper()
	tc.createAccountCmd = CreateAccount{Username: username}
}

func (tc *accountHandlerTestContext) a_suspend_account_command(accountID, reason string) {
	tc.t.Helper()
	tc.suspendAccountCmd = SuspendAccount{AccountID: accountID, Reason: reason}
}

func (tc *accountHandlerTestContext) a_grant_realm_command(accountID, realmID string) {
	tc.t.Helper()
	tc.grantRealmCmd = GrantRealm{AccountID: accountID, RealmID: realmID}
}

func (tc *accountHandlerTestContext) a_revoke_realm_command(accountID, realmID string) {
	tc.t.Helper()
	tc.revokeRealmCmd = RevokeRealm{AccountID: accountID, RealmID: realmID}
}

func (tc *accountHandlerTestContext) a_create_pat_command(accountID, label string) {
	tc.t.Helper()
	tc.createPATCmd = CreatePAT{AccountID: accountID, Label: label}
}

func (tc *accountHandlerTestContext) a_revoke_pat_command(accountID, patID string) {
	tc.t.Helper()
	tc.revokePATCmd = RevokePAT{AccountID: accountID, PATID: patID}
}

func (tc *accountHandlerTestContext) an_assign_role_command(accountID, realmID, role string) {
	tc.t.Helper()
	tc.assignRoleCmd = AssignRole{AccountID: accountID, RealmID: realmID, Role: role}
}

func (tc *accountHandlerTestContext) a_revoke_role_command(accountID, realmID string) {
	tc.t.Helper()
	tc.revokeRoleCmd = RevokeRole{AccountID: accountID, RealmID: realmID}
}

func (tc *accountHandlerTestContext) existing_account_with_role(accountID, realmID, role string) {
	tc.t.Helper()
	tc.an_event_store()
	tc.eventStore.streams["account-"+accountID] = []core.Event{
		makeEvent(EventAccountCreated, AccountCreated{
			AccountID: accountID, Username: "alice",
		}),
		makeEvent(EventRoleAssigned, RoleAssigned{
			AccountID: accountID, RealmID: realmID, Role: role,
		}),
	}
}

// --- When ---

func (tc *accountHandlerTestContext) account_state_is_rebuilt() {
	tc.t.Helper()
	tc.accountState = RebuildAccountState(tc.accountEvents)
}

func (tc *accountHandlerTestContext) handle_create_account() {
	tc.t.Helper()
	tc.createAccountResult, tc.err = HandleCreateAccount(tc.ctx, tc.createAccountCmd, tc.eventStore, tc.projectionStore)
}

func (tc *accountHandlerTestContext) handle_suspend_account() {
	tc.t.Helper()
	tc.err = HandleSuspendAccount(tc.ctx, tc.suspendAccountCmd, tc.eventStore)
}

func (tc *accountHandlerTestContext) handle_grant_realm() {
	tc.t.Helper()
	tc.err = HandleGrantRealm(tc.ctx, tc.grantRealmCmd, tc.eventStore)
}

func (tc *accountHandlerTestContext) handle_revoke_realm() {
	tc.t.Helper()
	tc.err = HandleRevokeRealm(tc.ctx, tc.revokeRealmCmd, tc.eventStore)
}

func (tc *accountHandlerTestContext) handle_create_pat() {
	tc.t.Helper()
	tc.createPATResult, tc.err = HandleCreatePAT(tc.ctx, tc.createPATCmd, tc.eventStore)
}

func (tc *accountHandlerTestContext) handle_revoke_pat() {
	tc.t.Helper()
	tc.err = HandleRevokePAT(tc.ctx, tc.revokePATCmd, tc.eventStore)
}

func (tc *accountHandlerTestContext) handle_assign_role() {
	tc.t.Helper()
	tc.err = HandleAssignRole(tc.ctx, tc.assignRoleCmd, tc.eventStore)
}

func (tc *accountHandlerTestContext) handle_revoke_role() {
	tc.t.Helper()
	tc.err = HandleRevokeRole(tc.ctx, tc.revokeRoleCmd, tc.eventStore)
}

// --- Then ---

func (tc *accountHandlerTestContext) no_account_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *accountHandlerTestContext) account_error_contains(substring string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), substring)
}

func (tc *accountHandlerTestContext) account_error_is_not_found(entity, id string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	var nfe *core.NotFoundError
	require.True(tc.t, errors.As(tc.err, &nfe), "expected NotFoundError, got %T: %v", tc.err, tc.err)
	assert.Equal(tc.t, entity, nfe.Entity)
	assert.Equal(tc.t, id, nfe.ID)
}

func (tc *accountHandlerTestContext) account_state_does_not_exist() {
	tc.t.Helper()
	assert.False(tc.t, tc.accountState.Exists)
}

func (tc *accountHandlerTestContext) account_state_exists() {
	tc.t.Helper()
	assert.True(tc.t, tc.accountState.Exists)
}

func (tc *accountHandlerTestContext) account_state_has_id(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.accountState.AccountID)
}

func (tc *accountHandlerTestContext) account_state_has_username(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.accountState.Username)
}

func (tc *accountHandlerTestContext) account_state_has_status(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.accountState.Status)
}

func (tc *accountHandlerTestContext) account_state_has_realm(realmID string) {
	tc.t.Helper()
	_, ok := tc.accountState.Realms[realmID]
	assert.True(tc.t, ok, "expected realm %q to be granted", realmID)
}

func (tc *accountHandlerTestContext) account_state_does_not_have_realm(realmID string) {
	tc.t.Helper()
	_, ok := tc.accountState.Realms[realmID]
	assert.False(tc.t, ok, "expected realm %q to not be granted", realmID)
}

func (tc *accountHandlerTestContext) account_state_has_realm_with_role(realmID string, expectedRole string) {
	tc.t.Helper()
	role, ok := tc.accountState.Realms[realmID]
	require.True(tc.t, ok, "expected realm %q to be granted", realmID)
	assert.Equal(tc.t, expectedRole, role)
}

func (tc *accountHandlerTestContext) account_state_has_pat(patID string) {
	tc.t.Helper()
	_, ok := tc.accountState.PATs[patID]
	assert.True(tc.t, ok, "expected PAT %q to exist", patID)
}

func (tc *accountHandlerTestContext) account_state_pat_is_not_revoked(patID string) {
	tc.t.Helper()
	pat, ok := tc.accountState.PATs[patID]
	require.True(tc.t, ok, "PAT %q not found", patID)
	assert.False(tc.t, pat.Revoked)
}

func (tc *accountHandlerTestContext) account_state_pat_is_revoked(patID string) {
	tc.t.Helper()
	pat, ok := tc.accountState.PATs[patID]
	require.True(tc.t, ok, "PAT %q not found", patID)
	assert.True(tc.t, pat.Revoked)
}

func (tc *accountHandlerTestContext) create_account_result_has_account_id_matching_pattern() {
	tc.t.Helper()
	assert.Regexp(tc.t, `^acct-[0-9a-f]{8}$`, tc.createAccountResult.AccountID)
}

func (tc *accountHandlerTestContext) create_account_result_has_raw_token() {
	tc.t.Helper()
	assert.NotEmpty(tc.t, tc.createAccountResult.RawToken)
	decoded, err := base64.RawURLEncoding.DecodeString(tc.createAccountResult.RawToken)
	assert.NoError(tc.t, err)
	assert.Len(tc.t, decoded, 32)
}

func (tc *accountHandlerTestContext) account_created_event_was_appended_to_admin_realm() {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	assert.Equal(tc.t, AdminRealmID, lastCall.realmID)
}

func (tc *accountHandlerTestContext) account_created_event_stream_has_account_prefix() {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	assert.Contains(tc.t, lastCall.streamID, "account-")
}

func (tc *accountHandlerTestContext) pat_created_event_was_also_appended() {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	require.GreaterOrEqual(tc.t, len(lastCall.events), 2, "expected at least 2 events (AccountCreated + PATCreated)")
	found := false
	for _, evt := range lastCall.events {
		if evt.EventType == EventPATCreated {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected PATCreated event in appended events")
}

func (tc *accountHandlerTestContext) pat_created_event_has_hashed_key() {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]

	var patEvt PATCreated
	for _, evt := range lastCall.events {
		if evt.EventType == EventPATCreated {
			dataBytes, err := json.Marshal(evt.Data)
			require.NoError(tc.t, err)
			require.NoError(tc.t, json.Unmarshal(dataBytes, &patEvt))
			break
		}
	}

	rawTokenBytes, err := base64.RawURLEncoding.DecodeString(tc.createAccountResult.RawToken)
	require.NoError(tc.t, err)
	expectedHash := sha256.Sum256(rawTokenBytes)
	expectedHashStr := base64.RawURLEncoding.EncodeToString(expectedHash[:])
	assert.Equal(tc.t, expectedHashStr, patEvt.KeyHash)
}

func (tc *accountHandlerTestContext) account_event_was_appended_to_stream(streamID string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	found := false
	for _, call := range tc.eventStore.appendedCalls {
		if call.streamID == streamID {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected Append to stream %q", streamID)
}

func (tc *accountHandlerTestContext) appended_account_event_has_type(eventType string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	require.NotEmpty(tc.t, lastCall.events)
	found := false
	for _, evt := range lastCall.events {
		if evt.EventType == eventType {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected event type %q in appended events", eventType)
}

func (tc *accountHandlerTestContext) appended_pat_created_event_has_hashed_key() {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]

	var patEvt PATCreated
	for _, evt := range lastCall.events {
		if evt.EventType == EventPATCreated {
			dataBytes, err := json.Marshal(evt.Data)
			require.NoError(tc.t, err)
			require.NoError(tc.t, json.Unmarshal(dataBytes, &patEvt))
			break
		}
	}

	rawTokenBytes, err := base64.RawURLEncoding.DecodeString(tc.createPATResult.RawToken)
	require.NoError(tc.t, err)
	expectedHash := sha256.Sum256(rawTokenBytes)
	expectedHashStr := base64.RawURLEncoding.EncodeToString(expectedHash[:])
	assert.Equal(tc.t, expectedHashStr, patEvt.KeyHash)
}

func (tc *accountHandlerTestContext) appended_role_assigned_event_has_role(expectedRole string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	require.NotEmpty(tc.t, lastCall.events)
	var found bool
	for _, evt := range lastCall.events {
		if evt.EventType == EventRoleAssigned {
			dataBytes, err := json.Marshal(evt.Data)
			require.NoError(tc.t, err)
			var ra RoleAssigned
			require.NoError(tc.t, json.Unmarshal(dataBytes, &ra))
			assert.Equal(tc.t, expectedRole, ra.Role)
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected RoleAssigned event in appended events")
}

func (tc *accountHandlerTestContext) no_events_were_appended() {
	tc.t.Helper()
	assert.Empty(tc.t, tc.eventStore.appendedCalls, "expected no Append calls")
}

func (tc *accountHandlerTestContext) create_pat_result_has_pat_id_matching_pattern() {
	tc.t.Helper()
	assert.Regexp(tc.t, `^pat-[0-9a-f]{8}$`, tc.createPATResult.PATID)
}

func (tc *accountHandlerTestContext) create_pat_result_has_raw_token() {
	tc.t.Helper()
	assert.NotEmpty(tc.t, tc.createPATResult.RawToken)
	decoded, err := base64.RawURLEncoding.DecodeString(tc.createPATResult.RawToken)
	assert.NoError(tc.t, err)
	assert.Len(tc.t, decoded, 32)
}
