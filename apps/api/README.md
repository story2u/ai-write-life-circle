# API boundary

This package reserves the future backend application boundary. It intentionally
does not start an Agent runtime or expose a real LLM provider yet. Define request
and response payloads in `packages/contracts`; the web app currently uses the
replaceable demo adapter and has an HTTP adapter ready for a later API service.

Chapter writes must remain explicit author saves. Any future Agent endpoints may
inspect chapters and return proposals, but must not write complete chapter prose.
