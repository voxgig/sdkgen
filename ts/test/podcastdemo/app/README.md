# Podcast Studio API server

The example API that generated SDKs are verified against for file upload and
download. A podcast studio holds shows and their episodes as JSON records,
and each record carries files: an episode's audio and transcript, a show's
artwork. The records hold only each file's metadata (`size`, `type`, `etag`,
`digest`, `modified`); the bytes live in a store of their own and move
through routes of their own.

It is a Fastify server written in TypeScript, with in-memory stores loaded
from `podcast.data.json` at start. Its OpenAPI definition is
`def/podcastdemo-1.0.0-openapi-3.0.0.yaml`.

## Running it

Node.js 24 or later.

```bash
npm install
npm test               # unit and integration tests, over real sockets
npm run server         # build, then listen on http://localhost:8903
npm run validate       # check a running server against the definition
npm run validate:full  # start a server of its own, then check it
```

The server listens on a loopback host only, and refuses to start on any
other. These environment variables configure it:

| Variable | Default | Meaning |
| --- | --- | --- |
| `HOST` | `localhost` | `localhost`, `127.0.0.1` or `::1` |
| `PORT` | `8903` | Listening port |
| `PODCASTDEMO_TOKEN` | `podcastdemo-local-token` | The bearer credential |
| `PODCASTDEMO_MAX_AUDIO` | 64 MiB | Largest audio upload, in bytes |
| `PODCASTDEMO_MAX_ARTWORK` | 1 MiB | Largest artwork upload |
| `PODCASTDEMO_MAX_TRANSCRIPT` | 1 MiB | Largest transcript upload |
| `PODCASTDEMO_MAX_SESSIONS` | 32 | Open upload sessions at once |
| `PODCASTDEMO_SESSION_TTL_MS` | one day | Lifetime of an upload session |
| `DATA_PATH` | `podcast.data.json` | The seed data |
| `LOG_LEVEL` | `error` | Fastify log level |

`npm run validate` reads the same variables, so give it the ones the server
was started with.

## The credential

Every route requires `Authorization: Bearer <token>`. A missing or wrong
credential is a 401 with `WWW-Authenticate: Bearer realm="podcastdemo"`. The
default token is for local use only; set `PODCASTDEMO_TOKEN` for anything
else.

```bash
curl -H 'Authorization: Bearer podcastdemo-local-token' \
  http://localhost:8903/api/show
```

## Routes

| Method | Path | What it does |
| --- | --- | --- |
| `GET`, `POST` | `/api/show` | List shows; create one (JSON) |
| `GET`, `PUT`, `DELETE` | `/api/show/{show_id}` | Load, update, remove a show and everything beneath it |
| `GET`, `PUT` | `/api/show/{show_id}/artwork` | The artwork, `image/png` |
| `GET` | `/api/show/{show_id}/feed` | RSS of the published episodes, `application/rss+xml` |
| `GET` | `/api/show/{show_id}/episode` | List episodes |
| `POST` | `/api/show/{show_id}/episode` | Create an episode with its audio, `multipart/form-data` |
| `GET`, `PUT`, `DELETE` | `/api/show/{show_id}/episode/{episode_id}` | Load, update, remove an episode |
| `POST` | `/api/show/{show_id}/episode/{episode_id}/publish` | `{"publish": true}` or `false` |
| `GET`, `HEAD`, `PUT` | `/api/show/{show_id}/episode/{episode_id}/audio` | The audio, `audio/wav` |
| `GET`, `PUT` | `/api/show/{show_id}/episode/{episode_id}/transcript` | The transcript, `text/vtt` |
| `POST` | `/api/upload` | Open a resumable upload session (JSON) |
| `GET`, `HEAD`, `PATCH`, `DELETE` | `/api/upload/{upload_id}` | Load it, read its offset, append to it, abandon it |

### Files

A file download sends `ETag`, `Content-Length` and a SHA-256 `Repr-Digest`
(RFC 9530), and answers `If-None-Match` with 304. The audio also takes a
single byte `Range`, answered with 206 and `Content-Range`, or 416 when no
byte of it exists; `If-Range` keeps the range only while the strong tag
still matches. A multi-range request is answered with the whole file.

A file upload replaces the file whole. `If-Match` guards it with 412, and a
`Repr-Digest` sent with the audio is checked, with 400 on a mismatch. A body
over its cap is a 413 and a body of another media type a 415.

The multipart create takes the fields `title` and `number` and one file part
`audio` of type `audio/wav`. The part's file name is never used; the episode
gets an identifier the server generates, as every record does.

### Upload sessions

A session speaks the core of the tus 1.0.0 protocol, opened with a JSON
create:

```bash
T='Authorization: Bearer podcastdemo-local-token'
curl -H "$T" -H 'Content-Type: application/json' \
  -d '{"show_id":"studio","episode_id":"pilot","slot":"audio","size":1000}' \
  http://localhost:8903/api/upload
curl -I -H "$T" -H 'Tus-Resumable: 1.0.0' http://localhost:8903/api/upload/<id>
curl -X PATCH -H "$T" -H 'Tus-Resumable: 1.0.0' -H 'Upload-Offset: 0' \
  -H 'Content-Type: application/offset+octet-stream' \
  --data-binary @part.bin http://localhost:8903/api/upload/<id>
```

`HEAD` reads `Upload-Offset` and `Upload-Length`. `PATCH` appends at the
offset the session is at, or answers 409 with that offset; a missing or
different `Tus-Resumable` is a 412. When the offset reaches the size, the
bytes fill the slot the session names, `audio` or `transcript`. A `digest`
given at create is checked then, and a mismatch restarts the session from
zero.

## Seed data

`podcast.data.json` holds two shows and two episodes. The seed audio is not
stored anywhere: it is a WAV header and samples computed from a seed number,
so an episode of any size is served, ranged and digested without a fixture
or the bytes in memory. The seed artwork is a PNG computed the same way.

## Layout

```
src/
  server.ts       buildApp, main, the seed loader
  config.ts       environment and limits
  auth.ts         the bearer check
  transfer.ts     downloads: ranges, conditions, and the intercept seam
  content/        WAV and PNG generators, digests, range and tag parsing
  store/          records, file slots, upload sessions
  routes/         show, episode and upload routes
test/
  unit/           generators, parsers and stores
  integration/    every route, over a socket on an ephemeral port
  defsync.test.ts the design copy of the definition matches def/
validate.ts       the server checked against the definition
```
