package llm

import (
	"errors"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Provider, BaseURL, APIKey, Model, ResponseFormat, TokenParameter string
	Timeout                                                          time.Duration
	MaxContextBytes, MaxOutputTokens, MaxResponseBytes               int
}
type ModelInfo struct {
	Provider  string `json:"provider"`
	Model     string `json:"model"`
	Endpoint  string `json:"endpoint"`
	Execution string `json:"execution"`
}

func localHost(host string) bool {
	ip := net.ParseIP(host)
	return host == "localhost" || (ip != nil && ip.IsLoopback())
}
func (c Config) Info() ModelInfo {
	u, e := url.Parse(c.BaseURL)
	if e != nil {
		return ModelInfo{}
	}
	execution := "external"
	if localHost(u.Hostname()) {
		execution = "local"
	}
	return ModelInfo{c.Provider, c.Model, u.Scheme + "://" + u.Host + u.EscapedPath(), execution}
}
func number(key string, fallback, low, high int) (int, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	v, e := strconv.Atoi(raw)
	if e != nil || v < low || v > high {
		return 0, errors.New("invalid bounded model setting")
	}
	return v, nil
}
func Load() (Config, error) {
	c := Config{Provider: os.Getenv("WRITER_AGENT_LLM_PROVIDER"), BaseURL: os.Getenv("WRITER_AGENT_LLM_BASE_URL"), APIKey: os.Getenv("WRITER_AGENT_LLM_API_KEY"), Model: os.Getenv("WRITER_AGENT_LLM_MODEL"), ResponseFormat: os.Getenv("WRITER_AGENT_LLM_RESPONSE_FORMAT"), TokenParameter: os.Getenv("WRITER_AGENT_LLM_TOKEN_PARAMETER")}
	if c.Provider == "" && c.BaseURL == "" && c.Model == "" && c.APIKey == "" {
		return c, Fail("LLM_NOT_CONFIGURED")
	}
	if c.Provider == "" {
		c.Provider = "openai-compatible"
	}
	if c.BaseURL == "" {
		c.BaseURL = "https://api.deepseek.com"
	}
	// Keep other compatible providers opt-in: never supply a DeepSeek model
	// or request dialect for an explicitly configured third-party endpoint.
	endpoint := strings.TrimRight(c.BaseURL, "/")
	deepSeek := endpoint == "https://api.deepseek.com" || endpoint == "https://api.deepseek.com/v1"
	defaultTimeout, defaultOutputTokens := 60, 2048
	if deepSeek {
		if c.Model == "" {
			c.Model = "deepseek-flash"
		}
		if c.ResponseFormat == "" {
			c.ResponseFormat = "json_object"
		}
		if c.TokenParameter == "" {
			c.TokenParameter = "max_tokens"
		}
		defaultTimeout, defaultOutputTokens = 180, 8192
	}
	if c.ResponseFormat == "" {
		c.ResponseFormat = "none"
	}
	if c.TokenParameter == "" {
		c.TokenParameter = "max_completion_tokens"
	}
	seconds, e := number("WRITER_AGENT_LLM_TIMEOUT_SECONDS", defaultTimeout, 1, 180)
	if e != nil {
		return c, Fail("LLM_INVALID_CONFIG")
	}
	c.Timeout = time.Duration(seconds) * time.Second
	c.MaxContextBytes, e = number("WRITER_AGENT_REVIEW_MAX_CONTEXT_TOKENS", 12000, 2048, 64000)
	if e != nil {
		return c, Fail("LLM_INVALID_CONFIG")
	}
	c.MaxOutputTokens, e = number("WRITER_AGENT_LLM_MAX_OUTPUT_TOKENS", defaultOutputTokens, 128, 8192)
	if e != nil {
		return c, Fail("LLM_INVALID_CONFIG")
	}
	c.MaxResponseBytes = 256 * 1024
	if e = c.Validate(); e != nil {
		return c, e
	}
	return c, nil
}
func (c Config) Validate() error {
	u, e := url.Parse(c.BaseURL)
	if e != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || c.Model == "" || len(c.Model) > 200 || c.Provider != "openai-compatible" {
		return Fail("LLM_INVALID_CONFIG")
	}
	if u.Scheme != "https" && (u.Scheme != "http" || !localHost(u.Hostname())) {
		return Fail("LLM_INVALID_CONFIG")
	}
	if !localHost(u.Hostname()) && strings.TrimSpace(c.APIKey) == "" {
		return Fail("LLM_INVALID_CONFIG")
	}
	if c.ResponseFormat != "none" && c.ResponseFormat != "json_object" && c.ResponseFormat != "json_schema" {
		return Fail("LLM_INVALID_CONFIG")
	}
	if c.TokenParameter != "max_tokens" && c.TokenParameter != "max_completion_tokens" {
		return Fail("LLM_INVALID_CONFIG")
	}
	if c.Timeout <= 0 || c.Timeout > 180*time.Second || c.MaxContextBytes < 2048 || c.MaxContextBytes > 64000 || c.MaxOutputTokens < 128 || c.MaxOutputTokens > 8192 || c.MaxResponseBytes < 1024 || c.MaxResponseBytes > 1024*1024 {
		return Fail("LLM_INVALID_CONFIG")
	}
	return nil
}
