package projectors

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

type RuneChildCountProjector struct{}

func NewRuneChildCountProjector() *RuneChildCountProjector {
	return &RuneChildCountProjector{}
}

func (p *RuneChildCountProjector) Name() string {
	return "RuneChildCount"
}

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

	var count int
	err := store.Get(ctx, event.RealmID, "RuneChildCount", data.ParentID, &count)
	if err != nil {
		var nfe *core.NotFoundError
		if !errors.As(err, &nfe) {
			return err
		}
		count = 0
	}

	count++
	return store.Put(ctx, event.RealmID, "RuneChildCount", data.ParentID, count)
}
