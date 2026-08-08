---
id: 0012
title: Add cursor-paginated room history
status: review
agent: backend-specialist
model: sonnet
depends_on: []
parent: 0001
---

## Goal
Extend room history beyond the fixed reconnect window with a stable, bounded cursor contract that works consistently across SQLite and Postgres and gives the React client an accessible way to load older messages.

## Acceptance criteria
- [x] `GET /api/messages` keeps its existing response fields and accepts an optional opaque `before` cursor plus the existing bounded `limit`.
- [x] History pages are ordered chronologically, use timestamp plus message ID as a deterministic tie-breaker, and return `has_more` plus `next_cursor` without leaking storage details.
- [x] SQLite and Postgres repository contract tests prove room isolation, equal-timestamp ordering, cursor boundaries, empty pages, and the final page.
- [x] Invalid, oversized, mismatched-room, and malformed cursors return a stable client error without querying another room.
- [x] The React history view loads older pages through an accessible control, preserves the user's scroll position, and does not duplicate live or previously loaded messages.
- [x] API, frontend, architecture, and operations documentation explain cursor use, limits, and the reconnect-versus-history distinction.

## Context
The current endpoint returns only the newest 50 messages (capped at 100), while the long-history UI already virtualizes large in-memory lists. Keep the first-page response backward compatible and preserve signed-session authorization on every page. Do not expose raw database timestamps or IDs as a public cursor format; encode and validate a versioned room-bound cursor at the HTTP boundary.

## Notes
Use a `(timestamp, id)` ordering because timestamps can collide. The repository methods should accept parsed cursor values rather than knowing the HTTP encoding. The first page remains the reconnect catch-up path; older pages are explicit user-driven history loads.
