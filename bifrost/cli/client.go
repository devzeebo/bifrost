package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
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

func NewClient(baseURL, apiKey, realm string) *Client {
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		realm:   realm,
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

// DoGet performs a GET request and returns the response body.
func (c *Client) DoGet(path string) ([]byte, error) {
	resp, err := c.DoRequest(http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		var errResp struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(body, &errResp) == nil && errResp.Error != "" {
			return nil, fmt.Errorf("%s", errResp.Error)
		}
		return nil, fmt.Errorf("request failed: %s", resp.Status)
	}

	return body, nil
}

// DoPost performs a POST request and returns the response body.
func (c *Client) DoPost(path string, reqBody interface{}) ([]byte, error) {
	var body []byte
	if reqBody != nil {
		var err error
		body, err = json.Marshal(reqBody)
		if err != nil {
			return nil, err
		}
	}

	resp, err := c.DoRequest(http.MethodPost, path, body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		var errResp struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(respBody, &errResp) == nil && errResp.Error != "" {
			return nil, fmt.Errorf("%s", errResp.Error)
		}
		return nil, fmt.Errorf("request failed: %s", resp.Status)
	}

	return respBody, nil
}

// DoGetWithParams performs a GET request with query parameters and returns the response body.
func (c *Client) DoGetWithParams(path string, params map[string]string) ([]byte, error) {
	if len(params) > 0 {
		q := url.Values{}
		for k, v := range params {
			q.Set(k, v)
		}
		path = path + "?" + q.Encode()
	}
	return c.DoGet(path)
}
