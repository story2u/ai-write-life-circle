package config

import (
	"testing"
)

func TestLocalIdentityConfigurationFailsClosed(t *testing.T) {
	for _, c := range []struct {
		name, env, node, host, port string
		ok                          bool
	}{{"default", "development", "", "127.0.0.1", "0", true}, {"test", "test", "", "::1", "8787", true}, {"production", "production", "", "127.0.0.1", "8787", false}, {"node production", "development", "production", "127.0.0.1", "8787", false}, {"public bind", "development", "", "0.0.0.0", "8787", false}, {"public v6", "development", "", "::", "8787", false}, {"invalid port", "development", "", "127.0.0.1", "NaN", false}, {"unknown env", "staging", "", "127.0.0.1", "8787", false}} {
		t.Run(c.name, func(t *testing.T) {
			t.Setenv("WRITER_AGENT_ENV", c.env)
			t.Setenv("NODE_ENV", c.node)
			t.Setenv("WRITER_AGENT_API_HOST", c.host)
			t.Setenv("WRITER_AGENT_API_PORT", c.port)
			t.Setenv("WRITER_AGENT_STATE_DIR", t.TempDir())
			_, e := Load()
			if (e == nil) != c.ok {
				t.Fatal(e)
			}
		})
	}
}
