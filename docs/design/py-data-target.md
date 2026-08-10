# Design: the `py-data` target

Status: **proposal** (2026-08-10). Not implemented.

A generation target producing a Python package for **data analysts in notebooks**
(Google Colab, Jupyter, VS Code notebooks), layered on the sibling `py` SDK. The
deliverable an analyst wants is not "a client" — it is *tables*: one line from API
to a typed `pandas.DataFrame`, with discovery via tab-completion rather than docs.

```python
!pip install voxgig-sdk-acme-data

from acme_data import data
ad = data()                        # auth found automatically (Colab userdata / env)
df = ad.applicants()               # every page, flattened, typed → DataFrame
df[df.status == "accepted"].groupby("country").size()
```

Origin: prospect work. `fair-vid/dreamapply-data-lab` is an analyst org that had to
hand-write `utils/api_client.py` (auth, endpoints, response handling) inside Colab
notebooks before starting their actual job — admissions dashboards. `py-data` is the
generated artefact that deletes that detour.

---

## 1. Positioning: a *consumer* target, not a fork

There were three candidate shapes:

| Shape | Verdict |
|---|---|
| **A. Layered consumer target** — like `go-cli`/`go-mcp`, consumes the sibling `py` SDK in the same repo | **Chosen** |
| B. Fork of `tm/py` + `cmp/py`, refactored | Rejected: duplicates the entity/feature machinery; every `py` fix must be ported forever; parity drift is the known failure mode of forks |
| C. A `dataframe` *feature* on the `py` target | Rejected: features are cross-language by contract (`main: kit: feature: &: target: …`), and a py-only feature muddies that. Also wrong dependency direction — the base client must not depend on pandas |

Shape A is the established pattern: `go-cli.aontu` declares `phase: { entity/feature/
readme/agentguide/test: {active:false} }` and its `Main_go-cli.ts` consumes the `go`
target's output at `../go`. `Main_go-mcp.ts` proves the key enabling fact: **a
Main-only target still has full access to `main.kit.entity`** (it iterates the entity
map and derives names itself — see the `deriveEntityNames` note there about not
relying on another target having run first). So `py-data` can generate *typed,
per-entity* analyst surface without owning the entity phase.

Hard rule inherited from shape A: **`py-data` requires the `py` target in the same
SDK repo** (as `go-cli` requires `go`). `Main_py-data.ts` throws a clear
`SdkGenError` at generate time when `main.kit.target.py` is absent.

The dependency arrow only points one way: `py-data → py`. The `py` target must never
know `py-data` exists.

## 2. What the base `py` target already gets right (and must keep)

These properties are load-bearing for the notebook case and are *why* layering works:

- **Synchronous, `requests`-backed.** Notebooks have a running event loop;
  `asyncio.run()` errors there, and top-level `await` is Colab-only. Sync is correct.
- **One runtime dep** (`requests>=2.33`). Colab reinstalls everything per session;
  the base client staying lean is a feature. Pandas weight goes in `py-data`, where
  Colab happens to preinstall it anyway.
- **`py.typed` + dataclasses + docstrings** — tab-completion and `?` are how analysts
  discover an API.
- **The paging feature** already normalises the server's pagination vocabulary
  (`Link: rel="next"`, `X-Page`/`X-Next-Page`/`X-Total-Count`, body
  `next`/`cursor`/`nextCursor`/`hasMore`) onto `ctx.result.paging`. `py-data` does
  not reimplement any of that — it just *drives* it to exhaustion (§4.3).

No refactor of `tm/py` is required to ship `py-data`. Two small, independently
useful additions to `py` are listed in §8; neither blocks this target.

## 3. Package layout (generated output)

```
py-data/
  pyproject.toml            # name: voxgig-sdk-<slug>-data
  README.md                 # notebook-first quickstart (Main-owned, phase.readme off)
  AGENTS.md / CLAUDE.md     # Main-owned, see §6
  <name>_data.py            # DataClient + data() convenience constructor
  auth.py                   # credential discovery chain (§4.1)
  frames.py                 # records→DataFrame engine: flatten, dtype, repr (§4.2)
  fetch.py                  # drain-the-paging loop, progress, cap (§4.3)
  entity_frames.py          # GENERATED: one accessor per entity (§4.4)
  notebooks/
    quickstart.ipynb        # GENERATED from model examples; Colab "Open in" badge
  test/                     # thin: frames + accessor tests against netsim (§7)
```

`pyproject.toml`:

```toml
dependencies = [
  "voxgig-sdk-<slug>>=X.Y",   # the sibling py SDK
  "pandas>=2.0",
]
```

Yes, pandas is a hard dep *of this package*. The optional-extra dance
(`pip install x[pandas]`) belongs in a general-purpose client; `py-data`'s entire
reason to exist is DataFrames, and an import guard that says "please install pandas"
is worse UX than declaring it. The base `py` package remains one-dep.

Local dev wiring mirrors go-cli's relative replace: the generated test harness
installs the sibling with `pip install -e ../py` (Makefile `test:` target), while
the published wheel depends on the registry name.

## 4. Runtime design

### 4.1 `data()` — zero-ceremony construction

```python
def data(token=None, base_url=None, **opts) -> DataClient
```

Credential discovery, in order, first hit wins, each step logged at debug:

1. explicit arguments
2. `google.colab.userdata.get("<NAME>_TOKEN")` — guarded `try: from google.colab
   import userdata` so the same code runs anywhere; `userdata` raises on missing
   keys, so wrap per-key
3. environment: `<NAME>_TOKEN`, `<NAME>_BASE_URL` (names from `model.NAME`)
4. fail with an error message that *teaches*: shows the exact
   `userdata.set(...)` / `os.environ[...]` lines for this SDK, not a generic
   "credentials not found"

Multi-tenant APIs (DreamApply-style `https://<instance>.example.com/api/`) make
`base_url` a first-class, error-messaged parameter, not an afterthought: when the
model's servers block contains a `$$var$$` placeholder, `data()` requires
`base_url` (or its env var) and says so by name.

`DataClient` wraps — never subclasses — the base SDK client. `ad.sdk` exposes the
wrapped client for the 10% of cases where the analyst needs full control, which is
also the escape hatch that keeps `py-data`'s surface small. Every accessor kwarg is
passed through to the underlying op unchanged.

### 4.2 `frames.py` — records to DataFrame

The one genuinely new runtime component. Pipeline per accessor call:

1. **Collect** dataclass/dict records from the base client (via §4.3).
2. **Flatten** one level of nesting with `pandas.json_normalize(sep=".")` →
   `model_card.author` style columns. One level only, by default: full recursive
   flattening turns deep objects into unusable 400-column frames. Deeper structures
   stay as `object` columns holding dicts; `flatten="none" | 1 | "full"` kwarg.
3. **Type** columns from the entity model's field list via a new canon column
   (§5.1): nullable pandas dtypes (`Int64`, not `int64` — API data has nulls;
   `boolean`, `string`, `Float64`). `$DATE`-ish sentinels get
   `pandas.to_datetime(..., errors="coerce", utc=True)`.
4. **Order**: model-declared (required-first) field order, extras appended — stable
   column order across calls beats alphabetical.

Also here: `records_df(anything)` — public helper for one-off shaping of arbitrary
op results (non-entity endpoints, action ops).

### 4.3 `fetch.py` — eager by default

Analysts want the whole table now; lazy iterators are application ergonomics. The
drain loop calls the base list op repeatedly, feeding `result.paging`'s
cursor/next-page back in (the paging feature already accepts per-call cursor/page
via ctrl paging — that hook exists for exactly this) until exhausted.

Guard rails, because "eager" against an unbounded collection is a footgun:

- `limit=` kwarg (row cap, default `None` = all)
- `max_pages=` safety default (e.g. 1000) with a loud warning when hit, so a
  mis-signalling server can't loop forever
- tqdm-style progress **iff** running in an interactive/IPython context and the
  fetch crosses a page threshold; plain log line otherwise; never a hard tqdm dep

### 4.4 `entity_frames.py` — the generated surface

One accessor per entity **that has a `list` op** (op presence read from the entity
model, same per-op filtering discipline as go-mcp's doc examples):

```python
def applicants(self, *, flatten=1, limit=None, dtype=True, **match) -> pd.DataFrame:
    """All applicants as a DataFrame. Columns: name (str, req), status (str), ..."""
```

- Named with the entity's **plural** (the model already carries name derivations;
  a frame of many rows is plural by nature).
- Docstring lists real column names + dtypes — generated from the field model, so
  tab-completion plus `?` replaces reference docs.
- Entities *without* a list op get a `show`-based `entity(id) -> pd.Series` accessor
  only when `show` exists; otherwise they are omitted and the README says why.
- `**match` passes through as query/filter args to the underlying op, untyped —
  the model does not currently describe filter params well enough to type them
  honestly (recorded as a non-goal, §9).

### 4.5 Notebook rendering

`DataFrame` renders itself — that is most of the battle won for free. Additionally:

- `data()`'s client object gets a `_repr_html_` showing SDK name/version, base URL
  (token masked), entity accessor list — the "what do I have?" cell.
- Errors: base SDK exceptions pass through untouched (no wrapping — tracebacks that
  end inside wrapper frames are how libraries lose analyst trust), but `py-data`
  raises its *own* pre-flight errors (auth, base_url) as short, actionable messages.

## 5. Generator-side changes (sdkgen itself)

### 5.1 `helpers/canonType.ts` — a pandas dtype column

Add a parallel map (not a new `CanonLang` — `py-data` is not a language):

```ts
const PANDAS_DTYPE: Record<string, string> = {
  STRING: 'string', INTEGER: 'Int64', NUMBER: 'Float64', BOOLEAN: 'boolean',
  DATE: 'datetime64[ns, UTC]', DATETIME: 'datetime64[ns, UTC]',
  OBJECT: 'object', ARRAY: 'object', /* unknown */ ANY: 'object',
}
```

Nullable dtypes throughout (same reasoning as the kotlin column note: API data is
optional-by-default, so the column is already-nullable).

### 5.2 `model/target/py-data.aontu`

Modelled directly on `go-cli.aontu`:

```
main: kit: target: 'py-data': {
  title: 'Python Data'
  ext: py
  comment: line: "#"
  module: name: '$$name$$'

  # Consumer target: per-entity/feature/readme/test generation off;
  # Main_py-data emits the whole package (see go-cli precedent).
  phase: {
    entity:     { active: false }
    feature:    { active: false }
    readme:     { active: false }
    agentguide: { active: false }
    test:       { active: false }
  }

  deps: {
    'pandas': { active: true, version: '2.0' }
    # sibling py SDK dep is emitted by Main from model name, not declared here
  }
}

main: kit: feature: &: target: 'py-data': deps: &: { kind: *'prod' | string }

main: kit: target: 'py-data': publish: {
  tag: { active: true }
  registry: { state: 'pending', active: false, name: 'pypi',
              url: 'https://pypi.org', vault: { recipe: 'pypi', alias: 'pypi' } }
}
```

Note `readme`/`agentguide`/`test` phases are **off but the artefacts still exist** —
Main owns them, exactly as go-cli/go-mcp own theirs. The standard Readme/Test cmps
assume an SDK-shaped package and would generate wrong content here.

### 5.3 `src/cmp/py-data/` components

- `Main_py-data.ts` — orchestrates everything in §3. Iterates
  `main.kit.entity` go-mcp-style (including the deriveEntityNames trick), filters
  per-op, emits `entity_frames.py`, README, AGENTS.md, quickstart.ipynb, tests.
  Throws `SdkGenError` if `main.kit.target.py` is absent.
- `fragment/` — accessor fn, README sections, notebook JSON cells.

`.ipynb` is just JSON; jostraca templating handles it. Cells: install → auth setup
(both Colab-userdata and env variants) → first frame → a groupby → an
"escape hatch to ad.sdk" cell. Keep outputs stripped.

### 5.4 `tm/py-data/` templates

Static runtime files: `frames.py`, `fetch.py`, `auth.py` cores, Makefile, LICENSE,
test harness. Same split as everywhere: `tm/` = copied scaffolding, `cmp/` =
model-driven emission.

### 5.5 `helpers/packageMeta.ts`

- title `'Python Data'`; install `pip install voxgig-sdk-<slug>-data`
- package name `voxgig-sdk-<slug>-data`; publish mechanism `'registry'` (pypi),
  same pending state as `py`
- repo path `<repo>/py-data`

### 5.6 Nothing else

No `Root.ts` change (the phase gate generalises already — that was the point of the
phase map). No apidef change. No base-`py` change required (§8 items are optional).

## 6. AGENTS.md / CLAUDE.md content

This target has an unusually strong agent story: Colab's Data Science Agent and
Gemini now write analyst code, and an agent facing a spec-less, package-less API
hallucinates endpoints. The generated guide should therefore document, tersely:
the accessor list with column schemas, the auth discovery order, the
`ad.sdk` escape hatch, and the paging/`limit` semantics — i.e. exactly the facts an
agent needs to write a correct analysis cell first try.

## 7. Testing

- **Unit (generated, per SDK):** `frames.py` against fixture records — flatten
  depth, nullable dtype coercion (int column with nulls stays `Int64`), date
  parsing, column order. Accessor tests run against the base SDK's **netsim**
  feature, which exists precisely so generated tests need no live API.
- **Corpus (sdkgen `ts/test`):** py-data joins the target matrix; assert the
  generated `entity_frames.py` for the corpus model contains one accessor per
  listable entity with the expected dtype map.
- **Notebook smoke:** `jupyter nbconvert --execute quickstart.ipynb` in CI with
  netsim env vars set — a broken quickstart notebook is a broken product.
- **Colab reality check (manual, once per release):** the `google.colab.userdata`
  path cannot be CI'd honestly; keep it a release checklist line.

## 8. Optional follow-ups in the base `py` target (not blockers)

1. `_repr_html_` on entity dataclass instances — nearly free, benefits everyone.
2. Auth-from-env convenience in the base client constructor. Today's explicit
   config is fine for applications; `py-data` papers over it regardless.

## 9. Non-goals

- **Async client** — wrong tool in notebooks; the sync base is the feature.
- **Plotting helpers** — `df.plot()` exists; anything more is opinion.
- **Typed filter/query params** — the model doesn't carry param schemas richly
  enough to type them honestly; `**match` passes through untyped until it does.
- **Write-path sugar** (bulk create/update from a DataFrame) — v2 at the earliest;
  analysts read overwhelmingly more than they write, and generated bulk-write
  against a prospect's production API is a liability, not a feature.
- **polars** — watch it; the frames.py seam is where a `backend=` kwarg would go,
  which is another reason frames.py is its own module.

## 10. Sales-process tie-in

For data-product prospects (DreamApply, Graphite Note class), `py-data` changes the
demo email's first code block from client construction to a three-line
"API → DataFrame → groupby" — the artefact their own users are visibly hand-rolling
today (`fair-vid/dreamapply-data-lab`, `utils/api_client.py`). Add py-data to the
default target set only for prospects tagged data-heavy; it is noise for a payments
API.
