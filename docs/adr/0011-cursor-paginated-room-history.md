# 11. Cursor-paginated room history

## Status

Accepted

## Context

The reconnect history endpoint originally returned one fixed newest-message window. That is
simple for a demo, but it prevents users from inspecting older room history and makes the
storage ordering contract implicit. History must remain bounded, room-isolated, and compatible
with both SQLite and Postgres while WebSocket events continue to provide live updates.

## Decision

Keep the existing `GET /api/messages?room=...&limit=...` request as the first page and add an
optional `before` cursor for older pages. The cursor is an opaque, versioned, URL-safe value
that carries the room and the deterministic `(timestamp, id)` continuation boundary. The
server validates it at the HTTP boundary, rejects malformed, oversized, repeated, and
room-mismatched values, and never accepts raw timestamp/ID boundary parameters.

Repositories fetch one extra row to determine `has_more`, order pages newest-first using
timestamp plus ID as a tie-breaker, and return each page to the API in chronological order.
The response exposes `has_more` and `next_cursor` without changing the existing room,
message, limit, or viewer fields. Every page repeats authentication and room-grant checks.

The React client uses the first page for initial load and reconnect catch-up. Users request
older pages through an accessible control; prepended rows are deduplicated and the scroll
viewport is restored so reading position does not jump.

## Consequences

- History remains bounded per request and works consistently across SQLite and Postgres.
- Existing clients that ignore pagination metadata continue to receive the original first-page
  message shape.
- The client can grow a room history incrementally without loading an unbounded result set.
- Cursor values are intentionally opaque and may be invalidated by future cursor-version
  changes; clients must restart from the first page when that happens.
- Very long histories still need the existing virtualization threshold and may eventually need
  retention or archival policy at the deployment layer.
