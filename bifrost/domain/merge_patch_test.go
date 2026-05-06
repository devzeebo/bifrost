package domain

import (
	"encoding/json"
	"testing"
)

func TestMergePatch(t *testing.T) {
	tests := []struct {
		name     string
		target   map[string]any
		patch    map[string]any
		expected map[string]any
	}{
		{
			name:     "empty target and patch",
			target:   map[string]any{},
			patch:    map[string]any{},
			expected: map[string]any{},
		},
		{
			name:   "add new field to empty target",
			target: map[string]any{},
			patch:  map[string]any{"foo": "bar"},
			expected: map[string]any{
				"foo": "bar",
			},
		},
		{
			name: "replace existing field",
			target: map[string]any{
				"foo": "old",
			},
			patch: map[string]any{
				"foo": "new",
			},
			expected: map[string]any{
				"foo": "new",
			},
		},
		{
			name: "preserve untouched field",
			target: map[string]any{
				"foo":   "value",
				"other": "untouched",
			},
			patch: map[string]any{
				"foo": "updated",
			},
			expected: map[string]any{
				"foo":   "updated",
				"other": "untouched",
			},
		},
		{
			name: "delete field with null",
			target: map[string]any{
				"foo": "bar",
				"baz": 123,
			},
			patch: map[string]any{
				"foo": nil,
			},
			expected: map[string]any{
				"baz": 123,
			},
		},
		{
			name: "merge nested objects",
			target: map[string]any{
				"nested": map[string]any{
					"foo": "old",
					"bar": "keep",
				},
			},
			patch: map[string]any{
				"nested": map[string]any{
					"foo": "new",
					"baz": "add",
				},
			},
			expected: map[string]any{
				"nested": map[string]any{
					"foo": "new",
					"bar": "keep",
					"baz": "add",
				},
			},
		},
		{
			name: "replace nested object with primitive",
			target: map[string]any{
				"nested": map[string]any{
					"foo": "bar",
				},
			},
			patch: map[string]any{
				"nested": "replaced",
			},
			expected: map[string]any{
				"nested": "replaced",
			},
		},
		{
			name: "delete nested field with null",
			target: map[string]any{
				"nested": map[string]any{
					"foo": "bar",
					"baz": "keep",
				},
			},
			patch: map[string]any{
				"nested": map[string]any{
					"foo": nil,
				},
			},
			expected: map[string]any{
				"nested": map[string]any{
					"baz": "keep",
				},
			},
		},
		{
			name: "complex nested merge",
			target: map[string]any{
				"coverage": 50,
				"tested":   false,
				"metadata": map[string]any{
					"author": "ai",
					"version": 1,
				},
			},
			patch: map[string]any{
				"coverage": 75,
				"metadata": map[string]any{
					"version": 2,
					"updated": true,
				},
			},
			expected: map[string]any{
				"coverage": 75,
				"tested":   false,
				"metadata": map[string]any{
					"author":  "ai",
					"version": 2,
					"updated": true,
				},
			},
		},
		{
			name: "arrays are replaced not merged",
			target: map[string]any{
				"tags": []any{"a", "b"},
			},
			patch: map[string]any{
				"tags": []any{"c", "d"},
			},
			expected: map[string]any{
				"tags": []any{"c", "d"},
			},
		},
		{
			name: "add array to new field",
			target: map[string]any{
				"foo": "bar",
			},
			patch: map[string]any{
				"tags": []any{"a", "b"},
			},
			expected: map[string]any{
				"foo":  "bar",
				"tags": []any{"a", "b"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := MergePatch(tt.target, tt.patch)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !mapsEqual(result, tt.expected) {
				t.Errorf("result = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestParseAndApplyPatch(t *testing.T) {
	tests := []struct {
		name         string
		currentState json.RawMessage
		patchJSON    string
		expected     map[string]any
		wantErr      bool
	}{
		{
			name:         "empty state, simple patch",
			currentState: nil,
			patchJSON:    `{"foo": "bar"}`,
			expected: map[string]any{
				"foo": "bar",
			},
			wantErr: false,
		},
		{
			name:         "existing state, merge patch",
			currentState: json.RawMessage(`{"foo": "old", "bar": "keep"}`),
			patchJSON:    `{"foo": "new"}`,
			expected: map[string]any{
				"foo": "new",
				"bar": "keep",
			},
			wantErr: false,
		},
		{
			name:         "invalid patch JSON",
			currentState: nil,
			patchJSON:    `{invalid json}`,
			expected:     nil,
			wantErr:      true,
		},
		{
			name:         "invalid current state",
			currentState: json.RawMessage(`{invalid}`),
			patchJSON:    `{}`,
			expected:     nil,
			wantErr:      true,
		},
		{
			name:         "empty state JSON",
			currentState: json.RawMessage(`{}`),
			patchJSON:    `{"foo": "bar"}`,
			expected: map[string]any{
				"foo": "bar",
			},
			wantErr: false,
		},
		{
			name:         "null deletion",
			currentState: json.RawMessage(`{"foo": "bar", "baz": 123}`),
			patchJSON:    `{"foo": null}`,
			expected: map[string]any{
				"baz": 123,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseAndApplyPatch(tt.currentState, tt.patchJSON)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseAndApplyPatch() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && !mapsEqual(result, tt.expected) {
				t.Errorf("ParseAndApplyPatch() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestValidateStateSize(t *testing.T) {
	tests := []struct {
		name      string
		stateJSON []byte
		wantErr   bool
	}{
		{
			name:      "small state",
			stateJSON: []byte(`{"foo": "bar"}`),
			wantErr:   false,
		},
		{
			name:      "1KB state",
			stateJSON: make([]byte, 1024),
			wantErr:   false,
		},
		{
			name:      "exactly 64KB",
			stateJSON: make([]byte, 64*1024),
			wantErr:   false,
		},
		{
			name:      "exceeds 64KB",
			stateJSON: make([]byte, 64*1024+1),
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateStateSize(tt.stateJSON)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateStateSize() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func mapsEqual(a, b map[string]any) bool {
	if len(a) != len(b) {
		return false
	}
	for k, va := range a {
		vb, ok := b[k]
		if !ok {
			return false
		}
		if !jsonEqual(va, vb) {
			return false
		}
	}
	return true
}

func jsonEqual(a, b any) bool {
	aJSON, _ := json.Marshal(a)
	bJSON, _ := json.Marshal(b)
	return string(aJSON) == string(bJSON)
}
