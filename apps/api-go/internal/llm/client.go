// Package llm provides bounded, non-streaming model calls. It owns no manuscript tools.
package llm

import "context"

type Usage struct {
	InputTokens  int `json:"inputTokens"`
	OutputTokens int `json:"outputTokens"`
}
type Request struct {
	System, Input string
	Schema        map[string]any
}
type Response struct {
	Text  string
	Usage *Usage
}
type Client interface {
	Generate(context.Context, Request) (Response, error)
}
type Error struct{ Code string }

func (e *Error) Error() string { return e.Code }
func Fail(code string) error   { return &Error{Code: code} }
