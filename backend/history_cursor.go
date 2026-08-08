package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"time"

	"github.com/AliSinaDevelo/Chatster/db"
)

const (
	historyCursorVersion = 1
	maxHistoryCursorSize = 512
)

var errInvalidHistoryCursor = errors.New("invalid history cursor")

type historyCursor struct {
	Version   int       `json:"v"`
	Room      string    `json:"room"`
	Timestamp time.Time `json:"timestamp"`
	ID        int64     `json:"id"`
}

func encodeHistoryCursor(room string, message db.Message) (string, error) {
	payload, err := json.Marshal(historyCursor{
		Version:   historyCursorVersion,
		Room:      room,
		Timestamp: message.Timestamp.UTC(),
		ID:        message.ID,
	})
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(payload), nil
}

func decodeHistoryCursor(raw string) (historyCursor, error) {
	if raw == "" || len(raw) > maxHistoryCursorSize {
		return historyCursor{}, errInvalidHistoryCursor
	}

	payload, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil || len(payload) == 0 || len(payload) > maxHistoryCursorSize {
		return historyCursor{}, errInvalidHistoryCursor
	}

	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	var cursor historyCursor
	if err := decoder.Decode(&cursor); err != nil {
		return historyCursor{}, errInvalidHistoryCursor
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return historyCursor{}, errInvalidHistoryCursor
	}

	room, err := db.NormalizeRoom(cursor.Room)
	if err != nil || room != cursor.Room || cursor.Version != historyCursorVersion || cursor.ID < 1 || cursor.Timestamp.IsZero() {
		return historyCursor{}, errInvalidHistoryCursor
	}
	cursor.Room = room
	cursor.Timestamp = cursor.Timestamp.UTC()
	return cursor, nil
}

func historyCursorRoomMatches(cursor historyCursor, room string) bool {
	return strings.EqualFold(cursor.Room, room)
}
