package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// --- Tests ---

func TestRoleConstants(t *testing.T) {
	t.Run("role constants have correct string values", func(t *testing.T) {
		tc := newRolesTestContext(t)

		// Then
		tc.role_constants_are_correct()
	})
}

func TestValidRoles(t *testing.T) {
	t.Run("contains all four valid roles", func(t *testing.T) {
		tc := newRolesTestContext(t)

		// Then
		tc.valid_roles_contains_all_four_roles()
	})
}

func TestRoleLevel(t *testing.T) {
	t.Run("returns correct hierarchy values", func(t *testing.T) {
		tc := newRolesTestContext(t)

		// Then
		tc.owner_level_is_4()
		tc.admin_level_is_3()
		tc.member_level_is_2()
		tc.viewer_level_is_1()
		tc.unknown_level_is_0()
	})

	t.Run("owner outranks all other roles", func(t *testing.T) {
		tc := newRolesTestContext(t)

		// Then
		tc.owner_outranks_admin()
		tc.owner_outranks_member()
		tc.owner_outranks_viewer()
	})

	t.Run("returns 0 for empty string", func(t *testing.T) {
		tc := newRolesTestContext(t)

		// Given
		tc.role_is("")

		// When
		tc.role_level_is_computed()

		// Then
		tc.level_is(0)
	})

	t.Run("returns 0 for unknown role string", func(t *testing.T) {
		tc := newRolesTestContext(t)

		// Given
		tc.role_is("superadmin")

		// When
		tc.role_level_is_computed()

		// Then
		tc.level_is(0)
	})
}

func TestIsValidRole(t *testing.T) {
	t.Run("returns true for all four valid roles", func(t *testing.T) {
		tc := newRolesTestContext(t)

		// Then
		tc.owner_is_valid()
		tc.admin_is_valid()
		tc.member_is_valid()
		tc.viewer_is_valid()
	})

	t.Run("returns false for empty string", func(t *testing.T) {
		tc := newRolesTestContext(t)

		// Given
		tc.role_is("")

		// When
		tc.role_validity_is_checked()

		// Then
		tc.role_is_not_valid()
	})

	t.Run("returns false for unknown role string", func(t *testing.T) {
		tc := newRolesTestContext(t)

		// Given
		tc.role_is("superadmin")

		// When
		tc.role_validity_is_checked()

		// Then
		tc.role_is_not_valid()
	})
}

// --- Test Context ---

type rolesTestContext struct {
	t *testing.T

	role    string
	level   int
	isValid bool
}

func newRolesTestContext(t *testing.T) *rolesTestContext {
	t.Helper()
	return &rolesTestContext{t: t}
}

// --- Given ---

func (tc *rolesTestContext) role_is(role string) {
	tc.t.Helper()
	tc.role = role
}

// --- When ---

func (tc *rolesTestContext) role_level_is_computed() {
	tc.t.Helper()
	tc.level = RoleLevel(tc.role)
}

func (tc *rolesTestContext) role_validity_is_checked() {
	tc.t.Helper()
	tc.isValid = IsValidRole(tc.role)
}

// --- Then ---

func (tc *rolesTestContext) role_constants_are_correct() {
	tc.t.Helper()
	assert.Equal(tc.t, "owner", RoleOwner)
	assert.Equal(tc.t, "admin", RoleAdmin)
	assert.Equal(tc.t, "member", RoleMember)
	assert.Equal(tc.t, "viewer", RoleViewer)
}

func (tc *rolesTestContext) valid_roles_contains_all_four_roles() {
	tc.t.Helper()
	assert.Len(tc.t, ValidRoles, 4)
	assert.Contains(tc.t, ValidRoles, RoleOwner)
	assert.Contains(tc.t, ValidRoles, RoleAdmin)
	assert.Contains(tc.t, ValidRoles, RoleMember)
	assert.Contains(tc.t, ValidRoles, RoleViewer)
}

func (tc *rolesTestContext) owner_level_is_4() {
	tc.t.Helper()
	assert.Equal(tc.t, 4, RoleLevel(RoleOwner))
}

func (tc *rolesTestContext) admin_level_is_3() {
	tc.t.Helper()
	assert.Equal(tc.t, 3, RoleLevel(RoleAdmin))
}

func (tc *rolesTestContext) member_level_is_2() {
	tc.t.Helper()
	assert.Equal(tc.t, 2, RoleLevel(RoleMember))
}

func (tc *rolesTestContext) viewer_level_is_1() {
	tc.t.Helper()
	assert.Equal(tc.t, 1, RoleLevel(RoleViewer))
}

func (tc *rolesTestContext) unknown_level_is_0() {
	tc.t.Helper()
	assert.Equal(tc.t, 0, RoleLevel("unknown"))
}

func (tc *rolesTestContext) owner_outranks_admin() {
	tc.t.Helper()
	assert.Greater(tc.t, RoleLevel(RoleOwner), RoleLevel(RoleAdmin))
}

func (tc *rolesTestContext) owner_outranks_member() {
	tc.t.Helper()
	assert.Greater(tc.t, RoleLevel(RoleOwner), RoleLevel(RoleMember))
}

func (tc *rolesTestContext) owner_outranks_viewer() {
	tc.t.Helper()
	assert.Greater(tc.t, RoleLevel(RoleOwner), RoleLevel(RoleViewer))
}

func (tc *rolesTestContext) level_is(expected int) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.level)
}

func (tc *rolesTestContext) owner_is_valid() {
	tc.t.Helper()
	assert.True(tc.t, IsValidRole(RoleOwner))
}

func (tc *rolesTestContext) admin_is_valid() {
	tc.t.Helper()
	assert.True(tc.t, IsValidRole(RoleAdmin))
}

func (tc *rolesTestContext) member_is_valid() {
	tc.t.Helper()
	assert.True(tc.t, IsValidRole(RoleMember))
}

func (tc *rolesTestContext) viewer_is_valid() {
	tc.t.Helper()
	assert.True(tc.t, IsValidRole(RoleViewer))
}

func (tc *rolesTestContext) role_is_not_valid() {
	tc.t.Helper()
	assert.False(tc.t, tc.isValid)
}
