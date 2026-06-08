package projectors

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

// RuneChildCountEntry is the projection document for a parent rune's child count.
type RuneChildCountEntry struct {
	ParentRuneID string `json:"parent_rune_id"`
	Count        int    `json:"count"`
}

// RuneChildCountTable is the typed table reference for this projector.
var RuneChildCountTable = core.TableRef[RuneChildCountEntry]{Name: "rune_child_count"}

// RuneChildCountProjector projects child count for runes.
type RuneChildCountProjector struct{}

// NewRuneChildCountProjector creates a new RuneChildCountProjector.
func NewRuneChildCountProjector() *RuneChildCountProjector {
	return &RuneChildCountProjector{}
}

// Name returns the projector name.
func (p *RuneChildCountProjector) Name() string {
	return RuneChildCountTable.Name
}

// TableName returns the projection table name.
func (p *RuneChildCountProjector) TableName() string {
	return RuneChildCountTable.Name
}

// Handle processes events and updates the projection.
func (p *RuneChildCountProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	if event.EventType != domain.EventRuneCreated {
		return nil
	}

	var data domain.RuneCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	if data.ParentID == "" {
		return nil
	}

	// Extract sequence number from child ID (e.g., "parent.3" -> 3)
	sequenceNum := extractSequenceNumber(data.ID)

	// Get current entry
	entry, err := core.GetRef(ctx, store, event.RealmID, RuneChildCountTable, data.ParentID)
	if err != nil {
		var nfe *core.NotFoundError
		if !errors.As(err, &nfe) {
			return err
		}
		entry = RuneChildCountEntry{
			ParentRuneID: data.ParentID,
			Count:        0,
		}
	}

	// Idempotency: only increment if count < sequence number
	if entry.Count < sequenceNum {
		entry.Count = sequenceNum
		return core.PutRef(ctx, store, event.RealmID, RuneChildCountTable, data.ParentID, entry)
	}

	// Already processed this or a later sequence, no-op
	return nil
}

// extractSequenceNumber extracts the sequence number from a rune ID.
// e.g., "bf-a1b2.3" -> 3, "bf-a1b2" -> 0
func extractSequenceNumber(id string) int {
	lastDot := strings.LastIndex(id, ".")
	if lastDot == -1 {
		return 0
	}
	num, err := strconv.Atoi(id[lastDot+1:])
	if err != nil {
		return 0
	}
	return num
}
