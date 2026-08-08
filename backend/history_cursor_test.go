package main

import (
	"encoding/base64"
	"strings"
	"testing"
	"time"

	"github.com/AliSinaDevelo/Chatster/db"
)

func TestHistoryCursorRoundTrip(t *testing.T) {
	message := db.Message{
		ID:        42,
		Room:      "engineering",
		Timestamp: time.Date(2026, time.August, 8, 12, 34, 56, 789, time.UTC),
	}

	raw, err := encodeHistoryCursor(message.Room, message)
	if err != nil {
		t.Fatalf("encode cursor: %v", err)
	}
	decoded, err := decodeHistoryCursor(raw)
	if err != nil {
		t.Fatalf("decode cursor: %v", err)
	}
	if decoded.Version != historyCursorVersion || decoded.Room != message.Room || decoded.ID != message.ID || !decoded.Timestamp.Equal(message.Timestamp) {
		t.Fatalf("cursor round trip: %#v", decoded)
	}
}

func TestHistoryCursorRejectsMalformedPayloads(t *testing.T) {
	for name, payload := range map[string]string{
		"empty":              "",
		"oversized":          strings.Repeat("a", maxHistoryCursorSize+1),
		"unknown field":      base64.RawURLEncoding.EncodeToString([]byte(`{"v":1,"room":"general","timestamp":"2026-08-08T12:00:00Z","id":1,"extra":true}`)),
		"trailing value":     base64.RawURLEncoding.EncodeToString([]byte(`{"v":1,"room":"general","timestamp":"2026-08-08T12:00:00Z","id":1} {}`)),
		"wrong version":      base64.RawURLEncoding.EncodeToString([]byte(`{"v":2,"room":"general","timestamp":"2026-08-08T12:00:00Z","id":1}`)),
		"non-canonical room": base64.RawURLEncoding.EncodeToString([]byte(`{"v":1,"room":"General","timestamp":"2026-08-08T12:00:00Z","id":1}`)),
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := decodeHistoryCursor(payload); err == nil {
				t.Fatal("expected malformed cursor to be rejected")
			}
		})
	}
}
