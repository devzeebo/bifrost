package cli

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/spf13/cobra"
	"go.yaml.in/yaml/v3"
)

type bifrostConfig struct {
	URL   string `yaml:"url"`
	Realm string `yaml:"realm"`
}

func NewInitCmd() *cobra.Command {
	var dir string

	cmd := &cobra.Command{
		Use:   "init",
		Short: "Initialize a repository for bifrost usage",
		RunE: func(cmd *cobra.Command, args []string) error {
			url, _ := cmd.Flags().GetString("url")
			realm, _ := cmd.Flags().GetString("realm")
			force, _ := cmd.Flags().GetBool("force")

			if realm == "" {
				return fmt.Errorf("required flag \"realm\" not set")
			}

			if dir == "" {
				cwd, err := os.Getwd()
				if err != nil {
					return fmt.Errorf("could not determine working directory: %w", err)
				}
				dir = cwd
			}

			yamlPath := filepath.Join(dir, ".bifrost.yaml")
			agentsPath := filepath.Join(dir, "AGENTS.md")

			if !force {
				if _, err := os.Stat(yamlPath); err == nil {
					return fmt.Errorf(".bifrost.yaml already exists (use --force to overwrite)")
				}
			}

			cfg := bifrostConfig{
				URL:   url,
				Realm: realm,
			}

			yamlData, err := yaml.Marshal(&cfg)
			if err != nil {
				return fmt.Errorf("marshaling config: %w", err)
			}

			if err := os.WriteFile(yamlPath, yamlData, 0644); err != nil {
				return fmt.Errorf("writing .bifrost.yaml: %w", err)
			}

			tmpl, err := template.New("agents").Parse(AgentsTemplate)
			if err != nil {
				return fmt.Errorf("parsing AGENTS.md template: %w", err)
			}

			agentsFile, err := os.Create(agentsPath)
			if err != nil {
				return fmt.Errorf("creating AGENTS.md: %w", err)
			}
			defer agentsFile.Close()

			data := struct {
				RealmName string
				URL       string
			}{
				RealmName: realm,
				URL:       url,
			}

			if err := tmpl.Execute(agentsFile, data); err != nil {
				return fmt.Errorf("rendering AGENTS.md: %w", err)
			}

			gitignorePath := filepath.Join(dir, ".gitignore")
			if _, err := os.Stat(gitignorePath); err == nil {
				content, err := os.ReadFile(gitignorePath)
				if err != nil {
					return fmt.Errorf("reading .gitignore: %w", err)
				}

				if !strings.Contains(string(content), ".bifrost.yaml") {
					entry := ".bifrost.yaml\n"
					if len(content) > 0 && !strings.HasSuffix(string(content), "\n") {
						entry = "\n" + entry
					}
					if err := os.WriteFile(gitignorePath, append(content, []byte(entry)...), 0644); err != nil {
						return fmt.Errorf("updating .gitignore: %w", err)
					}
				}
			}

			fmt.Fprintln(cmd.OutOrStdout(), "Initialized bifrost in", dir)
			fmt.Fprintln(cmd.OutOrStdout(), "Run bf login --token <your-pat> to authenticate")
			return nil
		},
	}

	cmd.Flags().String("url", "http://localhost:8080", "Bifrost server URL")
	cmd.Flags().String("realm", "", "Realm name")
	cmd.Flags().Bool("force", false, "Overwrite existing files")
	cmd.Flags().StringVar(&dir, "dir", "", "Target directory (defaults to cwd)")

	return cmd
}
