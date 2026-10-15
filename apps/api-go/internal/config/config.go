package config

import (
	"errors"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Config struct{ Root, State, Project, Host, Port, Environment string }

func value(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}
func Root() string {
	if root := os.Getenv("WRITER_AGENT_HARNESS_ROOT"); root != "" {
		r, _ := filepath.Abs(root)
		return r
	}
	cwd, _ := os.Getwd()
	for dir := cwd; ; dir = filepath.Dir(dir) {
		if _, e := os.Stat(filepath.Join(dir, "pnpm-workspace.yaml")); e == nil {
			return dir
		}
		if filepath.Dir(dir) == dir {
			break
		}
	}
	return cwd
}
func Load() (Config, error) {
	home, e := os.UserHomeDir()
	if e != nil {
		return Config{}, e
	}
	c := Config{Root: Root(), State: value("WRITER_AGENT_STATE_DIR", filepath.Join(home, ".local/share/ai-write-life-circle")), Project: value("WRITER_AGENT_PROJECT_ID", "local"), Host: value("WRITER_AGENT_API_HOST", "127.0.0.1"), Port: value("WRITER_AGENT_API_PORT", "8787"), Environment: value("WRITER_AGENT_ENV", value("NODE_ENV", "development"))}
	if c.Environment == "production" || os.Getenv("NODE_ENV") == "production" {
		return c, errors.New("the local demo-identity API server is development-only and must not run in production; production identity adapter required")
	}
	if c.Environment != "development" && c.Environment != "test" {
		return c, errors.New("WRITER_AGENT_ENV must be development or test; no production identity is configured")
	}
	ip := net.ParseIP(c.Host)
	if ip == nil || !ip.IsLoopback() {
		return c, errors.New("local development identity requires a loopback bind address")
	}
	port, e := strconv.Atoi(c.Port)
	if e != nil || port < 0 || port > 65535 {
		return c, errors.New("invalid API port")
	}
	if c.Project == "" {
		return c, errors.New("project ID must not be empty")
	}
	c.State, e = filepath.Abs(c.State)
	if e != nil {
		return c, e
	}
	if rel, e := filepath.Rel(c.Root, c.State); e == nil {
		first := strings.Split(filepath.ToSlash(rel), "/")[0]
		for _, forbidden := range []string{"manuscript", "book", "proposals", "decisions"} {
			if first == forbidden {
				return c, errors.New("application state must stay outside author source directories")
			}
		}
	}
	return c, nil
}
