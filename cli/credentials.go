package cli

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"go.yaml.in/yaml/v3"
)

type Credential struct {
	Token string `yaml:"token"`
}

type credentialsFile struct {
	Credentials map[string]Credential `yaml:"credentials"`
}

func configDir(homeDir string) string {
	if xdg := os.Getenv("XDG_CONFIG_HOME"); xdg != "" {
		return filepath.Join(xdg, "bifrost")
	}
	return filepath.Join(homeDir, ".config", "bifrost")
}

func normalizeURL(url string) string {
	return strings.TrimRight(url, "/")
}

func credentialsPath(homeDir string) string {
	return filepath.Join(configDir(homeDir), "credentials.yaml")
}

func LoadCredentials(homeDir string) (map[string]Credential, error) {
	path := credentialsPath(homeDir)

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]Credential{}, nil
		}
		return nil, fmt.Errorf("reading credentials file: %w", err)
	}

	var f credentialsFile
	if err := yaml.Unmarshal(data, &f); err != nil {
		return nil, fmt.Errorf("parsing credentials file: %w", err)
	}

	if f.Credentials == nil {
		return map[string]Credential{}, nil
	}

	return f.Credentials, nil
}

func SaveCredential(homeDir, url, token string) error {
	url = normalizeURL(url)
	dir := configDir(homeDir)

	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("creating credentials directory: %w", err)
	}

	creds, err := LoadCredentials(homeDir)
	if err != nil {
		return err
	}

	creds[url] = Credential{Token: token}

	f := credentialsFile{Credentials: creds}
	data, err := yaml.Marshal(&f)
	if err != nil {
		return fmt.Errorf("marshaling credentials: %w", err)
	}

	path := credentialsPath(homeDir)
	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("writing credentials file: %w", err)
	}

	return nil
}

func DeleteCredential(homeDir, url string) error {
	url = normalizeURL(url)

	creds, err := LoadCredentials(homeDir)
	if err != nil {
		return err
	}

	delete(creds, url)

	dir := configDir(homeDir)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("creating credentials directory: %w", err)
	}

	f := credentialsFile{Credentials: creds}
	data, err := yaml.Marshal(&f)
	if err != nil {
		return fmt.Errorf("marshaling credentials: %w", err)
	}

	path := credentialsPath(homeDir)
	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("writing credentials file: %w", err)
	}

	return nil
}

func GetCredential(homeDir, url string) (string, error) {
	url = normalizeURL(url)

	creds, err := LoadCredentials(homeDir)
	if err != nil {
		return "", err
	}

	cred, ok := creds[url]
	if !ok {
		return "", fmt.Errorf("no credential found for %q", url)
	}

	return cred.Token, nil
}
