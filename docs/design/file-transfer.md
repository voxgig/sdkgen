# Design: files in the entity model — upload, download, partial and resumable transfer

Status: **plan, with every ruling made** (2026-11-23). Nothing here is
implemented. The maintainer ruled R1 to R8 on 2026-11-21 and the rest on
2026-11-23, and section 12 records them all. Sections 4.2 and 4.3 keep the
options that were not chosen, so the reasoning stays readable.

Two of the later rulings changed words used throughout. The noun is
`binary`: an entity's bytes are reached as `entity.binary('audio')`, and
the feature, its sources, its errors and the model key take the same word.
The prose still says "file" for what a person uploads or downloads. And a
text body is plain data: it comes back through the ordinary operation as a
string in the record, so only bytes are slots.

Method: a survey of both codebases at sdkgen `28b4664` (4.45.0) and apidef
`00778c4` (8.33.1), one trial run of that apidef over a draft definition of
the example API this plan proposes, and a short pass over external
precedents, listed in section 15.

Every claim about the code below carries one of three labels, because they
are not worth the same:

- **ran**: produced by running the code in the session that wrote this.
- **read**: taken from reading the source, with the file named. Not run.
- **expected**: what a library's documented API offers. Not exercised here.

What was *not* done matters as much. No generated SDK was built or run, no
target toolchain compiled anything, sdkgen's own suite was not run, and no
example server was started. The apidef trial ran on Node 22.23.5, below the
Node 24 floor its CI holds, with `EBADENGINE` warnings.

---

## 1. The problem

A generated SDK speaks JSON records. APIs also move bytes: a document's
content, an episode's audio, an avatar, a CSV export, an import file. Today
a generated SDK can send a raw body, cannot encode a multipart or form body,
cannot read any response that is not JSON, and holds every byte it touches in
memory. The model it is generated from already describes most of what is
missing.

Four things are wanted, in the order they constrain each other:

1. **A place for files in the entity model.** The SDKs are built on
   entities: stateful objects with data and match, whose every operation
   resolves to the entity. A file has to join that model rather than sit
   beside it as a second API.
2. **Security.** A file API moves the largest and most sensitive payloads an
   SDK handles, touches the local filesystem, follows the server to other
   origins, and is the easiest place to exhaust memory or disk.
3. **Transfer that survives the network.** Partial reads, resumable
   downloads, resumable uploads, progress, cancellation.
4. **Parity.** Twenty SDK targets, each with its own transport, and three
   that ship none.

It also needs something to verify against: an example API that can be run
locally, in the way solardemo is, in a domain made of files.

---

## 2. Current state

### 2.1 The model already describes file routes

apidef records far more than sdkgen uses.

- **Bodies.** Every point may carry `rb` (request body) and `rs` (success
  response), each a `%body`: `kind` of `json`, `raw`, `multipart` or `form`,
  the `media` type, `binary` for a raw body of bytes, the `fields` of a
  multipart or form body with `binary`, `list`, `join` and `media` on each,
  and `alternatives` (**read**: `model/apidef.aontu:105-147`,
  `ts/src/transform/body.ts`, Go port `go/transform_body.go`).
- **Fields.** An entity field carries `fo: binary` for a `format: binary`
  property or a Swagger 2 `type: file`.
- **A binary read beneath an item is already classified.** A `GET` under an
  item key whose success responses are all binary becomes a `load` on the
  owning entity, with an action named for the trailing literal (**read**:
  `readOfItem`, `ts/src/guide/heuristic01.ts:2375-2413`). It is pinned as a
  ruling: `'GET /reports/{reportId}/contents': 'report load content'`
  (`ts/test/rulings.test.ts:539-545`).
- **Request headers survive.** `Range`, `If-Match`, `If-None-Match`,
  `If-Range` and `Upload-Offset` are kept as `header` arguments. A required
  one joins the point's selector, `q.exist`.
- **The correction surface exists.** `guide.aontu` takes `body.media` and
  `response.media` per operation, and `action` per path.

What the model does not record:

| Not recorded | Consequence |
| --- | --- |
| Response headers of any kind | `ETag`, `Accept-Ranges`, `Content-Range`, `Content-Disposition`, `Repr-Digest`, `Upload-Offset`, `Location` are invisible to a generator |
| Status codes | Nothing says a route answers 206, 304, 412, 416 or 202 |
| `HEAD` and `OPTIONS` | Written to the guide (`op: head: method: *HEAD`), then dropped from the model (**read**: `IGNORED_OPS`, `ts/src/transform/operation.ts:44-48`) |
| That an action moves a file | A byte download and a JSON action are both just `$action` points |
| That an entity is a transfer session | An upload session is an ordinary entity with an odd `update` |
| Size limits | No bound a client could check before sending |

### 2.2 A trial: the draft example definition through today's apidef

The draft definition of the example API (section 9,
[`file-transfer-demo-def.yaml`](./file-transfer-demo-def.yaml)) was built
with apidef 8.33.1 and no guide corrections (**ran**; output in
appendix A). Three entities came out: `show`, `episode` beneath it, and
`upload`.

| Route | Classified as | Body facts |
| --- | --- | --- |
| `GET .../episode/{id}/audio` | `episode.load`, `$action: audio` | `rs: raw, audio/wav, binary`; header args `range`, `if_range`, `if_none_match` |
| `PUT .../episode/{id}/audio` | `episode.update`, `$action: audio` | `rb: raw, audio/wav, binary`; `rs: json`; header args `if_match`, `repr_digest` |
| `HEAD .../episode/{id}/audio` | in the guide, absent from the model | none |
| `GET`, `PUT .../episode/{id}/transcript` | `episode.load`, `episode.update`, `$action: transcript` | `raw, text/vtt`, not binary |
| `GET`, `PUT /api/show/{id}/artwork` | `show.load`, `show.update`, `$action: artwork` | `raw, image/png, binary` |
| `GET /api/show/{id}/feed` | `show.load`, `$action: feed` | `rs: raw, application/rss+xml`, not binary |
| `POST .../show/{id}/episode` | `episode.create`, no action | `rb: multipart` with `audio` (binary, `audio/wav`), `number`, `title` |
| `POST .../episode/{id}/publish` | `episode.create`, `$action: publish` | JSON |
| `POST /api/upload` | `upload.create`, **`$action: upload`**, with a warning | JSON |
| `PATCH /api/upload/{id}` | `upload.update`; selector `["id", "tus_resumable", "upload_offset"]` | `rb: raw, application/offset+octet-stream, binary`; no `rs` |
| `HEAD /api/upload/{id}` | in the guide, absent from the model | none |

Six things follow.

- **O1. The model already says where the files are.** Each file route is an
  action point on the record's own `load` or `update`, carrying the media
  type and whether it is bytes. No new inference is needed to *find* them.
- **O2. The record and the bytes share a name.** `Episode.audio` in the
  JSON record is a small object of size, type and tag; `audio` is also the
  action that moves the bytes. apidef merges the multipart part `audio`
  into that field and keeps the record's declaration, so the entity field
  reads `` `$ANY` ``, read-only, and only `rb.fields` remembers the part is
  binary.
- **O3. A resource named for a verb loses its create.** `upload` is on the
  action verb list, so `POST /api/upload` is read as the action `upload`,
  and the build warns: "Create on entity=upload has no route of its own,
  only the action upload". The item routes key the entity correctly.
- **O4. The generated flows do not know a file route from a record route.**
  `BasicUploadFlow` is `create -> update -> load -> remove`, where `update`
  is the raw `PATCH` that appends bytes. `BasicEpisodeFlow` begins with the
  multipart `create`.
- **O5. `HEAD` is gone.** The cheapest way to read a file's size and
  validator, and the way both resumable-upload protocols read an offset,
  does not reach the model.
- **O6. Protocol bookkeeping becomes the caller's.** A required header
  joins a point's selector, so the append is reached only by a call that
  supplies `tus_resumable` and `upload_offset` itself.

### 2.3 What a generated SDK does with those points

All **read**, across the twenty SDK targets; the per-target table is
appendix B.

- **Requests.** Every target sends a raw body through the `$body` key of
  the request data when the point's `body.kind` is `raw`. Every target that
  accepts a stream reads it into memory in full before the first attempt,
  "so that a retry sends the same bytes" (`MakeRequestUtility.ts:39-43`).
  **No target has a multipart or form encoder.** The generated reference
  says so: such a body "this SDK does not encode yet: it sends the data as
  JSON" (`ts/src/helpers/media.ts:48-50`).
- **Responses.** Every target reads the whole response into memory and
  keeps it only as parsed JSON. None hands bytes or text to the caller.
  Response headers are copied to `result.headers`, lower-cased, in every
  target.
- **`direct()`** is JSON only as well (`Main.fragment.ts`, `_rawRequest`).
- **`stream()`** iterates list items. Its documented upload path, "for
  uploads an async-iterable `body`", sets `reqdata.body$` and
  `ctx.stream_out`, and nothing reads either.
- **The `test` feature's mock** answers JSON records only, and strips
  `$body` before it stores a record.
- **Features.** `cache` reads the text of every cacheable `GET`. `retry`
  depends on the buffered body. `timeout` is one deadline for the whole
  request. `rbac`, `metrics`, `audit` and `cost` key on `<entity>.<op>` and
  cannot tell an action from its base operation.
- **Typed models** have no case for `fo: binary`, so such a field takes the
  type of its `` `$STRING` ``.

So for the trial API: the multipart create would be sent as JSON, both
`audio` routes would fail on the response or send nothing useful, and the
session's `PATCH` has no bytes to send. Not **ran**; the mock suite would
pass regardless, since the mock never looks at an encoding.

### 2.4 Defects and hazards found in passing

Independent of any design here. H1 is documented; the others are not.

| # | Finding | Evidence | Fix lands |
| --- | --- | --- | --- |
| H1 | A multipart or form body is sent as JSON | **read**; the generated reference states it | Phase 1 |
| H2 | A failed upload copies its bytes into the thrown error. `makeError` sets `err.spec = clean(ctx, spec)`, and `clean` copies a `Uint8Array` body key by key and a `Buffer` through its `toJSON` | **reproduced, then fixed** (`p0-error-bytes`): `ts/test/cleanbinary.test.ts` against the shipped utilities, and the sweep of a generated SDK, which found the bytes in the error, the explain record, the serialised context and the log output | Phase 0 |
| H3 | A binary response is handled differently per target: `response_content_type` in `ts` and `js`; a transport error in `py`, which decodes it as UTF-8 first; an empty body and no error in `swift`. `csharp`, `java`, `kotlin`, `scala` and `clojure` decode the bytes to text lossily before judging it | **reproduced, then fixed** (`p0-binary-response`), in two parts. The error message quoted the first 160 characters of the body: a `binary` case on every target's probe showed it, and the preview is now written only for text. The response body also stayed on the context, so the serialised context and the log record carried it: the sweep's response canary showed that, and `clean` now describes it. The transports still read the body into text first; the codecs of Phase 1 replace that | Phase 0 |
| H4 | `stream()` documents an upload body nothing sends | **read** `EntityBase.fragment.ts:134-139`; one writer and no reader in every target | Phase 0 |
| H5 | `cache` would read a binary download as text | **read** `CacheFeature.ts:91-112` | Phase 0 |
| H6 | No size bound on a response in the 15 other targets that ship a transport; hard caps of 10 MB in `rust` and 32 MiB in `c` | **read**, appendix B | Phase 1 |
| H7 | A deadline on the whole exchange that no large transfer survives: 30 s in `php` (`CURLOPT_TIMEOUT`) and in `c` (`HTTP_TIMEOUT_MS`), and the client's default of 100 s in `csharp`. At the other end `go`, `py`, `java`, `kotlin`, `scala`, `clojure` and `elixir` set no timeout, on clients whose default is to wait without limit | **read**, appendix B; the client defaults **expected** | Phase 2 |
| H8 | `rust` carries bytes as a list of numbers, one `f64` each | **read** `media.rs:97-116` | Phase 2 |
| H9 | apidef reads `POST /api/upload` as an action (O3) | **ran** | Phase 0 |
| H10 | Basic flows exercise file routes as record routes (O4) | **ran** (the flows); the failure they cause not run | Phase 0 |
| H11 | The SDK's own redirect loops drop three fixed header names on a hop to another origin (`authorization`, `cookie`, `proxy-authorization`). A credential the model places under another header name is not among them | **reproduced, then fixed** (`p0-redirect-credentials`): on Node's `fetch`, `x-api-key` and `private-token` reached another origin and a 307 sent a `PUT` body on, and each target's own redirect test found the same against a second listener. Fifteen targets now follow in their own loop and `go` and `py` in their client's hook, in every target that ships a transport | Phase 0 |
| H12 | `rbac` cannot grant a record read without granting every action on `load` | **read** `RbacFeature.ts`, `_required` | Phase 2 |

---

## 3. Precedents

Short, and only where one decides something below.

- **Records and bytes are two things with one identity.** OData calls an
  entity that is itself a stream a *media entity*, and a named stream on an
  entity a *stream property*, each with its own read link, edit link, media
  type and ETag held in the record. AtomPub's media link entry is the same
  split. JMAP uploads a blob, gets an id, and references it from records.
- **Ranges and validators.** RFC 9110 defines `Range`, `Content-Range`,
  206 and 416, and `If-Range`: a ranged request that falls back to the
  whole representation when the validator no longer matches. That last
  rule is what makes resuming safe.
- **Integrity.** RFC 9530 defines `Content-Digest` and `Repr-Digest`, and
  obsoletes the older `Digest` field. `Content-MD5` left HTTP before that.
- **Resumable upload.** tus 1.0.0 is stable and deployed: `HEAD` reads
  `Upload-Offset`, `PATCH` appends at it as
  `application/offset+octet-stream`. The IETF's "Resumable Uploads for
  HTTP" grew out of tus and is **still an Internet-Draft**: revision 15,
  November 2026, expiring 6 May 2027. It uses `Upload-Complete`,
  `Upload-Offset`, a 104 interim response and
  `application/partial-upload`. Its field set has changed between
  revisions.
- **Other generators.** Stainless-generated SDKs take an `Uploadable` and
  ship a `toFile` helper; Speakeasy and Fern stream uploads and downloads.
  The search found none that documents resumable transfer generated from a
  definition: it is treated as an API design pattern the caller drives.
- **A string that means a path is a vulnerability class.** PHP's cURL
  binding once read `@/path` in a field value as "upload this file", so
  any untrusted string reaching a form field could exfiltrate a local
  file. `CURLFile` (PHP 5.5) replaced it with an explicit object.

---

## 4. Files in the entity model

### 4.1 Four roles bytes play

The mechanism on the wire is one thing, a body that is not JSON. What the
bytes *are* is four:

| Role | Example in the draft API | In the model today |
| --- | --- | --- |
| **Content of a record** | an episode's audio, a show's artwork | action point on `load` and `update`, raw |
| **Another representation of records** | a show's RSS feed, a CSV export | action point on `load`, raw text; or `rs.alternatives` on a plain point |
| **Input or result of an action** | an import file, a rendered report | action point, raw or multipart |
| **A transfer in progress** | an upload session | an entity |

One mechanism should serve the first three. The fourth is an entity
already, and section 4.6 keeps it one.

**Ruled: bytes are slots, and text is data.** Whatever its role, a body the
model marks binary is a slot (section 4.2). A body that is raw but not
binary, such as a transcript or a feed, is plain data. It comes back
through the ordinary operation as a string under `$body` in the record,
within `maxBuffer`, and is sent the same way, as the `$body` a raw request
already takes.

### 4.2 The noun: what a file is (R1)

Seven existing rules constrain the answer:

- **I1.** Every entity operation resolves to the entity.
- **I2.** `data()` is plain data: cloned on the way in and out, serialised
  by `toJSON`, and in `rust`, `c`, `cpp`, `zig` and `ocaml` a closed value
  union with no variant for bytes, a handle or a stream.
- **I3.** An entity is one record (apidef ADR-001).
- **I4.** Everything that leaves the pipeline passes through `clean`
  (ADR-003).
- **I5.** A generated SDK carries only what it uses (ADR-002).
- **I6.** The model is sdkgen's only input (ADR-001).
- **I7.** `guide.aontu` is the only correction surface, and a heuristic
  never drops what it rejects (apidef ADR-002).

| Option | What it is | Verdict |
| --- | --- | --- |
| **N1. A slot beside the record** | An entity has data, match, and zero or more named binary slots. Bytes never enter `data()`. The record may hold a slot's *metadata* (O2). Reached as `entity.binary('audio')` | **Recommended.** Breaks none of I1 to I7 |
| N2. A value inside the record | `episode.data().audio` is a lazy file object with `save()` and `stream()` | Breaks I2 in every target and cannot exist in the five closed-union targets. `clean` would walk it |
| N3. A child entity per file | Each slot is its own entity, `client.EpisodeAudio()`; `load` downloads, `update` uploads | Breaks I3. Multiplies classes in 23 targets, each needing a collision-free name. Reverses the `load` + action ruling |
| N4. An action result and nothing else | No new noun: `load({ $action: 'audio' }, { sink })` | Smallest change and the weakest result: no typed slot names, no place for resume state, and I2 pressure returns the moment someone wants the bytes back |

N1 is OData's stream property, and its media entity when the slot has no
name: an entity whose plain `load` point answers bytes owns a default slot,
`entity.binary()`.

**Ruled (R1): N1.** R9 names the slot's accessor `binary`.

### 4.3 The verb: how a transfer is an operation (R2)

| Option | Shape | Cost |
| --- | --- | --- |
| **V1. The six operations, action-aware** | A download is `load` on an action point, an upload `create` or `update` on one, exactly as apidef classifies them now. Policy keys learn the action: `episode.load:audio` | **Recommended.** No model change. Fixes H12 for every action, not only files |
| V2. Two new operations | `download` and `upload` join the canonical six | apidef's op map and `RESOLVED_OPS`, sdkgen's `CANON_OP_ORDER`, an operation fragment per op in each target, typed-model suffixes, flows and tests. Reverses the pinned `report load content` ruling |
| V3. One new operation | `transfer`, with a direction | Most of V2's cost for a vaguer name |

V1 has one real weakness, and it is H12: with keys of `<entity>.<op>`, a
caller allowed to read an episode's record may read its audio. Least
privilege between a record and its bytes is the commonest file policy there
is. So V1 is recommended *with* action-aware keys in `rbac`, `allow`,
`metrics`, `audit` and `cost`, most specific first:
`<entity>.<op>:<action>`, then `<entity>.<op>`, then `<op>`, then `*`. The
action is in the request before the point is resolved, so `rbac` can still
refuse at `PrePoint`.

**Ruled (R2): V1, with action-aware keys.**

### 4.4 The proposed shape

The handle is an accessor on the entity instance, as `data()` and `match()`
are. It names a slot; it holds no bytes.

```ts
const episode = await client.Episode().load({ show_id, id })

// The record holds the slot's metadata; the slot holds the bytes.
episode.data().audio                    // { size, type, etag, digest, modified }
const audio = episode.binary('audio')   // typed: only names the model has

await audio.save('./pilot.wav')         // to disk: atomic, resumable, verified
const head = await audio.bytes({ range: { start: 0, length: 44 } })
for await (const chunk of audio.stream()) { /* one chunk in memory */ }

await audio.put(client.binary.path('./pilot-v2.wav'),
  { ifMatch: episode.data().audio.etag })

// A record and its file in one request: a multipart create.
const next = await client.Episode().create({
  show_id, title: 'Two', audio: client.binary.path('./two.wav'),
})

// Text is plain data: the ordinary operation, and a string in the record.
const feed = await client.Show().load({ id: show_id, $action: 'feed' })
const rss = feed.data().$body
await client.Episode().update({ show_id, id, $action: 'transcript', $body: vtt })
```

Rules of the shape:

1. **Each handle call is one run of the existing pipeline**, on the action
   point the slot names: `save`, `bytes` and `stream` run `load`;
   `put` runs `update`, or `create` where that is the only writer. Every
   hook fires, every feature applies, and the context carries a `transfer`
   record (slot, direction, counts) for features that care.
2. **`save` and `put` resolve to the entity**, as the operations beneath
   them do (I1). `bytes` and `stream` resolve to what they name (R11).
3. **A binary route called as a plain operation is refused**, with an error
   naming the handle. A byte body never lands in `data()` (I2). A text
   body does, under `$body`, within `maxBuffer`.
4. **A source is an explicit object**, built by a constructor in the
   caller's code: `binary.bytes`, `binary.stream`, `binary.path`. A string
   in a binary field is content. It is never a path (S1).
5. **A source travels in the data, and only a field the model declares
   binary may hold one** (R10).
   `prepareBody` lifts the sources out by the names in
   `point.body.fields[].binary` before any transform, validation or
   cleaning sees the data; a source anywhere else is refused.
6. **In the five closed-union targets a source cannot be a value**, so it
   travels as a typed argument beside the data. This is the boundary the
   `options.utility` seam already has, for the same reason, and it is
   stated at the divergence.
7. **Slot names are generated**, as a string-literal union or constants, so
   a misspelt slot is a compile error where the language has one.

How the same thing reads in other targets:

| Target | Download to disk | Upload |
| --- | --- | --- |
| `go` | `episode.Binary("audio").Save(ctx, path, opts)` | `.Put(ctx, sdk.BinaryPath(p), opts)`; `.Open(ctx)` gives an `io.ReadCloser` |
| `py` | `episode.binary("audio").save(path)` | `.put(sdk.binary.path(p))`; `.open()` is a context manager |
| `java` | `episode.binary("audio").save(Path.of(p))` | `.put(BinarySource.path(p))`; `.open()` gives an `InputStream` |
| `rust` | `episode.binary("audio").save(&path, opts)?` | `.put(BinarySource::path(&p), opts)?`; `.reader()?` gives `impl Read` |
| `c` | `entity_binary_get(ent, "audio", sink_fn, user, opts)` | `entity_binary_put(ent, "audio", source_fn, user, size, opts)` |

### 4.5 What the model must say, and what the runtime discovers

The smallest model wins, because every model fact costs a round trip
through apidef and its Go port.

**sdkgen derives the slots from what is already there.** An action whose
points carry a binary `rs` or `rb` is a slot: its name is the action's, and
its direction comes from which of the two is binary. A raw body that is
not binary is text, and stays with the ordinary operation. A helper beside
`entityActions` in
`helpers/opShape.ts` computes it once, or a fact rule does where aontu can
express the aggregation. No definition is read (I6). **Phases 1 and 2 need
no change to the model.**

**The runtime discovers what the server states per response.** Whether a
range was honoured, the validator, the length and the digest arrive in
response headers that every target already copies to `result.headers`. A
definition that declares them is a hint; the response is the fact. Most
definitions do not declare `Range` at all.

**apidef adds only what can be neither derived nor discovered**, as
optional metadata an older SDK ignores:

| Fact | Why it cannot be discovered | Proposed home |
| --- | --- | --- |
| The record field holding a slot's metadata (O2) | Same name is a guess; an author must be able to say | on the point, `bn.field` |
| A `HEAD` is declared on the route (O5) | Probing costs a request and a 405 | on the `GET` point, `bn.head` |
| A declared size bound | Needed before sending | on the point, `bn.max` |
| The entity is a transfer session, and which protocol | Must be known before the first byte | on the entity, `session` |
| Which slot a session fills | Not in any definition | guide only |

`bn` follows the model's convention of two characters for optional point
metadata. In the guide the natural home is the action entry, which is an
empty map today: `action: "audio": binary: { ... }`. Whatever a heuristic
sets there is written as an aontu default, so an author's value overrides
it, and a slot the heuristic rejects is written `active: *false`, not
omitted (I7). R9 gives `bn` and `binary`; `session` is R17.

### 4.6 Sessions: an entity whose job is moving bytes

A resumable upload has state that outlives a request: an offset, a length,
an expiry. That is a record, and the draft API models it as one. `upload`
is an ordinary entity: `create` opens a session, `load` reads its offset,
`remove` abandons it. Only the append moves bytes.

So a session needs no new noun either. An entity the model marks as a
session gains one driver on its instance:

```ts
const up = await client.Upload().create({ show_id, episode_id, slot: 'audio', size })
await up.send(client.binary.path('./big.wav'), { onProgress })

const token = up.token()                  // plain data; sensitive (S6)
await client.Upload().resume(token).send(client.binary.path('./big.wav'))
```

`send` is a loop over the entity's own operations: read the offset, append
from it, and on a failure read the offset again. The wire dialect of the
append (which headers, which media type, how completion is signalled) is a
plugin chosen by the model's `session` fact. R7 rules the tus 1.0.0
dialect first, the IETF draft tracked as the second, and part-based
uploads after both.

The dialect's own headers are the plugin's to send. A caller of `send`
never supplies `Upload-Offset` or `Tus-Resumable`, which is why O6 has to
be undone in the model (section 8, A4).

Binding a session to the slot it fills, so that
`episode.binary('audio').put(source, { resumable: true })` opens one itself,
needs a guide entry no definition can supply. It is sugar over the driver
and comes after it.

---

## 5. Security

### 5.1 Boundaries

A file transfer crosses six, and each rule below guards one:

1. caller's code and the SDK;
2. the SDK and the API's own origin, which holds the credential;
3. the SDK and any other origin: a redirect target, a presigned URL, a
   session `Location`;
4. the SDK and the local filesystem;
5. the SDK and its diagnostics: errors, logs, audit records, telemetry;
6. an agent driving the SDK, in `go-mcp`.

The server is not fully trusted in any of them. A caller chose to talk to
it; they did not agree to let it name a local path, fill a disk, or learn a
credential meant for someone else.

### 5.2 Rules

Each has a default that is the safe one, an explicit way to relax it where
relaxing is legitimate, and a test that fails when it regresses.

| # | Rule | Default | Proven by |
| --- | --- | --- | --- |
| S1 | **A string is content, never a path.** A local file is opened only through `binary.path(...)` in the caller's code. Nothing in request data, options, the model, the environment or a response can cause an open | No relaxation | Corpus case sends a path-shaped string as a binary field and receives it back as bytes; a source scan finds no file open outside the fs plugin |
| S2 | **The server never chooses a local path.** A `Content-Disposition` name is exposed as `info.name`, sanitised, and used only when the caller asks for `saveInto(dir)`, which checks containment after resolving | `save(path)` takes the caller's path | Example server's `badname` fault: traversal, absolute, reserved and control-character names |
| S3 | **Memory is bounded.** `bytes()`, and a text body returned in the record, refuse past `maxBuffer`, checked against the declared length first and the count while reading. Streaming holds one chunk | 16 MiB | Generated large slot; mid-body count without a declared length |
| S4 | **Disk and time are bounded.** A declared length must be met exactly. An undeclared one is capped by `maxBytes` | 1 GiB when undeclared (R12) | `shortlength` and unbounded-chunked faults |
| S5 | **A credential goes to the API's origin and nowhere else.** A hop or URL on another origin carries no `authorization`, `cookie`, `proxy-authorization`, no header or query parameter `prepareAuth` placed, and none a secrets provider supplied (fixes H11) | Always | Second origin records what arrives; the test asserts no canary |
| S6 | **A capability URL is a secret.** Presigned URLs, session URLs and resume tokens are registered with `clean` when the SDK first sees them (ADR-003, rule 1) | Always | The clean sweep, with a presigned canary |
| S7 | **An upload never follows a redirect to another origin.** A 307 or 308 would re-send the body there. Where the SDK cannot read where a redirect points, as in a browser, a request with a body refuses every redirect (R21) | Refused unless the host is allow-listed | `redirect` fault on a `PUT` |
| S8 | **Other origins are policy.** A download may follow an https redirect to another origin, bare of credentials as S5 requires. No hop may downgrade from https; hops are capped; a `hosts` allow-list narrows or widens | As stated (R6) | `redirect` fault matrix |
| S9 | **File bytes never reach a diagnostic.** In the spec, explain record, error, log, audit and telemetry a body is a placeholder: kind, and size and media type where known. Never the bytes, never a source (fixes H2) | No switch of its own. `clean.active: false`, the one opt-out of all cleaning, turns it off with the rest | The clean sweep gains a content canary: a marker in the file bytes, searched for in every string that leaves |
| S10 | **A transfer is complete or it failed.** Bytes received must equal the declared length; a 206 must carry the `Content-Range` asked for | Always | `cut`, `shortlength` faults |
| S11 | **Integrity is verified when offered, and fails closed.** A `Repr-Digest` or `Content-Digest` in SHA-256 or SHA-512 is checked. MD5 and an ETag are not treated as digests | Verify when present; requiring one is opt-in | `corrupt` fault |
| S12 | **A resume never joins two versions.** It sends `If-Range` with a strong validator; a 200 in answer restarts from zero; a weak or absent validator means no resume | Always | `retag` fault changes the content between attempts |
| S13 | **Writes are atomic and conservative.** A temporary file in the destination directory, created exclusively with owner-only permissions, renamed on success. No overwrite. The final path component is not followed if it is a link. A failed partial is removed unless kept for resume | Overwrite is opt-in per call | Existing file, existing link, kill mid-write |
| S14 | **The SDK does not interpret what it moves.** No unpacking, no sniffing, no extension chosen from a response, no execute bit | No relaxation | Stated; nothing to regress into |
| S15 | **A download is the type the model declares.** A 200 whose media type is neither the declared one nor an alternative is refused, so an HTML error page is not saved as audio | Refused (R18) | `wrongtype` fault |
| S16 | **Encoding cannot be injected.** The multipart boundary is 128 random bits. Field and file names are escaped. A name is the base name only and may be withheld. A media type with a line break is refused | Always | Primary corpus cases with quotes and line breaks in names |
| S17 | **File transfers are not decompressed.** They ask for `identity`: a range is defined over the encoded bytes, and decoding is unbounded | Wherever the platform lets a client set it; a browser decides for itself | `gzip` fault |
| S18 | **Timeouts fit transfers.** On a file point a connect timeout and an idle timeout replace a deadline on the whole exchange, and supply one where a target has none (H7) | 10 s connect, 30 s idle | `stall` fault |
| S19 | **Least privilege reaches the bytes.** Policy keys include the action (section 4.3), and the `binary` feature has `read` and `write` switches | Both on; rules are the project's | Corpus: record allowed, bytes denied |
| S20 | **A retry never amplifies.** Only a replayable source is re-sent, only on an idempotent method or inside a session, a bounded number of times. A spent stream fails once, clearly, and is never silently buffered to make it replayable | 5 attempts | netsim mid-body faults |
| S21 | **An agent gets a sandbox.** In `go-mcp` file access is off unless a root directory is configured, and every path is confined to it | Off | Phase 4 |
| S22 | **Local detail stays local.** No full local path as a file name, no modification time, unless the caller sets them | Base name only | Primary corpus case |

Three of these change behaviour that exists today and need saying plainly:
S5 widens the header set the redirect loops drop; S17 asks a server not to
compress a file point, so the decoding `#475` added has nothing to do
there; S18 replaces the fixed deadlines of `php`, `c` and `csharp` on file
points.

### 5.3 ADR-006

Two of these rules are of the kind `ADR.md` exists for: reversing either
would change what every SDK is. The maintainer ruled that the entry go into
the register now, as **Proposed**, and become Accepted when the tests that
enforce it exist.

> **ADR-006 — File bytes are neither data nor diagnostics, and a string is
> never a path.** A file's bytes never enter an entity's record, and never
> reach an error, a log or any other record the SDK emits. A local file is
> opened only through a source the caller's own code constructed.

Enforcement would be the content canary in every SDK's shipped clean
sweep, and a source scan for a file open outside the fs plugin.

---

## 6. Developer experience

### 6.1 Sources and sinks

| Source | Replayable | Size known | Comes with |
| --- | --- | --- | --- |
| `binary.bytes(buf, { name, type })` | yes | yes | core |
| a platform `Blob` or `File` | yes | yes | core |
| `binary.stream(s, { size, name, type })` | no | if given | `stream` plugin |
| `binary.path(p, { name, type })` | yes | yes | `fs` plugin |

Replayable is what decides whether a failed upload may be retried (S20).
A known size is what decides whether the request carries a length or is
chunked; some servers refuse chunked uploads, so the error for an unsized
stream on such a route says so.

A sink is a path (`fs` plugin), or a platform writable stream or a
callback (`stream` plugin). The callback is the form every target can
offer. With neither plugin an SDK moves only what fits in `maxBuffer`
(R5, section 7.2). Text needs no source: it is a string in the data.

### 6.2 Partial reads

```ts
await audio.bytes({ range: { start: 0, length: 44 } })     // the header
await audio.bytes({ range: { last: 1024 } })                // the tail
```

One range per call. A caller who asked for a range and received the whole
file is told so with an error, and may opt into accepting it. Several
ranges in one request, and parallel ranged downloads, are left out
(section 13).

### 6.3 Resumable download

`save(path)` resumes without being asked. On a failure after the first
byte, the loop re-requests from the verified offset with `If-Range`, up to
the attempt limit, then fails with the partial kept if the caller asked
for that. A later call given the same path and the caller's token resumes
across processes. The loop restarts from zero, and says so in the progress
record, when the server ignores the range or the validator changed (S12).

### 6.4 Resumable upload

A session's `send` (section 4.6). The token is plain data: the entity, its
match, the offset, the size, and the session URL where there is one. It is
a credential in effect and is registered as one (S6). The SDK holds it in
memory and hands it over on request, and writes no state file of its own
(R13).

### 6.5 Progress, cancellation, timeouts

- **Progress** is a callback in the call's control: bytes done, total when
  known, attempt number, and whether the attempt restarted. It is called
  at most every 100 ms and once at the end.
- **Cancellation.** Only `ts` and `js` can cancel a request today. A
  transfer that cannot be stopped is a worse gap than a request that
  cannot, so each target takes its own primitive in the same phase it
  gains streaming: a `context.Context` in `go`, an event in `py`, and so
  on. Cancelling leaves a resumable partial.
- **Timeouts** as S18.

### 6.6 Errors

One code per cause, so a caller branches on a code and never on a message:
`binary_sink_required`, `binary_source_refused`, `binary_source_spent`,
`binary_too_large`, `binary_exists`, `binary_path_refused`,
`binary_type_unexpected`, `binary_truncated`, `binary_digest_mismatch`,
`binary_range_ignored`, `binary_changed`, `binary_redirect_refused`,
`binary_resume_invalid`, `binary_feature_inactive`. A text body past
`maxBuffer` fails in core, as `response_too_large`. The existing `status`
and `notFound` on the error
apply unchanged. An error response's own body is read to a small bound and
cleaned, as any error preview is.

### 6.7 Where there is no filesystem

In a browser or an edge runtime the fs plugin is not shipped. A download
gives a stream or a `Blob`; an upload takes a `File` or a `Blob`, which the
platform streams from disk itself. A browser cannot report upload progress
through `fetch`, and can stream a request body only in some engines, so
there a `binary.stream` source is refused in favour of a `Blob`.

---

## 7. Runtime architecture

### 7.1 Core: body codecs

Correct encoding is not a file feature. An API whose every body is
form-encoded cannot be called today (H1), with no file in sight. So the
codecs are core runtime, in each target's `utility/`:

- **request:** `json` as now; `form`; `multipart`; `raw` as now. The
  model's `fields`, with `list` and `join`, already say how each value is
  laid out.
- **response:** `json` as now; `raw` read to `maxBuffer`, text into the
  record under `$body` and bytes for the handle. One error for an
  unexpected type, the same in every target (H3).

They would be emitted only when the model has a point of that kind (I5),
by the exclusion mechanism that trims feature source now.

The handle is core too, in its thinnest form: an accessor the entity
component emits when the model has slots, which answers `bytes()` and a
`put` of in-memory content through these codecs, within `maxBuffer`.

### 7.2 The `binary` feature and its plugins

Everything past bounded, in-memory transfer is one feature (R8), trimmed
like any other, with ADR-002 plugins for its parts:

| Part | Holds | Needs |
| --- | --- | --- |
| core of the feature | the transfer loop, ranges, conditional requests, progress, cancellation, over content that fits in memory | `fetch` |
| `stream` | stream sources, stream and callback sinks, `stream()`: transfer at constant memory | nothing more |
| `fs` | path sources, `save`, `saveInto`, atomic writes | `fs` |
| `digest` | SHA-256 and SHA-512 verification and sending | `crypto` |
| `resume` | resumable download, tokens | nothing more |
| `session-tus`, `session-rufh` | the append dialects: tus 1.0.0, and the IETF draft | nothing more |
| `indirect` | presigned and other-origin transfers | nothing more |

R5 was ruled as "both as feature plugins", and the maintainer confirmed
the reading on 2026-11-23: moving a file to and from the local filesystem,
and moving it as bytes and streams, are *each* a plugin of the feature,
`fs` and `stream`. A project ships either or both, and a newly scaffolded
one turns on `stream`, and `fs` where its target has a filesystem (R19).
An SDK with neither still moves what fits in `maxBuffer`, through the core
codecs, and refuses anything larger. The rules of section 5.2 do not move
with the packaging: with `fs` on, a string is still never a path (S1), the
server still never names a file (S2), and a write is still atomic and
never an overwrite by default (S13).

`needs` is the vocabulary plugins already declare, so a target that cannot
provide `crypto` is refused at generation and not at a consumer's first
download. Where a target has no hash in its standard library, `digest`
gets a vendored one (R14).

With the feature off, a slot still answers `bytes()` and a `put` of
in-memory content through the core codecs, and everything else fails with
`binary_feature_inactive`. That split is what R8 rules.

### 7.3 The transport contract

`system.fetch` takes `(url, fetchdef)` and returns a map of `status`,
`statusText`, `headers`, `json` and `body`. Two additions, both optional,
so a transport written against today's contract keeps working, buffered:

- `fetchdef.body` may be a source the transport reads as it sends;
- the response may carry `stream`, a reader in the target's own idiom,
  with headers available before the first byte.

For `cpp`, `zig` and `ocaml`, which ship no transport, this contract *is*
the feature: they gain the source and sink callbacks and whatever the
caller's transport does with them.

### 7.4 Where the bytes move

Inside the pipeline, so that one operation is still one `PreDone`:

- **Upload.** `prepareBody` builds a body *plan*: the encoding, the plain
  fields, the sources. `makeFetchDef` turns the plan into a stream per
  attempt, which is what lets a retry replay without the buffering
  `makeRequest` does now.
- **Download to a sink.** At the response stage the body is copied to the
  sink, counted, digested and verified. `PreResult` and `PreDone` then see
  final numbers, so `metrics`, `audit` and `cost` record what happened.
- **Download by pulling** (`stream()`). The pipeline completes at the
  headers and the caller drives the rest. Verification raises on the final
  read; there is no automatic resume. The limits are documented where the
  method is.
- **Resume** is a loop at the transport seam, beneath `retry`: `retry`
  owns an attempt that failed before a body, the resume loop owns one that
  failed inside it.

### 7.5 What existing features must learn

| Feature | Change |
| --- | --- |
| `cache` | Never store or read a file point's body (H5) |
| `retry` | Ask the source whether it can be replayed; never buffer to make it so (S20) |
| `timeout` | Idle and connect timeouts on file points (S18) |
| `idempotency` | Unchanged; it is what makes a multipart `create` safe to retry |
| `rbac`, `metrics`, `audit`, `cost` | Action-aware keys (section 4.3). `metrics` and `audit` record bytes moved |
| `log`, `debug`, `telemetry` | Placeholders for bodies (S9) |
| `test` | A byte store per entity, record and slot, honouring ranges and validators |
| `netsim` | Mid-body faults: cut after N bytes, stall, corrupt |
| `validate` | A binary field validates as a source, not as a string |
| `streaming` | Unchanged; its unread upload path is removed or wired (H4) |

### 7.6 Targets

Parity is the product, and the transports are not alike (appendix B). R4
rules tiers, declared as data and enforced the way
`ts/test/parity.test.ts` enforces corpus tiers:

| Tier | Promise | Floor |
| --- | --- | --- |
| **Encoded** | Correct multipart, form and raw bodies; bounded in-memory reads; uniform errors; placeholders in diagnostics | **Every target, before anything ships** |
| **Streamed** | Handles, sources and sinks at constant memory; ranges; conditional requests; progress; cancellation | Targets whose HTTP client streams |
| **Resumable** | Resumable download; sessions; tokens | After Streamed, per target |

A target below a tier refuses the call with one error and says so in its
generated reference, as `bodyNote` does today. It never degrades silently
to buffering.

`ts` and `js` lead, as the reference. Then the targets whose client already
streams (**expected**, appendix B): `go`, `py`, `rb`, `php`, `java`,
`kotlin`, `scala`, `clojure`, `csharp`, `perl`, `elixir`, `lua`, `swift`,
`rust`. `c` needs streaming paths written into its own HTTP client.
`cpp`, `zig` and `ocaml` implement the contract of section 7.3.
`rust` also needs bytes that are not a list of numbers (H8), which is a
change to the vendored struct library and therefore an upstream one.

---

## 8. apidef work

Small, and none of it blocks Phases 1 or 2.

| # | Change | Fixtures |
| --- | --- | --- |
| A1 | A collection path whose literal names its own keyed entity is that entity's collection, not an action (H9). The tell is an action equal to the entity's name | a row beside the verb-word rulings; both ports |
| A2 | Basic flows skip a point whose `rb` or `rs` is not JSON, until file steps exist (H10) | `test/flow-step` cases |
| A3 | `bn` on a binary point: `field`, `head`, `max` (section 4.5), with the guide's `action: <name>: binary:` to set or refuse each | a new `test/file-point.tsv`, run by both suites |
| A4 | `session` on an entity whose append point speaks a known dialect, recognised by media type and header arguments together: `PATCH` with `application/offset+octet-stream` and `Upload-Offset` (tus 1.0.0, first, by R7); or `application/partial-upload` and `Upload-Complete` (the IETF draft). On such a point the dialect's own headers leave the selector and the caller's arguments (O6): the plugin sends them | `test/session.tsv` |
| A5 | File steps in the basic flow: upload generated bytes, download, compare | later, with Phase 2 |

Each is TypeScript first, then Go, with a shared fixture, as the port rule
requires. A3 and A4 raise the peer floor sdkgen declares; an SDK generated
from an older model simply has no `bn` and no sessions.

---

## 9. The example API: `podcastdemo`

R3 rules a podcast studio. Its files are the product, and each is a
different case:

| Slot | Kind | What it exercises |
| --- | --- | --- |
| `episode.audio` | large, binary | streaming, ranges (a player seeks), resume, digests, conditional replace |
| `episode.transcript` | text | plain data: a string in the record, read and written by the ordinary operation |
| `show.artwork` | small, binary | bounded in-memory transfer |
| `show.feed` | text, derived, read-only | a representation of records, returned as plain data |
| `episode` create | multipart | a record and a file in one request |
| `upload` | session entity | resumable upload: JSON `create`, `load` and `remove`, with the offset read and the append in tus 1.0.0 core |

`show` and `episode` stand where `planet` and `moon` stand in solardemo,
with `publish` as the plain JSON action that `terraform` is there. The
draft definition is
[`file-transfer-demo-def.yaml`](./file-transfer-demo-def.yaml); section 2.2
is what apidef makes of it today.

**The app** follows `ts/test/solardemo/app`: Fastify, in-memory stores, a
data file loaded at start, the definition under `def/`, a `validate`
script, unit and integration tests, a `defsync` test where a second copy of
the definition exists. Port 8903, after solardemo's 8901 and elementdemo's
8902.

What it adds, because files need it:

- **Generated content.** Seed audio is a WAV header and samples computed
  from a seed, so a slot of any size is served, ranged and digested without
  a fixture in the repository or the bytes in memory.
- **A bearer credential**, unlike solardemo, since S5 cannot be tested
  without one.
- **A second origin**, a store on port 8904 that takes no credential,
  records the headers of every request it receives, and serves that record
  at a debug route. Redirect and presigned tests assert against it.
- **Fault arming**, outside the definition as solardemo's `/debug` is, and
  only when an environment variable allows it. One request arms one fault
  for the next matching call: `cut`, `stall`, `status`, `corrupt`,
  `norange`, `retag`, `redirect`, `shortlength`, `gzip`, `badname`,
  `wrongtype`. Each is a rule of section 5.2 made testable against real
  sockets.
- **Its own bounds**: capped uploads, generated identifiers, no client
  name ever used as a path, bound to localhost.

It lives as a fixture here, as solardemo does, and as `app/` in a
reference SDK repository beside `voxgig-solardemo-sdk`, which the
maintainer creates (R16).

---

## 10. Verification

A file feature that passes only its mock has proved nothing; the survey
found exactly that shape twice (H1, H10).

| Layer | What runs | What it proves |
| --- | --- | --- |
| **Primary corpus** | New cases for `prepareBody`, `makeFetchDef`, `resultBody`, `clean` | The codecs and the placeholders, as data, in every target that runs the corpus |
| **Feature corpus** | `feature/file.aontu` in create-sdkgen, driven through a generated client. Bytes are stated as text or as a repeat rule | Handle behaviour, policy keys, ranges, limits, offline |
| **Mock with faults** | `test` byte store and `netsim` mid-body faults | Resume logic without a socket or a clock |
| **The shipped clean sweep** | Gains the content canary and the presigned canary, and keeps its negative control | S6 and S9, in every SDK, forever |
| **`generatedcompile`** | A lane per target: generate with the feature, build, run the shipped suite, require its `file: ran N case(s)` line | That it compiles, and that it did not skip |
| **`generate.test.ts`** | The fixture gains an entity with slots | Components neither crash nor leak placeholders on file points |
| **Live, against `podcastdemo`** | The generated live suite, and the fault matrix | Real sockets, real truncation, the second origin |
| **apidef** | The shared `.tsv` fixtures of section 8 | Both ports agree |

Two rules carried over from the existing suites: a section with zero cases
fails, and a toolchain a machine lacks skips visibly and is named, never
counted as a pass.

---

## 11. Phases

Sizes are relative. Each phase ends at something that can be released.

**Phase 0: contain.** Small, and worth doing whatever is ruled.

- Characterise H2, H3 and H11 with failing tests, then fix them in every
  target: placeholders for byte bodies in `clean`, one error for a
  non-JSON response, the credential set the redirect loops drop.
- `cache` skips non-JSON bodies (H5). `stream()`'s upload claim is removed
  or made true (H4).
- apidef A1 and A2.
- ADR-006 is in `ADR.md` as Proposed (section 5.3). It becomes Accepted
  with the first test that enforces it.

**Phase 1: body codecs, every target.** Large only by multiplication.

- Multipart and form encoders, raw responses to a bounded buffer, in core,
  trimmed by the model.
- Primary corpus cases; the reference notes that say "does not encode yet"
  come out.
- `podcastdemo` app, first cut: records, multipart create, raw `GET` and
  `PUT`. No faults yet. Reference SDK scaffolded from it.
- The tier table of section 7.6 as a test, every target at Encoded.

Exit: every target round-trips a record with a file against the live app.

**Phase 2: files in the entity model.** The large one.

- The `binary` feature in `ts` and `js`: handles, sources, sinks, the
  transport contract, the fs and digest plugins, ranges, conditional
  requests, progress, cancellation, action-aware policy keys.
- `test` byte store; feature corpus; clean sweep canaries.
- Ports by tier, each built and run on its real toolchain, or named as not
  verified where that could not be done.
- apidef A3 and A5.

Exit: the security table's Phase 2 rows each have a passing test in every
Streamed target.

**Phase 3: transfer that survives.** Medium.

- Resumable download; sessions and the tus 1.0.0 dialect; tokens.
- `netsim` mid-body faults; the app's fault arming and second origin.
- apidef A4.

Exit: the fault matrix passes live in every Resumable target.

**Phase 4: reach.** Medium, and separable.

- Presigned and other-origin transfers; part-based uploads.
- `go-cli`, `go-mcp` with its sandbox (S21), `py-data`.
- The packaged targets in their own repositories; documentation editions.

### Work items

Each line is one change that can be delivered and reviewed on its own. The
identifier stays the same for as long as the plan is carried out, and a
pull request names the items it covers. "From" is the finding, rule or
ruling of this document that the item answers.

**Phase 0**

| Item | Work | Where | From |
| --- | --- | --- | --- |
| `p0-error-bytes` | A failed upload's bytes stay out of its error, its explain record and every log, in every target | sdkgen | H2, S9 |
| `p0-binary-response` | One error, the same in every target, for a response that is not JSON, and a response that is bytes described in every diagnostic | sdkgen | H3, S9 |
| `p0-redirect-credentials` | No credential the SDK placed follows a redirect to another origin, under whatever name the model gives it | sdkgen | H11, S5 |
| `p0-browser-upload-redirect` | In a browser, a request with a body refuses every redirect, in `ts` and `js` | sdkgen | R21, S7 |
| `p0-perl-hook-exception` | perl masks an exception a feature hook throws, as `rb` and `php` do | sdkgen | R22 |
| `p0-clojure-hop-limit` | `clojure` follows five hops, as the other targets do | sdkgen | H11 |
| `p0-exchange-redirect` | The secrets feature's token exchange follows no redirect, so its refresh token stays on its origin | sdkgen | S5, S7 |
| `p0-perl-clean-copy` | perl's `clean` returns a copy of a value cleaned on its own, never the live object | sdkgen | S9 |
| `p0-feature-claims` | `cache` passes a body that is not JSON by; `stream()` stops documenting an upload nothing sends | sdkgen | H4, H5 |
| `p0-apidef-verb-noun` | A collection named for a verb keeps its plain create, in both ports | apidef | H9, A1 |
| `p0-apidef-flow-files` | Basic flows leave file routes out until file steps exist, in both ports | apidef | H10, A2 |
| `p0-adr` | ADR-006 in the decision register: entered as Proposed, Accepted with its first enforcing test | sdkgen | section 5.3 |

**Phase 1**

| Item | Work | Where | From |
| --- | --- | --- | --- |
| `p1-codecs-ts-js` | Multipart, form and bounded raw codecs in `ts` and `js`, emitted only when the model has such a point | sdkgen | H1, H6, R8 |
| `p1-codecs-ports` | The codecs in the thirteen other targets whose data can hold a source: `go`, `py`, `php`, `rb`, `lua`, `csharp`, `java`, `kotlin`, `scala`, `swift`, `perl`, `clojure`, `elixir` | sdkgen | H1, R4 |
| `p1-codecs-closed-union` | The codecs in `rust`, `c`, `cpp`, `zig` and `ocaml`, where a source is a typed argument beside the data | sdkgen | H1, R10 |
| `p1-corpus-primary` | Primary corpus cases for encoding, raw responses and body placeholders | create-sdkgen | section 10 |
| `p1-tier-test` | The tier table as a test, with every target at Encoded | sdkgen | R4 |
| `p1-demo-app` | The `podcastdemo` app, first cut: records, the multipart create, raw file routes | sdkgen | R3, section 9 |
| `p1-demo-sdk` | The reference SDK generated from it, which round-trips a record with a file in every target | a new reference SDK repository | R16 |

**Phase 2**

| Item | Work | Where | From |
| --- | --- | --- | --- |
| `p2-file-feature` | The `binary` feature in `ts` and `js`: slot handles with generated names, the transfer inside the pipeline, ranges, conditional requests, progress, cancellation | sdkgen | R1, R2, R8 |
| `p2-plugins-stream-fs` | The `stream` and `fs` plugins in `ts` and `js` | sdkgen | R5, S1, S2, S13 |
| `p2-digest` | Digest verification, with a hash in every target that claims the tier | sdkgen | S11, R14 |
| `p2-action-keys` | Action-aware keys in `rbac`, `allow`, `metrics`, `audit` and `cost`, in every target | sdkgen | H12, S19 |
| `p2-origins` | Other origins: the balanced redirect policy, the `hosts` allow-list, capability URLs registered as secrets | sdkgen | R6, S6, S7, S8 |
| `p2-timeouts` | Connect and idle timeouts on file points, in place of a deadline on the whole exchange | sdkgen | H7, S18 |
| `p2-test-mock` | The `test` feature's byte store, honouring ranges and validators | sdkgen | section 7.5 |
| `p2-corpus-feature` | The file feature corpus, and the content and capability canaries in every SDK's clean sweep | create-sdkgen, sdkgen | S9, section 10 |
| `p2-ports-streamed` | The Streamed tier in the fourteen targets whose client streams, each built and run on its own toolchain | sdkgen | R4 |
| `p2-ports-contract` | Streaming in `c`, and the extended transport contract in `cpp`, `zig` and `ocaml` | sdkgen | section 7.3 |
| `p2-rust-bytes` | `rust` carries a byte body as bytes | the struct library, then sdkgen | H8 |
| `p2-apidef-file-facts` | `bn` on a binary point and the guide's `binary` entry, in both ports | apidef | A3, R9 |
| `p2-flow-file-steps` | File steps in the basic flows and in every target's generated tests | apidef, sdkgen | A5 |
| `p2-docs` | Reference, how-to and explanation pages for files, and an entity's files in each generated README | sdkgen | section 7.6 |

**Phase 3**

| Item | Work | Where | From |
| --- | --- | --- | --- |
| `p3-resume-download` | Resumable download and its token, in `ts` and `js` | sdkgen | S12, R13 |
| `p3-sessions-tus` | Upload sessions and the tus 1.0.0 dialect, in `ts` and `js` | sdkgen | R7 |
| `p3-apidef-sessions` | `session` on an entity, with the dialect's headers out of the caller's arguments, in both ports | apidef | A4, O6 |
| `p3-netsim-faults` | Mid-body faults in `netsim` and the `test` feature | sdkgen | section 7.5 |
| `p3-demo-faults` | Fault arming and the second origin in the `podcastdemo` app | sdkgen | section 9 |
| `p3-ports-resumable` | The Resumable tier across the Streamed targets, proven by the fault matrix against the live app | sdkgen | R4 |
| `p3-session-rufh` | The IETF draft as a second session dialect, pinned to a named revision | sdkgen | R7 |

**Phase 4**

| Item | Work | Where | From |
| --- | --- | --- | --- |
| `p4-indirect` | Presigned and other-origin transfers | sdkgen | section 7.2 |
| `p4-parts` | Part-based uploads | sdkgen, apidef | R7 |
| `p4-consumer-targets` | Files in `go-cli`, `go-mcp` with its sandbox, and `py-data` | sdkgen | S21, R15 |
| `p4-packs` | Files in the packaged targets, in their own repositories | the pack repositories | R15 |

---

## 12. Rulings

Every question the plan raised is ruled. R1 to R8 were given on
2026-11-21, R9 to R19 on 2026-11-23, and R20 to R22 on 2026-11-25, on
questions the security work of Phase 0 raised.

| # | Question | Ruling | Gates |
| --- | --- | --- | --- |
| **R1** | What a file is in the entity model | N1: a named slot beside the record. Bytes never enter `data()` | Phase 2, ADR-006 |
| **R2** | How a transfer is an operation | V1: the six operations, with action-aware policy keys | Phase 2 |
| **R3** | The example API's domain | A podcast studio | Phase 1 |
| **R4** | Rollout across targets | Declared tiers, enforced; every target at Encoded first | All |
| **R5** | Whether the SDK touches the local filesystem, or moves only bytes and streams | "Both as feature plugins": two plugins of the feature, `fs` and `stream`, the reading confirmed | Phase 2 |
| **R6** | Default policy for other origins | Balanced: a download follows an https redirect without credentials; an upload never follows one to another origin | Phases 2, 4 |
| **R7** | Resumable upload protocol | Sessions as entities; the tus 1.0.0 dialect first, the IETF draft tracked as a second | Phase 3 |
| **R8** | Packaging | Codecs in core; everything else in a feature with plugins | Phases 1, 2 |
| **R9** | The noun's name | `binary`, everywhere: `entity.binary(name)`, the `binary` feature, `binary.path(...)` and the other sources, `binary_*` errors, `bn` on a point, `binary` under the guide's action entry | Phase 2 |
| **R10** | Where a source travels | In the request data, lifted out by the model's binary field names; a typed argument in the five closed-union targets | Phase 1 |
| **R11** | What handle methods resolve to | `save` and `put` to the entity; `bytes` and `stream` to what they name | Phase 2 |
| **R12** | Default limits | `maxBuffer` 16 MiB, which also bounds a text body in the record; 1 GiB when a download's length is undeclared; 5 attempts; 10 s connect, 30 s idle | Phase 2 |
| **R13** | Resume state | In memory and in a token the caller keeps. The SDK writes no state file of its own | Phase 3 |
| **R14** | Integrity | Verify SHA-256 and SHA-512 when offered, and fail on a mismatch; requiring a digest is opt-in; a target without a hash in its standard library vendors one | Phase 2 |
| **R15** | Consumer and packaged targets | Phase 4 | Phase 4 |
| **R16** | Example logistics | A fixture here and `app/` in a new reference SDK repository, which the maintainer creates; ports 8903 and 8904; a bearer credential | Phase 1 |
| **R17** | Model vocabulary | `bn` on a point and `binary` in the guide, by R9; `session` on an entity, the default, which was not put to the maintainer | apidef A3, A4 |
| **R18** | A download of an undeclared media type | Refused | Phase 2 |
| **R19** | Which plugins a scaffolded project turns on | `stream`; and `fs` where the target has a filesystem; both written in the project's own model | Phase 2 |
| **R20** | Whether `clean.active: false` also switches the description of bytes off | Yes. It is the one opt-out of all cleaning, and there is no switch for bytes alone | S9, ADR-006 |
| **R21** | A redirect where the SDK cannot follow by hand, as in a browser | A request that carries a body refuses every redirect; one without a body is left to the platform | S7, `p0-browser-upload-redirect` |
| **R22** | perl: an exception object a feature hook throws | Masked. The caller gets the SDK's error with the cleaned message, and the hook's own object as its cause | `p0-perl-hook-exception` |

Three more rulings came with them:

- **Text is plain data.** A body that is raw but not binary comes back
  through the ordinary operation as a string under `$body` in the record.
  Only bytes are slots (section 4.1).
- **ADR-006 enters the register now, as Proposed** (section 5.3).
- **The security findings come first**: `p0-error-bytes`,
  `p0-redirect-credentials` and `p0-binary-response`, each from a failing
  test.

R5 and R9 were answered in the maintainer's own words. R5's reading was
then confirmed; R9's reach, everywhere, was put as a second question.

---

## 13. Traps to refuse

Each is a shortcut that will be proposed, and each is how a file feature
goes wrong.

- **A path in a string**, for convenience. This is S1 and it has a CVE
  history.
- **A file named by the server.** S2.
- **Buffering as the default**, with streaming as the option. The default
  is what runs in production.
- **Silently restarting** a transfer that was meant to resume, or silently
  buffering a stream to make it replayable.
- **Joining ranges across versions.** A resumed file that is half of each
  version passes every length check.
- **MD5 or an ETag as integrity.** Neither is a digest a client may rely
  on.
- **Unpacking what was downloaded.** The SDK moves bytes. Archive
  extraction is where path traversal lives, and it is not this feature.
- **Logging a body "for debugging".** The canary exists because this is
  always proposed.
- **A handle in `data()`.** N2. It reads well in one language.
- **New operations to avoid actions.** V2. The model already made this
  decision and pinned it.
- **A vendor extension to mark a file.** apidef reads none, and the example
  API must not need one.
- **A hook per chunk.** The pipeline hooks an operation, not a byte.
- **A sidecar file the caller did not ask for.** R13.
- **Parallel ranges and several ranges per request**, before the single
  case is proven in twenty targets.

---

## 14. Not covered

- **Sequential media types** (event streams, JSON lines, `multipart/mixed`
  as OpenAPI 3.2 describes them). Streams of items, not files; the
  `streaming` feature's ground.
- **Base64 in JSON.** apidef already reads `format: byte` as encoded text.
  A helper that accepts a source for such a field is cheap and separate.
- **GraphQL uploads.**
- **Server-side scanning, quotas, retention.** The example server bounds
  itself and nothing more.
- **Station.** Whether transfers pass through its proxy is its design to
  make.

---

## 15. Sources

- IETF, *Resumable Uploads for HTTP*, draft 15, November 2026:
  <https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-resumable-upload-15>
- tus, *Standardizing Resumable Uploads with the IETF*:
  <https://tus.io/blog/2023/08/09/resumable-uploads-ietf>
- RFC 9110, HTTP Semantics (ranges, conditional requests); RFC 9530,
  Digest Fields; RFC 7578, `multipart/form-data`; RFC 6266,
  `Content-Disposition`; RFC 8620, JMAP; RFC 5023, AtomPub.
- OData Version 4.01, Part 1: Protocol (media entities, stream
  properties).
- OpenAPI 3.2 media types: <https://learn.openapis.org/specification/media-types>,
  <https://redocly.com/blog/openapi-3-2>
- Speakeasy, file streaming and file uploads:
  <https://www.speakeasy.com/docs/sdks/customize/runtime/streaming>,
  <https://www.speakeasy.com/openapi/content/file-uploads>
- A Stainless-generated upload helper:
  <https://app.unpkg.com/openai@7.3.0/files/src/internal/uploads.ts>
- Fern, binary upload support:
  <https://buildwithfern.com/learn/sdks/generators/typescript/changelog/2025/7/17>
- OWASP File Upload Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html>

---

## Appendix A: the trial run

apidef 8.33.1 at `00778c4`, Node 22.23.5, over
`file-transfer-demo-def.yaml`, with the transform steps on and the builders
off, and a guide holding only the two standard includes. The output is
abridged: a JSON body is shown as `json`, a selector is shown only where
it holds more than path parameters, and the request and response
transforms are left out, every one being the default.

```
heuristic01  entities=3 paths=11 methods=24 tags=0 cmps=4
WARN  Create on entity=upload has no route of its own, only the action
      upload, so a create must name it with $action. Set the route's op in
      the guide if it is not a create.

ENTITY episode  ancestors=[["show"]]
  fields: audio:$ANY(ro), id:$STRING!, number:$INTEGER, show_id:$STRING!,
          state:$STRING(ro), title:$STRING!, transcript:$ANY(ro)
  create POST   /api/show/{show_id}/episode/{episode_id}/publish  $action=publish
           rs=json  bf=[publish, why]
  create POST   /api/show/{show_id}/episode
           rb=multipart/form-data fields=[audio(binary, audio/wav), number, title]
           rs=json
  list   GET    /api/show/{show_id}/episode                       rs=json
  load   GET    /api/show/{show_id}/episode/{episode_id}          rs=json
  load   GET    /api/show/{show_id}/episode/{episode_id}/audio    $action=audio
           rs=raw audio/wav binary
           header args=[if_none_match, if_range, range]
  load   GET    /api/show/{show_id}/episode/{episode_id}/transcript  $action=transcript
           rs=raw text/vtt
  remove DELETE /api/show/{show_id}/episode/{episode_id}
  update PUT    /api/show/{show_id}/episode/{episode_id}          rs=json
           bf=[id, number, show_id, title]
  update PUT    /api/show/{show_id}/episode/{episode_id}/audio    $action=audio
           rb=raw audio/wav binary   rs=json
           header args=[if_match, repr_digest]
  update PUT    /api/show/{show_id}/episode/{episode_id}/transcript  $action=transcript
           rb=raw text/vtt   rs=json

ENTITY show
  fields: artwork:$ANY(ro), author:$STRING!, id:$STRING!, language:$STRING,
          name:$STRING!
  create POST   /api/show                       rs=json
  list   GET    /api/show                       rs=json
  load   GET    /api/show/{show_id}             rs=json
  load   GET    /api/show/{show_id}/artwork     $action=artwork
           rs=raw image/png binary   header args=[if_none_match]
  load   GET    /api/show/{show_id}/feed        $action=feed
           rs=raw application/rss+xml
  remove DELETE /api/show/{show_id}
  update PUT    /api/show/{show_id}             rs=json
  update PUT    /api/show/{show_id}/artwork     $action=artwork
           rb=raw image/png binary   rs=json   header args=[if_match]

ENTITY upload
  fields: complete:$BOOLEAN(ro), digest:$STRING, episode_id:$STRING!,
          expires:$STRING(ro), id:$STRING(ro), offset:$INTEGER(ro),
          show_id:$STRING!, size:$INTEGER!, slot:$STRING, type:$STRING
  create POST   /api/upload                     $action=upload   rs=json
           bf=[digest, episode_id, show_id, size, slot, type]
  load   GET    /api/upload/{upload_id}         rs=json
  remove DELETE /api/upload/{upload_id}
  update PATCH  /api/upload/{upload_id}         exist=[id, tus_resumable, upload_offset]
           rb=raw application/offset+octet-stream binary
           header args=[tus_resumable!, upload_offset!]

FLOWS
  BasicEpisodeFlow: create -> list -> update -> load -> remove -> list
  BasicShowFlow:    create -> list -> update -> load -> remove -> list
  BasicUploadFlow:  create -> update -> load -> remove

Both HEAD routes are written to the base guide (op: head: method: *HEAD)
and appear in no entity.
```

---

## Appendix B: transports, per target

**Read** from `ts/project/.sdk/tm/<target>/`, with two exceptions that are
**expected**, taken from each client library's documented behaviour and
exercised by nothing in this survey: a limit marked as the client's
default, and the whole of the last column.

| Target | Client | `$body` accepts today | Response today | Limits in effect | Client can stream |
| --- | --- | --- | --- | --- | --- |
| `ts`, `js` | platform `fetch` | bytes, `Blob`, stream, string; stream buffered | text, then JSON | none set | both ways; request streams only in some engines |
| `go` | `net/http` | `[]byte`, `string`, `io.Reader`; reader buffered | `io.ReadAll`, then JSON | none | both ways |
| `py` | `requests` | `bytes`, `str`, file object; file read in full | decoded as UTF-8, then JSON; bytes that are not UTF-8 raise a transport error | timeout only if set | both ways |
| `php` | cURL, else stream wrappers | string, stream resource; resource read in full | buffered, then JSON | 30 s total, 10 s connect, set | both ways, by callbacks |
| `rb` | `Net::HTTP`, own pool | `String`, IO; IO read in full | buffered, then JSON | the client's defaults | both ways |
| `lua` | LuaSocket, `ltn12` | string only | sink to a table, then JSON | 60 s per wait, set | both ways; the transport is already written on sources and sinks |
| `csharp` | `HttpClient` | `byte[]`, `string`, `Stream`; stream copied to memory | read as a string, lossy for bytes | 100 s total, the client's default | both ways |
| `java` | `java.net.http` | `byte[]`, `String`, `InputStream`; read in full | bytes to a `String` by charset, lossy | none | both ways |
| `kotlin` | `java.net.http` | `ByteArray`, `String`, `InputStream`; read in full | as `java` | none | both ways |
| `scala` | `java.net.http` | `Array[Byte]`, `String`, `InputStream`; read in full | as `java` | none | both ways |
| `clojure` | `java.net.http` | byte array, `String`, `InputStream`; read in full | bytes to a UTF-8 `String`, lossy | none | both ways |
| `swift` | `URLSession`, synchronous behind a semaphore | `String`, or `Data` and `[UInt8]` as a native value | UTF-8 or the empty string, with no error | 60 s per wait, the client's default | both ways, through a delegate or tasks |
| `rust` | `ureq` | string, or bytes as a list of numbers | `into_string`: UTF-8 only | 10 MB, set; no timeout set | both ways |
| `c` | own HTTP/1.1 client over sockets | length-counted string | buffered whole | 32 MiB and 30 s total, set | not until streaming paths are written |
| `perl` | `HTTP::Tiny` | byte string, character string, filehandle; handle slurped | buffered, then JSON | 60 s per wait, the client's default | both ways, by callbacks |
| `elixir` | `:httpc` | a binary | buffered, then JSON | none | both ways |
| `cpp` | none; `system.fetch` required | `std::string` | whatever the supplied transport returns | none | the contract of section 7.3 |
| `zig` | none; `system.fetch` required | string | as `cpp` | none | as `cpp` |
| `ocaml` | none; `system.fetch` required | `Str` | as `cpp` | none | as `cpp` |

No target has a multipart or form encoder. Every target's `test` mock
answers JSON records only and discards `$body`.
