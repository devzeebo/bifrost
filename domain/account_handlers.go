package domain

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/devzeebo/bifrost/core"
)

const (
	accountStreamPrefix = "account-"
)

type AccountState struct {
	AccountID string
	Username  string
	Status    string
	Exists    bool
	Realms    map[string]string
	PATs      map[string]PATState
}

type PATState struct {
	PATID   string
	KeyHash string
	Label   string
	Revoked bool
}

func RebuildAccountState(events []core.Event) AccountState {
	var state AccountState
	state.Realms = make(map[string]string)
	state.PATs = make(map[string]PATState)

	for _, evt := range events {
		switch evt.EventType {
		case EventAccountCreated:
			var data AccountCreated
			_ = json.Unmarshal(evt.Data, &data)
			state.Exists = true
			state.AccountID = data.AccountID
			state.Username = data.Username
			state.Status = "active"
		case EventAccountSuspended:
			state.Status = "suspended"
		case EventRealmGranted:
			var data RealmGranted
			_ = json.Unmarshal(evt.Data, &data)
			state.Realms[data.RealmID] = RoleMember
		case EventRealmRevoked:
			var data RealmRevoked
			_ = json.Unmarshal(evt.Data, &data)
			delete(state.Realms, data.RealmID)
		case EventRoleAssigned:
			var data RoleAssigned
			_ = json.Unmarshal(evt.Data, &data)
			state.Realms[data.RealmID] = data.Role
		case EventRoleRevoked:
			var data RoleRevoked
			_ = json.Unmarshal(evt.Data, &data)
			delete(state.Realms, data.RealmID)
		case EventPATCreated:
			var data PATCreated
			_ = json.Unmarshal(evt.Data, &data)
			state.PATs[data.PATID] = PATState{
				PATID:   data.PATID,
				KeyHash: data.KeyHash,
				Label:   data.Label,
				Revoked: false,
			}
		case EventPATRevoked:
			var data PATRevoked
			_ = json.Unmarshal(evt.Data, &data)
			if pat, ok := state.PATs[data.PATID]; ok {
				pat.Revoked = true
				state.PATs[data.PATID] = pat
			}
		}
	}
	return state
}

func accountStreamID(accountID string) string {
	return accountStreamPrefix + accountID
}

func generateAccountID() (string, error) {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate account ID: %w", err)
	}
	return "acct-" + hex.EncodeToString(b), nil
}

func generatePATID() (string, error) {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate PAT ID: %w", err)
	}
	return "pat-" + hex.EncodeToString(b), nil
}

func generateToken() (raw string, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", fmt.Errorf("generate token: %w", err)
	}
	raw = base64.RawURLEncoding.EncodeToString(b)
	h := sha256.Sum256(b)
	hash = base64.RawURLEncoding.EncodeToString(h[:])
	return raw, hash, nil
}

func readAndRebuildAccountState(ctx context.Context, accountID string, store core.EventStore) (AccountState, []core.Event, error) {
	streamID := accountStreamID(accountID)
	events, err := store.ReadStream(ctx, AdminRealmID, streamID, 0)
	if err != nil {
		return AccountState{}, nil, err
	}
	state := RebuildAccountState(events)
	return state, events, nil
}

func requireActiveAccount(state AccountState, accountID string) error {
	if !state.Exists {
		return &core.NotFoundError{Entity: "account", ID: accountID}
	}
	if state.Status == "suspended" {
		return fmt.Errorf("account %q is suspended", accountID)
	}
	return nil
}

func HandleCreateAccount(ctx context.Context, cmd CreateAccount, store core.EventStore, projectionStore core.ProjectionStore) (CreateAccountResult, error) {
	// Check username uniqueness via projection
	var existingAccountID string
	err := projectionStore.Get(ctx, AdminRealmID, "account_lookup", "username:"+cmd.Username, &existingAccountID)
	if err == nil {
		return CreateAccountResult{}, fmt.Errorf("username %q already exists", cmd.Username)
	}
	var nfe *core.NotFoundError
	if !errors.As(err, &nfe) {
		return CreateAccountResult{}, err
	}

	accountID, err := generateAccountID()
	if err != nil {
		return CreateAccountResult{}, err
	}

	rawToken, keyHash, err := generateToken()
	if err != nil {
		return CreateAccountResult{}, err
	}

	patID, err := generatePATID()
	if err != nil {
		return CreateAccountResult{}, err
	}

	created := AccountCreated{
		AccountID: accountID,
		Username:  cmd.Username,
		CreatedAt: time.Now().UTC(),
	}

	patCreated := PATCreated{
		AccountID: accountID,
		PATID:     patID,
		KeyHash:   keyHash,
		Label:     "initial",
		CreatedAt: time.Now().UTC(),
	}

	streamID := accountStreamID(accountID)
	_, err = store.Append(ctx, AdminRealmID, streamID, 0, []core.EventData{
		{EventType: EventAccountCreated, Data: created},
		{EventType: EventPATCreated, Data: patCreated},
	})
	if err != nil {
		return CreateAccountResult{}, err
	}

	return CreateAccountResult{
		AccountID: accountID,
		RawToken:  rawToken,
	}, nil
}

func HandleSuspendAccount(ctx context.Context, cmd SuspendAccount, store core.EventStore) error {
	state, events, err := readAndRebuildAccountState(ctx, cmd.AccountID, store)
	if err != nil {
		return err
	}
	if err := requireActiveAccount(state, cmd.AccountID); err != nil {
		return err
	}

	suspended := AccountSuspended(cmd)

	streamID := accountStreamID(cmd.AccountID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventAccountSuspended, Data: suspended},
	})
	return err
}

func HandleGrantRealm(ctx context.Context, cmd GrantRealm, store core.EventStore) error {
	state, events, err := readAndRebuildAccountState(ctx, cmd.AccountID, store)
	if err != nil {
		return err
	}
	if err := requireActiveAccount(state, cmd.AccountID); err != nil {
		return err
	}

	// Idempotent: if already granted, return nil
	if _, ok := state.Realms[cmd.RealmID]; ok {
		return nil
	}

	assigned := RoleAssigned{AccountID: cmd.AccountID, RealmID: cmd.RealmID, Role: RoleMember}

	streamID := accountStreamID(cmd.AccountID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventRoleAssigned, Data: assigned},
	})
	return err
}

func HandleRevokeRealm(ctx context.Context, cmd RevokeRealm, store core.EventStore) error {
	state, events, err := readAndRebuildAccountState(ctx, cmd.AccountID, store)
	if err != nil {
		return err
	}
	if err := requireActiveAccount(state, cmd.AccountID); err != nil {
		return err
	}

	if _, ok := state.Realms[cmd.RealmID]; !ok {
		return fmt.Errorf("realm %q is not granted to account %q", cmd.RealmID, cmd.AccountID)
	}

	revoked := RoleRevoked(cmd)

	streamID := accountStreamID(cmd.AccountID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventRoleRevoked, Data: revoked},
	})
	return err
}

func HandleAssignRole(ctx context.Context, cmd AssignRole, store core.EventStore) error {
	if !IsValidRole(cmd.Role) {
		return fmt.Errorf("invalid role %q", cmd.Role)
	}

	state, events, err := readAndRebuildAccountState(ctx, cmd.AccountID, store)
	if err != nil {
		return err
	}
	if err := requireActiveAccount(state, cmd.AccountID); err != nil {
		return err
	}

	// Idempotent: if same role already assigned, return nil
	if state.Realms[cmd.RealmID] == cmd.Role {
		return nil
	}

	assigned := RoleAssigned(cmd)

	streamID := accountStreamID(cmd.AccountID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventRoleAssigned, Data: assigned},
	})
	return err
}

func HandleRevokeRole(ctx context.Context, cmd RevokeRole, store core.EventStore) error {
	state, events, err := readAndRebuildAccountState(ctx, cmd.AccountID, store)
	if err != nil {
		return err
	}
	if err := requireActiveAccount(state, cmd.AccountID); err != nil {
		return err
	}

	if _, ok := state.Realms[cmd.RealmID]; !ok {
		return fmt.Errorf("realm %q is not granted to account %q", cmd.RealmID, cmd.AccountID)
	}

	revoked := RoleRevoked(cmd)

	streamID := accountStreamID(cmd.AccountID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventRoleRevoked, Data: revoked},
	})
	return err
}

func HandleCreatePAT(ctx context.Context, cmd CreatePAT, store core.EventStore) (CreatePATResult, error) {
	state, events, err := readAndRebuildAccountState(ctx, cmd.AccountID, store)
	if err != nil {
		return CreatePATResult{}, err
	}
	if err := requireActiveAccount(state, cmd.AccountID); err != nil {
		return CreatePATResult{}, err
	}

	rawToken, keyHash, err := generateToken()
	if err != nil {
		return CreatePATResult{}, err
	}

	patID, err := generatePATID()
	if err != nil {
		return CreatePATResult{}, err
	}

	patCreated := PATCreated{
		AccountID: cmd.AccountID,
		PATID:     patID,
		KeyHash:   keyHash,
		Label:     cmd.Label,
		CreatedAt: time.Now().UTC(),
	}

	streamID := accountStreamID(cmd.AccountID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventPATCreated, Data: patCreated},
	})
	if err != nil {
		return CreatePATResult{}, err
	}

	return CreatePATResult{
		PATID:    patID,
		RawToken: rawToken,
	}, nil
}

func HandleRevokePAT(ctx context.Context, cmd RevokePAT, store core.EventStore) error {
	state, events, err := readAndRebuildAccountState(ctx, cmd.AccountID, store)
	if err != nil {
		return err
	}
	if err := requireActiveAccount(state, cmd.AccountID); err != nil {
		return err
	}

	pat, ok := state.PATs[cmd.PATID]
	if !ok {
		return fmt.Errorf("PAT %q not found on account %q", cmd.PATID, cmd.AccountID)
	}
	if pat.Revoked {
		return fmt.Errorf("PAT %q is already revoked", cmd.PATID)
	}

	revoked := PATRevoked(cmd)

	streamID := accountStreamID(cmd.AccountID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventPATRevoked, Data: revoked},
	})
	return err
}
