package cli

import (
	"bytes"
	"testing"
	"text/template"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestAgentsTemplate(t *testing.T) {
	t.Run("parses as a valid text/template", func(t *testing.T) {
		tc := newAgentsTemplateTestContext(t)

		// When
		tc.template_is_parsed()

		// Then
		tc.no_error_occurred()
	})

	t.Run("renders with realm name and URL", func(t *testing.T) {
		tc := newAgentsTemplateTestContext(t)

		// Given
		tc.template_data("myproject", "https://bifrost.example.com")

		// When
		tc.template_is_rendered()

		// Then
		tc.no_error_occurred()
		tc.output_contains("myproject")
		tc.output_contains("https://bifrost.example.com")
	})

	t.Run("contains Agent Instructions heading", func(t *testing.T) {
		tc := newAgentsTemplateTestContext(t)

		// Given
		tc.template_data("testrealm", "https://example.com")

		// When
		tc.template_is_rendered()

		// Then
		tc.output_contains("# Agent Instructions")
	})

	t.Run("contains quick reference with all bf commands", func(t *testing.T) {
		tc := newAgentsTemplateTestContext(t)

		// Given
		tc.template_data("testrealm", "https://example.com")

		// When
		tc.template_is_rendered()

		// Then
		tc.output_contains("bf create")
		tc.output_contains("bf list")
		tc.output_contains("bf show")
		tc.output_contains("bf claim")
		tc.output_contains("bf forge")
		tc.output_contains("bf fulfill")
		tc.output_contains("bf seal")
		tc.output_contains("bf shatter")
		tc.output_contains("bf sweep")
		tc.output_contains("bf update")
		tc.output_contains("bf note")
		tc.output_contains("bf events")
		tc.output_contains("bf ready")
	})

	t.Run("contains dependency commands", func(t *testing.T) {
		tc := newAgentsTemplateTestContext(t)

		// Given
		tc.template_data("testrealm", "https://example.com")

		// When
		tc.template_is_rendered()

		// Then
		tc.output_contains("bf dep add")
		tc.output_contains("bf dep remove")
		tc.output_contains("bf dep list")
	})

	t.Run("contains configuration section with realm instead of api_key", func(t *testing.T) {
		tc := newAgentsTemplateTestContext(t)

		// Given
		tc.template_data("testrealm", "https://example.com")

		// When
		tc.template_is_rendered()

		// Then
		tc.output_contains(".bifrost.yaml")
		tc.output_contains("realm: <realm-id>")
		tc.output_does_not_contain("BIFROST_API_KEY")
		tc.output_does_not_contain("api_key")
	})

	t.Run("contains authentication section mentioning bf login", func(t *testing.T) {
		tc := newAgentsTemplateTestContext(t)

		// Given
		tc.template_data("testrealm", "https://example.com")

		// When
		tc.template_is_rendered()

		// Then
		tc.output_contains("bf login")
		tc.output_contains("bf login --token")
	})

	t.Run("contains branch flags in create command documentation", func(t *testing.T) {
		tc := newAgentsTemplateTestContext(t)

		// Given
		tc.template_data("testrealm", "https://example.com")

		// When
		tc.template_is_rendered()

		// Then
		tc.output_contains("--branch")
		tc.output_contains("-b")
		tc.output_contains("--no-branch")
	})

	t.Run("contains glossary", func(t *testing.T) {
		tc := newAgentsTemplateTestContext(t)

		// Given
		tc.template_data("testrealm", "https://example.com")

		// When
		tc.template_is_rendered()

		// Then
		tc.output_contains("Rune")
		tc.output_contains("Saga")
		tc.output_contains("Realm")
	})
}

// --- Test Context ---

type agentsTemplateTestContext struct {
	t      *testing.T
	data   struct {
		RealmName string
		URL       string
	}
	output string
	err    error
}

func newAgentsTemplateTestContext(t *testing.T) *agentsTemplateTestContext {
	t.Helper()
	return &agentsTemplateTestContext{t: t}
}

// --- Given ---

func (tc *agentsTemplateTestContext) template_data(realmName, url string) {
	tc.t.Helper()
	tc.data.RealmName = realmName
	tc.data.URL = url
}

// --- When ---

func (tc *agentsTemplateTestContext) template_is_parsed() {
	tc.t.Helper()
	_, tc.err = template.New("agents").Parse(AgentsTemplate)
}

func (tc *agentsTemplateTestContext) template_is_rendered() {
	tc.t.Helper()
	tmpl, err := template.New("agents").Parse(AgentsTemplate)
	require.NoError(tc.t, err)

	var buf bytes.Buffer
	tc.err = tmpl.Execute(&buf, tc.data)
	tc.output = buf.String()
}

// --- Then ---

func (tc *agentsTemplateTestContext) no_error_occurred() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *agentsTemplateTestContext) output_contains(expected string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.output, expected)
}

func (tc *agentsTemplateTestContext) output_does_not_contain(unexpected string) {
	tc.t.Helper()
	assert.NotContains(tc.t, tc.output, unexpected)
}
