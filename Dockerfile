# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS frontend-build
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.25-bookworm@sha256:3b4a11519ad929d1e1d261a12cff056f0c85b735253d7d861346b9c6f8b36437 AS backend-build
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=1 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/chatster .

FROM debian:bookworm-slim@sha256:88200866dfff7ea7f5cbcb6ec7c8a701889efe6fe859fe64d6990e4b07ea4171
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates libsqlite3-0 \
	&& rm -rf /var/lib/apt/lists/*
RUN useradd --no-create-home --uid 65532 --user-group chatster
WORKDIR /app
COPY --from=backend-build /out/chatster /app/chatster
COPY --from=frontend-build /src/frontend/build /app/static
RUN mkdir -p /data && chown -R chatster:chatster /data /app/static
USER chatster:chatster
ENV CHATSTER_DB_PATH=/data/chatster.db
ENV CHATSTER_STATIC_DIR=/app/static
EXPOSE 8080
VOLUME ["/data"]
ENTRYPOINT ["/app/chatster"]
