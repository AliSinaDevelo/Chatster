# syntax=docker/dockerfile:1

FROM golang:1.22-bookworm@sha256:3d699e4d15d0f8f13c9195c0632a16702b8cbdece2955af1c23b37ae5d55a253 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/chatster .

FROM debian:bookworm-slim@sha256:88200866dfff7ea7f5cbcb6ec7c8a701889efe6fe859fe64d6990e4b07ea4171
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates libsqlite3-0 \
	&& rm -rf /var/lib/apt/lists/*
RUN useradd --no-create-home --uid 65532 --user-group chatster
WORKDIR /app
COPY --from=build /out/chatster .
RUN mkdir -p /data && chown chatster:chatster /data
USER chatster:chatster
ENV CHATSTER_DB_PATH=/data/chatster.db
EXPOSE 8080
VOLUME ["/data"]
ENTRYPOINT ["/app/chatster"]
