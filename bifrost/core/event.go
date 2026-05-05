package core

import "time"

type Event struct {
	RealmID        string    `json:"realm_id"`
	StreamID       string    `json:"stream_id"`
	Version        int       `json:"version"`
	GlobalPosition int64     `json:"global_position"`
	EventType      string    `json:"event_type"`
	Data           []byte    `json:"data"`
	Metadata       []byte    `json:"metadata"`
	Timestamp      time.Time `json:"timestamp"`
}

type EventData struct {
	EventType string `json:"event_type"`
	Data      any    `json:"data"`
	Metadata  any    `json:"metadata"`
}
