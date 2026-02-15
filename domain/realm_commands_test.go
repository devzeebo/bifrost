package domain

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestCreateRealmCommand(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newRealmCmdTestContext(t)

		// Given
		tc.create_realm_command()

		// When
		tc.marshal_and_unmarshal_create_realm()

		// Then
		tc.create_realm_fields_match()
		tc.realm_cmd_json_has_key("name")
	})
}

func TestSuspendRealmCommand(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newRealmCmdTestContext(t)

		// Given
		tc.suspend_realm_command()

		// When
		tc.marshal_and_unmarshal_suspend_realm()

		// Then
		tc.suspend_realm_fields_match()
		tc.realm_cmd_json_has_key("realm_id")
		tc.realm_cmd_json_has_key("reason")
	})
}

// --- Test Context ---

type realmCmdTestContext struct {
	t *testing.T

	createRealm  CreateRealm
	suspendRealm SuspendRealm

	jsonBytes []byte
	jsonMap   map[string]any

	roundTrippedCreateRealm  CreateRealm
	roundTrippedSuspendRealm SuspendRealm
}

func newRealmCmdTestContext(t *testing.T) *realmCmdTestContext {
	t.Helper()
	return &realmCmdTestContext{t: t}
}

// --- Given ---

func (tc *realmCmdTestContext) create_realm_command() {
	tc.t.Helper()
	tc.createRealm = CreateRealm{
		Name: "My Realm",
	}
}

func (tc *realmCmdTestContext) suspend_realm_command() {
	tc.t.Helper()
	tc.suspendRealm = SuspendRealm{
		RealmID: "bf-a1b2",
		Reason:  "policy violation",
	}
}

// --- When ---

func (tc *realmCmdTestContext) marshal_and_unmarshal_create_realm() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.createRealm)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedCreateRealm))
}

func (tc *realmCmdTestContext) marshal_and_unmarshal_suspend_realm() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.suspendRealm)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedSuspendRealm))
}

// --- Then ---

func (tc *realmCmdTestContext) create_realm_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.createRealm, tc.roundTrippedCreateRealm)
}

func (tc *realmCmdTestContext) suspend_realm_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.suspendRealm, tc.roundTrippedSuspendRealm)
}

func (tc *realmCmdTestContext) realm_cmd_json_has_key(key string) {
	tc.t.Helper()
	_, exists := tc.jsonMap[key]
	assert.True(tc.t, exists, "expected JSON to contain key %q", key)
}
