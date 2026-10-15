package main

import (
	"context"
	"flag"
	"fmt"
	"github.com/story2u/ai-write-life-circle/apps/api-go/internal/application"
	"github.com/story2u/ai-write-life-circle/apps/api-go/internal/config"
	"github.com/story2u/ai-write-life-circle/apps/api-go/internal/transport"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func run() error {
	health := flag.Bool("healthcheck", false, "probe the loopback health endpoint and exit")
	flag.Parse()
	if *health {
		port := os.Getenv("WRITER_AGENT_API_PORT")
		if port == "" {
			port = "8787"
		}
		client := http.Client{Timeout: 3 * time.Second}
		host := os.Getenv("WRITER_AGENT_API_HOST")
		if host == "" {
			host = "127.0.0.1"
		}
		ip := net.ParseIP(host)
		if ip == nil || !ip.IsLoopback() {
			return fmt.Errorf("health probe requires loopback")
		}
		res, e := client.Get("http://" + net.JoinHostPort(host, port) + "/healthz")
		if e != nil {
			return e
		}
		defer res.Body.Close()
		if res.StatusCode != 200 {
			return fmt.Errorf("health probe returned %d", res.StatusCode)
		}
		return nil
	}
	c, e := config.Load()
	if e != nil {
		return e
	}
	s := &application.Service{Root: c.Root, State: c.State, Project: c.Project}
	h := transport.Handler(transport.Options{Service: s, Environment: c.Environment, ResolveActor: func(*http.Request) *application.Actor { return &application.Actor{ID: "local-author", Role: "author"} }})
	server := &http.Server{Handler: h, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 32 * 1024}
	listener, e := net.Listen("tcp", net.JoinHostPort(c.Host, c.Port))
	if e != nil {
		return e
	}
	fmt.Printf("Writer Agent API listening on http://%s\nHarness root: %s\n", listener.Addr().String(), c.Root)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	done := make(chan error, 1)
	go func() { done <- server.Serve(listener) }()
	select {
	case e = <-done:
		if e == http.ErrServerClosed {
			return nil
		}
		return e
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if e = server.Shutdown(shutdown); e != nil {
			_ = server.Close()
			return e
		}
		e = <-done
		if e == http.ErrServerClosed {
			return nil
		}
		return e
	}
}
func main() {
	if e := run(); e != nil {
		slog.Error("API stopped", "error", e)
		os.Exit(1)
	}
}
