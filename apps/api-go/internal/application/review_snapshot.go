package application

import (
	"context"
	"errors"
	"github.com/story2u/ai-write-life-circle/apps/api-go/internal/compat"
	"github.com/story2u/ai-write-life-circle/apps/api-go/internal/storage"
)

// ReviewRevision reads the current saved revision without adopting or rewriting Draft state.
// It shares the existing lock and CAS semantics but has no persistence side effects.
func (s *Service) ReviewRevision(ctx context.Context, c Chapter) (StoredRevision, error) {
	var result StoredRevision
	err := storage.Lock(ctx, s.draftPath(c)+".lock", func() error {
		var state *DraftState
		found, e := storage.Read(s.draftPath(c), &state)
		if e != nil {
			return e
		}
		if !found {
			result = sourceRevision(c, nil)
			return nil
		}
		if state == nil || state.SourceHash == "" || state.Revisions == nil {
			return errors.New("invalid saved revision state")
		}
		if state.SourceHash != c.SourceHash {
			if len(state.Revisions) == 0 || state.Revisions[len(state.Revisions)-1].Hash != compat.Hash(c.Markdown) {
				return conflict(nil, pointer(c.SourceRevisionID))
			}
			result = sourceRevision(c, nil)
		} else {
			result = head(c, state)
		}
		if result.ID == "" || result.Hash != compat.Hash(result.Markdown) {
			return errors.New("saved revision hash mismatch")
		}
		return nil
	})
	return result, err
}
