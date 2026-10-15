package review

import (
	"context"
	"errors"
	"github.com/story2u/ai-write-life-circle/apps/api-go/internal/application"
	"github.com/story2u/ai-write-life-circle/apps/api-go/internal/compat"
	"github.com/story2u/ai-write-life-circle/apps/api-go/internal/storage"
	"path/filepath"
	"time"
)

type requestRecord struct {
	Fingerprint string `json:"fingerprint"`
	RunID       string `json:"runId"`
	Action      string `json:"action"`
}
type state struct {
	ProjectID string                   `json:"projectId"`
	Runs      map[string]Run           `json:"runs"`
	Requests  map[string]requestRecord `json:"requests"`
	Feedback  []Feedback               `json:"feedback"`
}

func (s *Service) path() string {
	return filepath.Join(s.App.State, "review-runs", compat.Key(s.App.Project)+".json")
}
func (s *Service) load() (state, error) {
	var st state
	found, e := storage.Read(s.path(), &st)
	if e != nil {
		return st, storageFailure()
	}
	if !found {
		return state{s.App.Project, map[string]Run{}, map[string]requestRecord{}, []Feedback{}}, nil
	}
	if st.ProjectID != s.App.Project || st.Runs == nil || st.Requests == nil || st.Feedback == nil {
		return st, storageFailure()
	}
	for id, r := range st.Runs {
		if r.RunID != id || r.ProjectID != s.App.Project || len(r.Sources) == 0 || r.Version < 1 {
			return st, storageFailure()
		}
		for _, src := range r.Sources {
			if src.ProjectID != st.ProjectID || src.ExcerptHash != compat.Hash(src.Excerpt) {
				return st, storageFailure()
			}
		}
	}
	return st, nil
}
func (s *Service) transaction(ctx context.Context, fn func(*state) (bool, error)) error {
	e := storage.Lock(ctx, s.path()+".lock", func() error {
		st, e := s.load()
		if e != nil {
			return e
		}
		changed := false
		now := time.Now().UTC()
		for id, r := range st.Runs {
			deadline, err := time.Parse(time.RFC3339Nano, r.DeadlineAt)
			if r.Status == "running" && (err != nil || now.After(deadline)) {
				at := compat.Now()
				code := "REVIEW_INTERRUPTED"
				r.Status = "failed"
				r.CompletedAt = &at
				r.FailureCode = &code
				r.Version++
				st.Runs[id] = r
				changed = true
			}
		}
		more, e := fn(&st)
		if e != nil {
			return e
		}
		changed = changed || more
		if changed {
			if e = s.write(ctx, s.path(), st); e != nil {
				return storageFailure()
			}
		}
		return nil
	})
	if e != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		var problem *application.Error
		if errors.As(e, &problem) {
			return e
		}
		return storageFailure()
	}
	return nil
}
