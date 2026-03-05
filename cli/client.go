package cli

import (
	"bytes"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Client struct {
	baseURL    string
	apiKey     string
	realm      string
	httpClient *http.Client
}

func NewClient(cfg *Config) *Client {
	return &Client{
		baseURL: cfg.URL,
		apiKey:  cfg.APIKey,
		realm:   cfg.Realm,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) DoRequest(method, path string, body []byte) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}

	// All API paths must be prefixed with /api
	apiPath := path
	if len(path) > 0 && path[0] == '/' && !strings.HasPrefix(path, "/api") {
		apiPath = "/api" + path
	}
	fullURL := c.baseURL + apiPath
	debugLog("--> %s %s", method, fullURL)
	if body != nil {
		debugLog("    body: %s", string(body))
	}

	req, err := http.NewRequest(method, fullURL, bodyReader)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("X-Bifrost-Realm", c.realm)
	if method == http.MethodPost {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		debugLog("<-- error: %v", err)
		return nil, err
	}

	debugLog("<-- %d %s", resp.StatusCode, resp.Status)
	debugLog("    realm: %q, url: %q", c.realm, c.baseURL)
	return resp, nil
}

func (c *Client) DoGet(path string, params map[string]string) (*http.Response, error) {
	if len(params) > 0 {
		q := url.Values{}
		for k, v := range params {
			q.Set(k, v)
		}
		path = path + "?" + q.Encode()
	}
	return c.DoRequest(http.MethodGet, path, nil)
}

func (c *Client) DoPost(path string, body []byte) (*http.Response, error) {
	return c.DoRequest(http.MethodPost, path, body)
}
