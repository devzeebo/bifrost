package admin

import (
	"html/template"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewTemplates(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)
	require.NotNil(t, templates)
	require.NotNil(t, templates.templates)
}

func TestTemplateLoading(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	// Check that all expected templates are loaded
	expectedTemplates := []string{
		"login.html",
		"dashboard.html",
		"runes/list.html",
		"runes/detail.html",
		"realms/list.html",
		"realms/detail.html",
		"accounts/list.html",
		"accounts/detail.html",
		"accounts/pats.html",
	}

	for _, name := range expectedTemplates {
		_, ok := templates.templates[name]
		assert.True(t, ok, "template %s should be loaded", name)
	}
}

func TestRender_TemplateNotFound(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	rec := httptest.NewRecorder()
	err = templates.Render(rec, "nonexistent.html", TemplateData{})
	assert.NoError(t, err)
	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.Contains(t, rec.Body.String(), "template not found")
}

func TestRender_BaseTemplate(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	data := TemplateData{
		Title: "Test Page",
		Account: &AccountInfo{
			Username: "testuser",
			Roles:    map[string]string{"_admin": "admin"},
		},
	}

	rec := httptest.NewRecorder()
	err = templates.Render(rec, "dashboard.html", data)
	require.NoError(t, err)

	body := rec.Body.String()

	// Check base template elements
	assert.Contains(t, body, "<title>Test Page | Bifrost Admin</title>")
	assert.Contains(t, body, `/admin/static/style.css`)
	assert.Contains(t, body, "htmx.org")
	assert.Contains(t, body, `<nav>`)
	assert.Contains(t, body, `<main>`)
	assert.Contains(t, body, `<div id="toasts">`)
}

func TestRender_RoleAwareNavigation_Admin(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	data := TemplateData{
		Title: "Test Page",
		Account: &AccountInfo{
			Username: "admin",
			Roles:    map[string]string{"_admin": "admin"},
		},
	}

	rec := httptest.NewRecorder()
	err = templates.Render(rec, "dashboard.html", data)
	require.NoError(t, err)

	body := rec.Body.String()

	// Admin should see all nav links
	assert.Contains(t, body, `href="/admin/runes"`)
	assert.Contains(t, body, `href="/admin/realms"`)
	assert.Contains(t, body, `href="/admin/accounts"`)
	assert.Contains(t, body, "admin")
}

func TestRender_RoleAwareNavigation_NonAdmin(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	data := TemplateData{
		Title: "Test Page",
		Account: &AccountInfo{
			Username: "member",
			Roles:    map[string]string{"realm-1": "member"},
		},
	}

	rec := httptest.NewRecorder()
	err = templates.Render(rec, "dashboard.html", data)
	require.NoError(t, err)

	body := rec.Body.String()

	// Non-admin should see Runes but not Realms/Accounts
	assert.Contains(t, body, `href="/admin/runes"`)
	assert.NotContains(t, body, `href="/admin/realms"`)
	assert.NotContains(t, body, `href="/admin/accounts"`)
	assert.Contains(t, body, "member")
}

func TestRender_NilAccount(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	data := TemplateData{
		Title:   "Test Page",
		Account: nil,
	}

	rec := httptest.NewRecorder()
	err = templates.Render(rec, "dashboard.html", data)
	require.NoError(t, err)

	body := rec.Body.String()

	// Should not show admin links when account is nil
	assert.NotContains(t, body, `href="/admin/realms"`)
	assert.NotContains(t, body, `href="/admin/accounts"`)
}

func TestRender_ContentBlock(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	data := TemplateData{
		Title: "Dashboard",
		Account: &AccountInfo{
			Username: "testuser",
		},
	}

	rec := httptest.NewRecorder()
	err = templates.Render(rec, "dashboard.html", data)
	require.NoError(t, err)

	body := rec.Body.String()

	// Check that dashboard content is rendered
	assert.Contains(t, body, "Dashboard")
	assert.Contains(t, body, "Welcome to the Bifrost Admin UI")
}

func TestRenderLogin(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	data := TemplateData{
		Title: "Login",
		Error: "Test error message",
	}

	rec := httptest.NewRecorder()
	err = templates.RenderLogin(rec, data)
	require.NoError(t, err)

	body := rec.Body.String()

	// Login page should NOT have base template nav
	assert.NotContains(t, body, `<nav>`)
	assert.NotContains(t, body, "nav-links")

	// But should have login form
	assert.Contains(t, body, "Bifrost Admin")
	assert.Contains(t, body, "Personal Access Token")
	assert.Contains(t, body, "Test error message")
}

func TestRenderLogin_TemplateNotFound(t *testing.T) {
	templates := &Templates{templates: make(map[string]*template.Template)}

	rec := httptest.NewRecorder()
	err := templates.RenderLogin(rec, TemplateData{})
	assert.NoError(t, err)
	assert.Equal(t, http.StatusInternalServerError, rec.Code)
}

func TestRender_ContentType(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	data := TemplateData{
		Title:   "Test",
		Account: &AccountInfo{Username: "test"},
	}

	rec := httptest.NewRecorder()
	err = templates.Render(rec, "dashboard.html", data)
	require.NoError(t, err)

	assert.Contains(t, rec.Header().Get("Content-Type"), "text/html")
	assert.Contains(t, rec.Header().Get("Content-Type"), "utf-8")
}

func TestRenderLogin_ContentType(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	rec := httptest.NewRecorder()
	err = templates.RenderLogin(rec, TemplateData{Title: "Login"})
	require.NoError(t, err)

	assert.Contains(t, rec.Header().Get("Content-Type"), "text/html")
	assert.Contains(t, rec.Header().Get("Content-Type"), "utf-8")
}

func TestAccountInfo_IsAdmin(t *testing.T) {
	tests := []struct {
		name     string
		account  *AccountInfo
		expected bool
	}{
		{
			name:     "nil account",
			account:  nil,
			expected: false,
		},
		{
			name:     "nil roles",
			account:  &AccountInfo{Username: "test"},
			expected: false,
		},
		{
			name:     "empty roles",
			account:  &AccountInfo{Username: "test", Roles: map[string]string{}},
			expected: false,
		},
		{
			name:     "member role",
			account:  &AccountInfo{Username: "test", Roles: map[string]string{"_admin": "member"}},
			expected: false,
		},
		{
			name:     "admin role",
			account:  &AccountInfo{Username: "test", Roles: map[string]string{"_admin": "admin"}},
			expected: true,
		},
		{
			name:     "admin in different realm",
			account:  &AccountInfo{Username: "test", Roles: map[string]string{"realm-1": "admin"}},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.account.IsAdmin()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRender_ErrorAndSuccess(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	// Test with error
	data := TemplateData{
		Title:   "Test",
		Error:   "Something went wrong",
		Success: "Operation completed",
		Account: &AccountInfo{Username: "test"},
	}

	rec := httptest.NewRecorder()
	err = templates.Render(rec, "dashboard.html", data)
	require.NoError(t, err)

	// The Data field should be accessible in templates
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestRender_DataField(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	data := TemplateData{
		Title: "Test",
		Account: &AccountInfo{
			Username: "test",
		},
		Data: map[string]interface{}{
			"TotalRunes":   5,
			"StatusCounts": map[string]int{"open": 2, "claimed": 1, "fulfilled": 1, "draft": 1, "sealed": 0},
			"RecentRunes":  []interface{}{},
		},
	}

	rec := httptest.NewRecorder()
	err = templates.Render(rec, "dashboard.html", data)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "Total: 5")
}

func TestTemplateInheritance(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	// Templates that inherit from base with minimal data
	simpleTemplates := []string{
		"dashboard.html",
	}

	for _, name := range simpleTemplates {
		t.Run(name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			data := TemplateData{
				Title:   "Test",
				Account: &AccountInfo{Username: "test"},
			}
			err := templates.Render(rec, name, data)
			require.NoError(t, err, "template %s should render", name)

			body := rec.Body.String()
			// Should have base template elements
			assert.Contains(t, body, "<nav>", "template %s should have nav from base", name)
			assert.Contains(t, body, `<main>`, "template %s should have main from base", name)
			assert.Contains(t, body, `<div id="toasts">`, "template %s should have toasts from base", name)
		})
	}

	// Templates that require specific data
	t.Run("runes/list.html", func(t *testing.T) {
		rec := httptest.NewRecorder()
		data := TemplateData{
			Title:   "Runes",
			Account: &AccountInfo{Username: "test"},
			Data: map[string]interface{}{
				"Runes":          []interface{}{},
				"StatusFilter":   "",
				"PriorityFilter": "",
				"AssigneeFilter": "",
				"CanTakeAction":  false,
			},
		}
		err := templates.Render(rec, "runes/list.html", data)
		require.NoError(t, err)

		body := rec.Body.String()
		assert.Contains(t, body, "<nav>")
		assert.Contains(t, body, `<main>`)
		assert.Contains(t, body, `<div id="toasts">`)
	})

	t.Run("runes/detail.html with rune", func(t *testing.T) {
		rec := httptest.NewRecorder()
		data := TemplateData{
			Title:   "Test Rune",
			Account: &AccountInfo{Username: "test"},
			Data: map[string]interface{}{
				"Rune": map[string]interface{}{
					"ID":          "bf-1234",
					"Title":       "Test Rune",
					"Status":      "open",
					"Priority":    2,
					"Description": "Test description",
					"CreatedAt":   "2024-01-01T00:00:00Z",
					"UpdatedAt":   "2024-01-01T00:00:00Z",
				},
				"CanTakeAction": true,
				"CanClaim":      true,
				"CanFulfill":    false,
				"CanSeal":       true,
				"CanAddNote":    true,
			},
		}
		err := templates.Render(rec, "runes/detail.html", data)
		require.NoError(t, err)

		body := rec.Body.String()
		assert.Contains(t, body, "<nav>")
		assert.Contains(t, body, `<main>`)
		assert.Contains(t, body, `<div id="toasts">`)
	})

	t.Run("runes/detail.html with error", func(t *testing.T) {
		rec := httptest.NewRecorder()
		data := TemplateData{
			Title:   "Rune Not Found",
			Error:   "Rune not found",
			Account: &AccountInfo{Username: "test"},
		}
		err := templates.Render(rec, "runes/detail.html", data)
		require.NoError(t, err)

		body := rec.Body.String()
		assert.Contains(t, body, "<nav>")
		assert.Contains(t, body, `<main>`)
		assert.Contains(t, body, "Rune not found")
	})

	t.Run("realms/list.html", func(t *testing.T) {
		rec := httptest.NewRecorder()
		data := TemplateData{
			Title:   "Realms",
			Account: &AccountInfo{Username: "admin", Roles: map[string]string{"_admin": "admin"}},
			Data: map[string]interface{}{
				"Realms": []interface{}{},
			},
		}
		err := templates.Render(rec, "realms/list.html", data)
		require.NoError(t, err)

		body := rec.Body.String()
		assert.Contains(t, body, "<nav>")
		assert.Contains(t, body, `<main>`)
		assert.Contains(t, body, `<div id="toasts">`)
	})

	t.Run("realms/detail.html with realm", func(t *testing.T) {
		rec := httptest.NewRecorder()
		data := TemplateData{
			Title:   "Test Realm",
			Account: &AccountInfo{Username: "admin", Roles: map[string]string{"_admin": "admin"}},
			Data: map[string]interface{}{
				"Realm": map[string]interface{}{
					"RealmID":   "realm-1",
					"Name":      "Test Realm",
					"Status":    "active",
					"CreatedAt": "2024-01-01T00:00:00Z",
				},
				"Members": []interface{}{},
			},
		}
		err := templates.Render(rec, "realms/detail.html", data)
		require.NoError(t, err)

		body := rec.Body.String()
		assert.Contains(t, body, "<nav>")
		assert.Contains(t, body, `<main>`)
		assert.Contains(t, body, "Test Realm")
	})

	t.Run("realms/detail.html with error", func(t *testing.T) {
		rec := httptest.NewRecorder()
		data := TemplateData{
			Title:   "Realm Not Found",
			Error:   "Realm not found",
			Account: &AccountInfo{Username: "admin", Roles: map[string]string{"_admin": "admin"}},
		}
		err := templates.Render(rec, "realms/detail.html", data)
		require.NoError(t, err)

		body := rec.Body.String()
		assert.Contains(t, body, "<nav>")
		assert.Contains(t, body, `<main>`)
		assert.Contains(t, body, "Realm not found")
	})
}

func TestBaseTemplate_CSSElement(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	data := TemplateData{
		Title:   "Test",
		Account: &AccountInfo{Username: "test"},
	}

	rec := httptest.NewRecorder()
	err = templates.Render(rec, "dashboard.html", data)
	require.NoError(t, err)

	body := rec.Body.String()
	assert.Contains(t, body, `<link rel="stylesheet" href="/admin/static/style.css">`)
}

func TestBaseTemplate_Htmx(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	data := TemplateData{
		Title:   "Test",
		Account: &AccountInfo{Username: "test"},
	}

	rec := httptest.NewRecorder()
	err = templates.Render(rec, "dashboard.html", data)
	require.NoError(t, err)

	body := rec.Body.String()
	assert.Contains(t, body, "htmx.org")
	assert.Contains(t, body, "<script")
}

func TestBaseTemplate_NavClasses(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	data := TemplateData{
		Title:   "Test",
		Account: &AccountInfo{Username: "test"},
	}

	rec := httptest.NewRecorder()
	err = templates.Render(rec, "dashboard.html", data)
	require.NoError(t, err)

	body := rec.Body.String()
	assert.Contains(t, body, `class="nav-brand"`)
	assert.Contains(t, body, `class="nav-links"`)
	assert.Contains(t, body, `class="nav-user"`)
}

func TestTemplate_OutputEscaping(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	// Test that user input is escaped
	data := TemplateData{
		Title:   "Test",
		Account: &AccountInfo{Username: "<script>alert('xss')</script>"},
	}

	rec := httptest.NewRecorder()
	err = templates.Render(rec, "dashboard.html", data)
	require.NoError(t, err)

	body := rec.Body.String()
	// Should NOT contain raw script tag
	assert.NotContains(t, body, "<script>alert('xss')</script>")
	// Should contain escaped version
	assert.True(t, strings.Contains(body, "&lt;script&gt;") || strings.Contains(body, "&#34;"),
		"username should be HTML-escaped")
}

func TestTemplateInheritance_Accounts(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	t.Run("accounts/list.html", func(t *testing.T) {
		rec := httptest.NewRecorder()
		data := TemplateData{
			Title:   "Accounts",
			Account: &AccountInfo{Username: "admin", Roles: map[string]string{"_admin": "admin"}},
			Data: map[string]interface{}{
				"Accounts": []interface{}{},
			},
		}
		err := templates.Render(rec, "accounts/list.html", data)
		require.NoError(t, err)

		body := rec.Body.String()
		assert.Contains(t, body, "<nav>")
		assert.Contains(t, body, `<main>`)
		assert.Contains(t, body, `<div id="toasts">`)
		assert.Contains(t, body, "Create Account")
	})

	t.Run("accounts/detail.html with account", func(t *testing.T) {
		rec := httptest.NewRecorder()
		data := TemplateData{
			Title:   "Test Account",
			Account: &AccountInfo{Username: "admin", Roles: map[string]string{"_admin": "admin"}},
			Data: map[string]interface{}{
				"Account": map[string]interface{}{
					"AccountID": "acct-1234",
					"Username":  "testuser",
					"Status":    "active",
					"Realms":    []string{},
					"Roles":     map[string]string{},
					"PATCount":  1,
					"CreatedAt": "2024-01-01T00:00:00Z",
				},
				"Realms":     []interface{}{},
				"IsSelf":     false,
				"ValidRoles": []string{"admin", "member", "viewer"},
			},
		}
		err := templates.Render(rec, "accounts/detail.html", data)
		require.NoError(t, err)

		body := rec.Body.String()
		assert.Contains(t, body, "<nav>")
		assert.Contains(t, body, `<main>`)
		assert.Contains(t, body, "testuser")
	})

	t.Run("accounts/detail.html with error", func(t *testing.T) {
		rec := httptest.NewRecorder()
		data := TemplateData{
			Title:   "Account Not Found",
			Error:   "Account not found",
			Account: &AccountInfo{Username: "admin", Roles: map[string]string{"_admin": "admin"}},
		}
		err := templates.Render(rec, "accounts/detail.html", data)
		require.NoError(t, err)

		body := rec.Body.String()
		assert.Contains(t, body, "<nav>")
		assert.Contains(t, body, `<main>`)
		assert.Contains(t, body, "Account not found")
	})

	t.Run("accounts/pats.html with account", func(t *testing.T) {
		rec := httptest.NewRecorder()
		data := TemplateData{
			Title:   "PATs for testuser",
			Account: &AccountInfo{Username: "admin", Roles: map[string]string{"_admin": "admin"}},
			Data: map[string]interface{}{
				"Account": map[string]interface{}{
					"AccountID": "acct-1234",
					"Username":  "testuser",
					"Status":    "active",
				},
				"PATs":      []interface{}{},
				"AccountID": "acct-1234",
			},
		}
		err := templates.Render(rec, "accounts/pats.html", data)
		require.NoError(t, err)

		body := rec.Body.String()
		assert.Contains(t, body, "<nav>")
		assert.Contains(t, body, `<main>`)
		assert.Contains(t, body, "Create PAT")
		assert.Contains(t, body, "testuser")
	})

	t.Run("accounts/pats.html with error", func(t *testing.T) {
		rec := httptest.NewRecorder()
		data := TemplateData{
			Title:   "Account Not Found",
			Error:   "Account not found",
			Account: &AccountInfo{Username: "admin", Roles: map[string]string{"_admin": "admin"}},
		}
		err := templates.Render(rec, "accounts/pats.html", data)
		require.NoError(t, err)

		body := rec.Body.String()
		assert.Contains(t, body, "<nav>")
		assert.Contains(t, body, `<main>`)
		assert.Contains(t, body, "Account not found")
	})
}
