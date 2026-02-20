package domain

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/devzeebo/bifrost/core"
)

const runeStreamPrefix = "rune-"

type RuneState struct {
	ID          string
	Title       string
	Description string
	Status      string
	Claimant    string
	ParentID    string
	Branch      string
	Priority    int
	Exists      bool
}

func RebuildRuneState(events []core.Event) RuneState {
	var state RuneState
	for _, evt := range events {
		switch evt.EventType {
		case EventRuneCreated:
			var data RuneCreated
			_ = json.Unmarshal(evt.Data, &data)
			state.Exists = true
			state.ID = data.ID
			state.Title = data.Title
			state.Description = data.Description
			state.Priority = data.Priority
			state.ParentID = data.ParentID
			state.Branch = data.Branch
			state.Status = "draft"
		case EventRuneUpdated:
			var data RuneUpdated
			_ = json.Unmarshal(evt.Data, &data)
			if data.Title != nil {
				state.Title = *data.Title
			}
			if data.Description != nil {
				state.Description = *data.Description
			}
			if data.Priority != nil {
				state.Priority = *data.Priority
			}
			if data.Branch != nil {
				state.Branch = *data.Branch
			}
		case EventRuneClaimed:
			var data RuneClaimed
			_ = json.Unmarshal(evt.Data, &data)
			state.Status = "claimed"
			state.Claimant = data.Claimant
		case EventRuneUnclaimed:
			state.Status = "open"
			state.Claimant = ""
		case EventRuneFulfilled:
			state.Status = "fulfilled"
		case EventRuneForged:
			state.Status = "open"
		case EventRuneSealed:
			state.Status = "sealed"
		case EventRuneShattered:
			state.Status = "shattered"
		}
	}
	return state
}

func runeStreamID(runeID string) string {
	return runeStreamPrefix + runeID
}

func generateRuneID() (string, error) {
	b := make([]byte, 2)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate rune ID: %w", err)
	}
	return "bf-" + hex.EncodeToString(b), nil
}

func readAndRebuild(ctx context.Context, realmID string, runeID string, store core.EventStore) (RuneState, []core.Event, error) {
	streamID := runeStreamID(runeID)
	events, err := store.ReadStream(ctx, realmID, streamID, 0)
	if err != nil {
		return RuneState{}, nil, err
	}
	state := RebuildRuneState(events)
	return state, events, nil
}

func HandleCreateRune(ctx context.Context, realmID string, cmd CreateRune, store core.EventStore, projStore core.ProjectionStore) (RuneCreated, error) {
	var runeID string

	var branch string

	if cmd.ParentID != "" {
		parentState, _, err := readAndRebuild(ctx, realmID, cmd.ParentID, store)
		if err != nil {
			return RuneCreated{}, err
		}
		if !parentState.Exists {
			return RuneCreated{}, &core.NotFoundError{Entity: "rune", ID: cmd.ParentID}
		}
		if parentState.Status == "sealed" {
			return RuneCreated{}, fmt.Errorf("cannot create child of sealed rune %q", cmd.ParentID)
		}
		if parentState.Status == "shattered" {
			return RuneCreated{}, fmt.Errorf("cannot create child of shattered rune %q", cmd.ParentID)
		}

		if cmd.Branch != nil {
			branch = *cmd.Branch
		} else {
			branch = parentState.Branch
		}

		var childCount int
		err = projStore.Get(ctx, realmID, "RuneChildCount", cmd.ParentID, &childCount)
		if err != nil {
			if !isNotFoundError(err) {
				return RuneCreated{}, err
			}
			childCount = 0
		}
		runeID = fmt.Sprintf("%s.%d", cmd.ParentID, childCount+1)
	} else {
		if cmd.Branch == nil {
			return RuneCreated{}, fmt.Errorf("branch is required for top-level runes")
		}
		branch = *cmd.Branch

		var err error
		runeID, err = generateRuneID()
		if err != nil {
			return RuneCreated{}, err
		}
	}

	created := RuneCreated{
		ID:          runeID,
		Title:       cmd.Title,
		Description: cmd.Description,
		Priority:    cmd.Priority,
		ParentID:    cmd.ParentID,
		Branch:      branch,
	}

	streamID := runeStreamID(runeID)
	_, err := store.Append(ctx, realmID, streamID, 0, []core.EventData{
		{EventType: EventRuneCreated, Data: created},
	})
	if err != nil {
		return RuneCreated{}, err
	}

	return created, nil
}

func HandleUpdateRune(ctx context.Context, realmID string, cmd UpdateRune, store core.EventStore) error {
	state, events, err := readAndRebuild(ctx, realmID, cmd.ID, store)
	if err != nil {
		return err
	}
	if !state.Exists {
		return &core.NotFoundError{Entity: "rune", ID: cmd.ID}
	}
	if state.Status == "sealed" {
		return fmt.Errorf("cannot update sealed rune %q", cmd.ID)
	}
	if state.Status == "shattered" {
		return fmt.Errorf("cannot update shattered rune %q", cmd.ID)
	}

	updated := RuneUpdated(cmd)

	streamID := runeStreamID(cmd.ID)
	_, err = store.Append(ctx, realmID, streamID, len(events), []core.EventData{
		{EventType: EventRuneUpdated, Data: updated},
	})
	return err
}

func HandleClaimRune(ctx context.Context, realmID string, cmd ClaimRune, store core.EventStore) error {
	state, events, err := readAndRebuild(ctx, realmID, cmd.ID, store)
	if err != nil {
		return err
	}
	if !state.Exists {
		return &core.NotFoundError{Entity: "rune", ID: cmd.ID}
	}
	if state.Status == "draft" {
		return fmt.Errorf("cannot claim draft rune %q", cmd.ID)
	}
	if state.Status == "sealed" {
		return fmt.Errorf("cannot claim sealed rune %q", cmd.ID)
	}
	if state.Status == "shattered" {
		return fmt.Errorf("cannot claim shattered rune %q", cmd.ID)
	}
	if state.Status == "claimed" {
		return fmt.Errorf("rune %q is already claimed by %q", cmd.ID, state.Claimant)
	}
	if state.Status == "fulfilled" {
		return fmt.Errorf("cannot claim fulfilled rune %q", cmd.ID)
	}

	claimed := RuneClaimed(cmd)

	streamID := runeStreamID(cmd.ID)
	_, err = store.Append(ctx, realmID, streamID, len(events), []core.EventData{
		{EventType: EventRuneClaimed, Data: claimed},
	})
	return err
}

func HandleUnclaimRune(ctx context.Context, realmID string, cmd UnclaimRune, store core.EventStore) error {
	state, events, err := readAndRebuild(ctx, realmID, cmd.ID, store)
	if err != nil {
		return err
	}
	if !state.Exists {
		return &core.NotFoundError{Entity: "rune", ID: cmd.ID}
	}
	if state.Status == "sealed" {
		return fmt.Errorf("cannot unclaim sealed rune %q", cmd.ID)
	}
	if state.Status == "fulfilled" {
		return fmt.Errorf("cannot unclaim fulfilled rune %q", cmd.ID)
	}
	if state.Status != "claimed" {
		return fmt.Errorf("cannot unclaim rune %q: not claimed", cmd.ID)
	}

	unclaimed := RuneUnclaimed(cmd)

	streamID := runeStreamID(cmd.ID)
	_, err = store.Append(ctx, realmID, streamID, len(events), []core.EventData{
		{EventType: EventRuneUnclaimed, Data: unclaimed},
	})
	return err
}

func HandleForgeRune(ctx context.Context, realmID string, cmd ForgeRune, store core.EventStore, projStore core.ProjectionStore) error {
	state, events, err := readAndRebuild(ctx, realmID, cmd.ID, store)
	if err != nil {
		return err
	}
	if !state.Exists {
		return &core.NotFoundError{Entity: "rune", ID: cmd.ID}
	}
	// Shattered runes are tombstones - skip them silently (no-op).
	// This allows recursive forging of sagas to succeed even when
	// some children have been shattered.
	if state.Status == "shattered" || state.Status != "draft" {
		return nil
	}

	forged := RuneForged(cmd)
	streamID := runeStreamID(cmd.ID)
	_, err = store.Append(ctx, realmID, streamID, len(events), []core.EventData{
		{EventType: EventRuneForged, Data: forged},
	})
	if err != nil {
		return err
	}

	var childCount int
	err = projStore.Get(ctx, realmID, "RuneChildCount", cmd.ID, &childCount)
	if err != nil {
		if !isNotFoundError(err) {
			return err
		}
		childCount = 0
	}
	for i := 1; i <= childCount; i++ {
		childID := fmt.Sprintf("%s.%d", cmd.ID, i)
		if err := HandleForgeRune(ctx, realmID, ForgeRune{ID: childID}, store, projStore); err != nil {
			return err
		}
	}

	return nil
}

func HandleFulfillRune(ctx context.Context, realmID string, cmd FulfillRune, store core.EventStore) error {
	state, events, err := readAndRebuild(ctx, realmID, cmd.ID, store)
	if err != nil {
		return err
	}
	if !state.Exists {
		return &core.NotFoundError{Entity: "rune", ID: cmd.ID}
	}
	if state.Status == "sealed" {
		return fmt.Errorf("cannot fulfill sealed rune %q", cmd.ID)
	}
	if state.Status == "shattered" {
		return fmt.Errorf("cannot fulfill shattered rune %q", cmd.ID)
	}
	if state.Status == "fulfilled" {
		return fmt.Errorf("rune %q is already fulfilled", cmd.ID)
	}
	if state.Status != "claimed" {
		return fmt.Errorf("cannot fulfill rune %q: not claimed", cmd.ID)
	}

	fulfilled := RuneFulfilled(cmd)

	streamID := runeStreamID(cmd.ID)
	_, err = store.Append(ctx, realmID, streamID, len(events), []core.EventData{
		{EventType: EventRuneFulfilled, Data: fulfilled},
	})
	return err
}

func HandleSealRune(ctx context.Context, realmID string, cmd SealRune, store core.EventStore) error {
	state, events, err := readAndRebuild(ctx, realmID, cmd.ID, store)
	if err != nil {
		return err
	}
	if !state.Exists {
		return &core.NotFoundError{Entity: "rune", ID: cmd.ID}
	}
	if state.Status == "sealed" {
		return fmt.Errorf("rune %q is already sealed", cmd.ID)
	}
	if state.Status == "shattered" {
		return fmt.Errorf("cannot seal shattered rune %q", cmd.ID)
	}

	sealed := RuneSealed(cmd)

	streamID := runeStreamID(cmd.ID)
	_, err = store.Append(ctx, realmID, streamID, len(events), []core.EventData{
		{EventType: EventRuneSealed, Data: sealed},
	})
	return err
}

func HandleAddDependency(ctx context.Context, realmID string, cmd AddDependency, store core.EventStore, projStore core.ProjectionStore) error {
	if !isKnownRelationship(cmd.Relationship) {
		return fmt.Errorf("unknown relationship type %q", cmd.Relationship)
	}

	if IsInverseRelationship(cmd.Relationship) {
		cmd.RuneID, cmd.TargetID = cmd.TargetID, cmd.RuneID
		cmd.Relationship = ReflectRelationship(cmd.Relationship)
	}

	sourceState, sourceEvents, err := readAndRebuild(ctx, realmID, cmd.RuneID, store)
	if err != nil {
		return err
	}
	if !sourceState.Exists {
		return &core.NotFoundError{Entity: "rune", ID: cmd.RuneID}
	}
	if sourceState.Status == "shattered" {
		return fmt.Errorf("cannot add dependency: rune %q is shattered", cmd.RuneID)
	}

	targetState, targetEvents, err := readAndRebuild(ctx, realmID, cmd.TargetID, store)
	if err != nil {
		return err
	}
	if !targetState.Exists {
		return &core.NotFoundError{Entity: "rune", ID: cmd.TargetID}
	}
	if targetState.Status == "shattered" {
		return fmt.Errorf("cannot add dependency: rune %q is shattered", cmd.TargetID)
	}

	if cmd.Relationship == RelBlocks {
		var hasCycle bool
		cycleKey := "cycle:" + cmd.RuneID + ":" + cmd.TargetID
		err := projStore.Get(ctx, realmID, "dependency_graph", cycleKey, &hasCycle)
		if err == nil && hasCycle {
			return fmt.Errorf("adding blocks dependency from %q to %q would create a cycle", cmd.RuneID, cmd.TargetID)
		}
	}

	inverseExpectedVersion := len(targetEvents)

	if cmd.Relationship == RelSupersedes {
		sealed := RuneSealed{
			ID:     cmd.TargetID,
			Reason: fmt.Sprintf("superseded by %s", cmd.RuneID),
		}
		targetStreamID := runeStreamID(cmd.TargetID)
		_, err := store.Append(ctx, realmID, targetStreamID, len(targetEvents), []core.EventData{
			{EventType: EventRuneSealed, Data: sealed},
		})
		if err != nil {
			return err
		}
		inverseExpectedVersion = len(targetEvents) + 1
	}

	depAdded := DependencyAdded{
		RuneID:       cmd.RuneID,
		TargetID:     cmd.TargetID,
		Relationship: cmd.Relationship,
	}

	sourceStreamID := runeStreamID(cmd.RuneID)
	_, err = store.Append(ctx, realmID, sourceStreamID, len(sourceEvents), []core.EventData{
		{EventType: EventDependencyAdded, Data: depAdded},
	})
	if err != nil {
		return err
	}

	inverseDepAdded := DependencyAdded{
		RuneID:       cmd.TargetID,
		TargetID:     cmd.RuneID,
		Relationship: ReflectRelationship(cmd.Relationship),
		IsInverse:    true,
	}

	targetStreamID := runeStreamID(cmd.TargetID)
	_, err = store.Append(ctx, realmID, targetStreamID, inverseExpectedVersion, []core.EventData{
		{EventType: EventDependencyAdded, Data: inverseDepAdded},
	})
	return err
}

func HandleRemoveDependency(ctx context.Context, realmID string, cmd RemoveDependency, store core.EventStore, projStore core.ProjectionStore) error {
	if IsInverseRelationship(cmd.Relationship) {
		cmd.RuneID, cmd.TargetID = cmd.TargetID, cmd.RuneID
		cmd.Relationship = ReflectRelationship(cmd.Relationship)
	}

	state, events, err := readAndRebuild(ctx, realmID, cmd.RuneID, store)
	if err != nil {
		return err
	}
	if !state.Exists {
		return &core.NotFoundError{Entity: "rune", ID: cmd.RuneID}
	}
	if state.Status == "shattered" {
		return fmt.Errorf("cannot remove dependency: rune %q is shattered", cmd.RuneID)
	}

	_, targetEvents, err := readAndRebuild(ctx, realmID, cmd.TargetID, store)
	if err != nil {
		return err
	}

	depKey := "dep:" + cmd.RuneID + ":" + cmd.TargetID + ":" + cmd.Relationship
	var exists bool
	err = projStore.Get(ctx, realmID, "dependency_graph", depKey, &exists)
	if err != nil {
		if isNotFoundError(err) {
			return &core.NotFoundError{Entity: "dependency", ID: cmd.RuneID}
		}
		return err
	}
	if !exists {
		return &core.NotFoundError{Entity: "dependency", ID: cmd.RuneID}
	}

	depRemoved := DependencyRemoved{
		RuneID:       cmd.RuneID,
		TargetID:     cmd.TargetID,
		Relationship: cmd.Relationship,
	}

	streamID := runeStreamID(cmd.RuneID)
	_, err = store.Append(ctx, realmID, streamID, len(events), []core.EventData{
		{EventType: EventDependencyRemoved, Data: depRemoved},
	})
	if err != nil {
		return err
	}

	inverseDepRemoved := DependencyRemoved{
		RuneID:       cmd.TargetID,
		TargetID:     cmd.RuneID,
		Relationship: ReflectRelationship(cmd.Relationship),
		IsInverse:    true,
	}

	targetStreamID := runeStreamID(cmd.TargetID)
	_, err = store.Append(ctx, realmID, targetStreamID, len(targetEvents), []core.EventData{
		{EventType: EventDependencyRemoved, Data: inverseDepRemoved},
	})
	return err
}

func HandleAddNote(ctx context.Context, realmID string, cmd AddNote, store core.EventStore) error {
	state, events, err := readAndRebuild(ctx, realmID, cmd.RuneID, store)
	if err != nil {
		return err
	}
	if !state.Exists {
		return &core.NotFoundError{Entity: "rune", ID: cmd.RuneID}
	}
	if state.Status == "shattered" {
		return fmt.Errorf("cannot add note to shattered rune %q", cmd.RuneID)
	}

	noted := RuneNoted(cmd)

	streamID := runeStreamID(cmd.RuneID)
	_, err = store.Append(ctx, realmID, streamID, len(events), []core.EventData{
		{EventType: EventRuneNoted, Data: noted},
	})
	return err
}

func HandleShatterRune(ctx context.Context, realmID string, cmd ShatterRune, store core.EventStore) error {
	state, events, err := readAndRebuild(ctx, realmID, cmd.ID, store)
	if err != nil {
		return err
	}
	if !state.Exists {
		return &core.NotFoundError{Entity: "rune", ID: cmd.ID}
	}
	if state.Status != "sealed" && state.Status != "fulfilled" {
		return fmt.Errorf("cannot shatter rune %q: must be sealed or fulfilled", cmd.ID)
	}

	shattered := RuneShattered(cmd)

	streamID := runeStreamID(cmd.ID)
	_, err = store.Append(ctx, realmID, streamID, len(events), []core.EventData{
		{EventType: EventRuneShattered, Data: shattered},
	})
	return err
}

func HandleSweepRunes(ctx context.Context, realmID string, store core.EventStore, projStore core.ProjectionStore) ([]string, error) {
	rawEntries, err := projStore.List(ctx, realmID, "rune_list")
	if err != nil {
		return nil, err
	}

	type runeEntry struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}

	var candidates []runeEntry
	for _, raw := range rawEntries {
		var entry runeEntry
		if err := json.Unmarshal(raw, &entry); err != nil {
			return nil, err
		}
		if entry.Status == "sealed" || entry.Status == "fulfilled" {
			candidates = append(candidates, entry)
		}
	}

	shattered := make([]string, 0)

	for _, candidate := range candidates {
		if hasActiveReference(ctx, realmID, candidate.ID, projStore) {
			continue
		}

		if err := HandleShatterRune(ctx, realmID, ShatterRune{ID: candidate.ID}, store); err != nil {
			return nil, err
		}
		shattered = append(shattered, candidate.ID)
	}

	return shattered, nil
}

func hasActiveReference(ctx context.Context, realmID string, runeID string, projStore core.ProjectionStore) bool {
	type graphDependent struct {
		SourceID string `json:"source_id"`
	}
	type graphEntry struct {
		Dependents []graphDependent `json:"dependents"`
	}

	var entry graphEntry
	err := projStore.Get(ctx, realmID, "dependency_graph", runeID, &entry)
	if err == nil {
		for _, dep := range entry.Dependents {
			if isActiveRuneInProjection(ctx, realmID, dep.SourceID, projStore) {
				return true
			}
		}
	}

	var childCount int
	err = projStore.Get(ctx, realmID, "RuneChildCount", runeID, &childCount)
	if err != nil {
		if isNotFoundError(err) {
			childCount = 0
		} else {
			return true
		}
	}
	for i := 1; i <= childCount; i++ {
		childID := fmt.Sprintf("%s.%d", runeID, i)
		if isActiveRuneInProjection(ctx, realmID, childID, projStore) {
			return true
		}
	}

	return false
}

func isActiveRuneInProjection(ctx context.Context, realmID string, runeID string, projStore core.ProjectionStore) bool {
	type statusEntry struct {
		Status string `json:"status"`
	}
	var s statusEntry
	err := projStore.Get(ctx, realmID, "rune_list", runeID, &s)
	if isNotFoundError(err) {
		return false
	}
	return s.Status != "sealed" && s.Status != "fulfilled"
}

func isKnownRelationship(rel string) bool {
	switch rel {
	case RelBlocks, RelRelatesTo, RelDuplicates, RelSupersedes, RelRepliesTo,
		RelBlockedBy, RelDuplicatedBy, RelSupersededBy, RelRepliedToBy:
		return true
	}
	return false
}

func isNotFoundError(err error) bool {
	var nfe *core.NotFoundError
	return errors.As(err, &nfe)
}
