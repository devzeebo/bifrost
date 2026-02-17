package admin

import (
	"embed"
	"html/template"
	"io/fs"
	"log"
	"net/http"
	"path"
)

//go:embed templates/*.html templates/*/*.html
var templateFS embed.FS

// TemplateData is the base data structure passed to all templates.
type TemplateData struct {
	Title   string
	Error   string
	Success string
	Account *AccountInfo
	Data    interface{}
}

// AccountInfo contains information about the authenticated user.
type AccountInfo struct {
	ID            string
	Username      string
	Roles         map[string]string
	CurrentRealm  string
	AvailableRealms []RealmInfo
}

// RealmInfo contains basic info about a realm for the switcher.
type RealmInfo struct {
	ID   string
	Name string
}

// IsAdmin returns true if the user has admin or owner role in the _admin realm.
func (a *AccountInfo) IsAdmin() bool {
	if a == nil || a.Roles == nil {
		return false
	}
	role, ok := a.Roles["_admin"]
	return ok && (role == "admin" || role == "owner")
}

// priorityLabel returns a human-readable label for priority levels.
func priorityLabel(priority int) string {
	switch priority {
	case 0:
		return "Unprioritized"
	case 1:
		return "Urgent"
	case 2:
		return "High"
	case 3:
		return "Normal"
	case 4:
		return "Low"
	default:
		return "Unknown"
	}
}

// templateFuncs returns the function map for templates.
func templateFuncs() template.FuncMap {
	return template.FuncMap{
		"priorityLabel": priorityLabel,
		"default":       templateDefault,
	}
}

// templateDefault returns the first non-empty value.
func templateDefault(val, def interface{}) interface{} {
	if val == nil || val == "" {
		return def
	}
	return val
}

// Templates manages HTML template loading and rendering.
type Templates struct {
	templates map[string]*template.Template
}

// NewTemplates loads all templates from the embedded filesystem.
func NewTemplates() (*Templates, error) {
	templates := make(map[string]*template.Template)

	// Parse base template
	baseContent, err := templateFS.ReadFile("templates/base.html")
	if err != nil {
		return nil, err
	}

	// Find all page templates
	entries, err := fs.ReadDir(templateFS, "templates")
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			// Handle subdirectories like templates/runes/, templates/realms/, etc.
			subEntries, err := fs.ReadDir(templateFS, path.Join("templates", entry.Name()))
			if err != nil {
				log.Printf("warning: failed to read template subdirectory %s: %v", entry.Name(), err)
				continue
			}
			for _, subEntry := range subEntries {
				if !subEntry.IsDir() && path.Ext(subEntry.Name()) == ".html" && subEntry.Name() != "base.html" {
					tmplName := entry.Name() + "/" + subEntry.Name()
					if err := parseTemplate(templates, string(baseContent), tmplName); err != nil {
						return nil, err
					}
				}
			}
		} else if path.Ext(entry.Name()) == ".html" && entry.Name() != "base.html" {
			tmplName := entry.Name()
			// login.html is standalone, not wrapped with base
			if tmplName == "login.html" {
				if err := parseStandaloneTemplate(templates, tmplName); err != nil {
					return nil, err
				}
			} else {
				if err := parseTemplate(templates, string(baseContent), tmplName); err != nil {
					return nil, err
				}
			}
		}
	}

	return &Templates{templates: templates}, nil
}

func parseTemplate(templates map[string]*template.Template, baseContent, name string) error {
	pageContent, err := templateFS.ReadFile(path.Join("templates", name))
	if err != nil {
		return err
	}

	// Combine base + page template with functions
	// The base template defines the layout, page templates define "content"
	tmpl, err := template.New(name).Funcs(templateFuncs()).Parse(string(baseContent))
	if err != nil {
		return err
	}

	// Add the content block from the page template
	_, err = tmpl.Parse(`{{define "content"}}` + string(pageContent) + `{{end}}`)
	if err != nil {
		return err
	}

	templates[name] = tmpl
	return nil
}

func parseStandaloneTemplate(templates map[string]*template.Template, name string) error {
	pageContent, err := templateFS.ReadFile(path.Join("templates", name))
	if err != nil {
		return err
	}

	tmpl, err := template.New(name).Funcs(templateFuncs()).Parse(string(pageContent))
	if err != nil {
		return err
	}

	templates[name] = tmpl
	return nil
}

// Render executes a template with the given data and writes to the response.
func (t *Templates) Render(w http.ResponseWriter, name string, data TemplateData) error {
	tmpl, ok := t.templates[name]
	if !ok {
		http.Error(w, "template not found", http.StatusInternalServerError)
		return nil
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	return tmpl.Execute(w, data)
}

// RenderLogin renders the login page (doesn't use base template).
func (t *Templates) RenderLogin(w http.ResponseWriter, data TemplateData) error {
	tmpl, ok := t.templates["login.html"]
	if !ok {
		http.Error(w, "login template not found", http.StatusInternalServerError)
		return nil
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	return tmpl.Execute(w, data)
}
