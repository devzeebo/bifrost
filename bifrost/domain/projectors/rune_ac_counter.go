package projectors

import (
	"context"
	"encoding/json"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

type ACCounter struct {
	Count int `json:"count"`
}

// RuneACCounterTable is the typed table reference for this projector.
var RuneACCounterTable = core.TableRef[ACCounter]{Name: "rune_ac_counter"}

type RuneACCounterProjector struct{}

func NewRuneACCounterProjector() *RuneACCounterProjector {
	return &RuneACCounterProjector{}
}

func (p *RuneACCounterProjector) Name() string {
	return RuneACCounterTable.Name
}

func (p *RuneACCounterProjector) TableName() string {
	return RuneACCounterTable.Name
}

func (p *RuneACCounterProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventRuneACAdded:
		return p.handleACAdded(ctx, event, store)
	}
	return nil
}

func (p *RuneACCounterProjector) handleACAdded(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneACAdded
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Get or create counter for this rune
	counter, _ := core.GetRef(ctx, store, event.RealmID, RuneACCounterTable, data.RuneID)

	// Note: ID parsing is done in handlers.go, here we just increment the counter
	// The counter represents the highest AC number ever issued for this rune
	counter.Count++

	return core.PutRef(ctx, store, event.RealmID, RuneACCounterTable, data.RuneID, counter)
}
