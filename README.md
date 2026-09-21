# LittleLingos 小小灵语

A bilingual PWA that teaches Chinese-speaking parents the English a native
parent would actually say to a 0–6 year-old in real daily-life moments.
30 scenarios × 4 age bands (`0-1`, `1-2`, `2-3`, `3-6`), ~600 phrases, each
with native-parent English, aligned Chinese, an action tip, and generated
audio. Live at <https://littlelingos.netlify.app>.

## Architecture

Static frontend; one runtime dependency on the server side (`@netlify/blobs`, for the reminder store).

| File | Role |
|---|---|
| `index.html` | The whole app UI + logic (single file, inline script, ~5,500 lines of script) |
| `scenarios.js` | The product data: 30 scenarios of phrase objects (see `.claude/rules/03-phrase-schema.md`) |
| `dictionary-words.js` | The curated word list the dictionary answers from before it ever asks the server |
| `sw.js` | Service worker: precached shell, cache-first audio, network-first shell/data, push handling. `CACHE` is mechanically stamped — never hand-edit (see below) |
| `audio/` | Azure Neural TTS mp3s, named `<id>_normal.mp3` / `<id>_slow_wbw.mp3` |
| `netlify/functions/` | Four HTTP functions and one scheduled one — see below |

### Server side

All four HTTP functions sit behind the invite code; refusal happens **before** any paid upstream call.

| Function | Route | Upstream | What it does |
|---|---|---|---|
| `translate.mjs` | `POST /api/translate` | Gemini, OpenAI fallback | Chinese → what a native parent would say, per age band (or adult register) |
| `dictionary.mjs` | `POST /api/dictionary` | Gemini | English word → lemma + senses, only for words the curated list lacks |
| `tts.mjs` | `POST /api/tts` | Azure Speech | One sentence → mp3 bytes, stored on the device by the client |
| `reminder.mjs` | `POST /api/reminder` | Web Push services | Enable / note-a-review / disable the scheduled reminder |
| `reminder-cron.mjs` | scheduled (every 5 min, production only) | — | Wakes `reminder.mjs` to send what is due |
| `_shared/` | — | — | `access.mjs` (invite-code check), `push.mjs` (signing a push), `reminder-rule.mjs` (when a reminder is due), `reminder-store.mjs` (the Blobs store) |

The request/response shapes between `index.html` and the first three are pinned by
`test/api-contract.test.mjs`, which runs the page's real request through the real
function and hands the real response back to the page's real parser.

### Inside `index.html`

About half the script lives in 19 marker blocks — `/* ll:<name>:start */ … /* ll:<name>:end */` —
and 29 test files lift those blocks out by their markers and run them in a `node:vm` sandbox.
Move or rename a marker and those tests stop finding their module.

What that does **not** give you:

- The sandbox only catches a missing collaborator on a path a test actually executes.
- Several blocks reach outside themselves through `typeof x === "function"` guards
  (13 at last count); those dependencies are invisible to the sandbox.
- One block is nested inside another (`ll:voice` within `ll:audio-provision`).
- **The other half of the script is in no block at all** — screen switching, the scenario
  screen, saving, the saved list, review, and the translate screen. It is organised by
  section comments and position, not by anything a test can isolate. The highest-coupling
  spot is the saved list, which coordinates the loop, stored-clip addresses, audio marks
  and rendering in one place.

No plan to split the file for its length. The rule used here: carve out a block when a piece
changes **for a different reason** than its neighbours, and give it a sandbox test when you do.

## Development setup

Requires Node ≥ 18 and Python ≥ 3.9 (for the crew integrity suite).

```sh
python3 -m pip install -r requirements-dev.txt   # pytest, pinned
npx serve .                                      # or any static file server
```

## Testing & deploy gate

```sh
node test/run.mjs           # deterministic pyramid: data gate, sw stamp,
                            # voice-input + sw behavior tests, crew suite
node test/run.mjs --codex   # + the two-lens Codex product critique
                            # (rules/08-strict-product-critique.md)
```

Both must pass before deploy. GitHub auto-deploy is broken; deploy manually
after the gate:

```sh
netlify deploy --prod --no-build
```

## Service-worker cache refresh

`sw.js`'s `CACHE` constant is a content hash over every precached asset
(`index.html`, `scenarios.js`, `manifest.json`, `icons/*`, all of `audio/`).
After changing any of them run:

```sh
node scripts/stamp-sw.mjs          # restamp
node scripts/stamp-sw.mjs --check  # verify (part of test/run.mjs)
```

Old `ll-*` caches are deleted on activate; a stale stamp means installed
clients keep serving old content indefinitely.

## Data handling

- Everything is local-first: saved phrases, review scheduling, and usage live
  in `localStorage` on the device; audio and the app shell are cached by the
  service worker for offline use.
- Two surfaces send data off-device, both disclosed in the UI at the point of
  use, just-in-time: the translate screen sends the free text a parent
  submits to `/api/translate` (a Netlify function that calls an AI
  translation backend), and the home-screen dictionary lookup sends a typed
  word to `/api/dictionary` (a Netlify function backed by an AI dictionary
  service) — but ONLY when that word is not already in the app's built-in
  curated word list. A curated hit is resolved entirely on-device and never
  touches the network. Neither surface sends anything else (no saved
  phrases, no usage history). The translate screen's notice tells parents
  not to include personal information; the dictionary lookup's notice states
  the curated-vs-new-word distinction above. Voice input uses the browser's
  Web Speech API, which may route audio through the browser vendor's speech
  service while dictating.

## Recovery

- **Corrupt local state**: saved-list parsing is defensive (bad entries are
  dropped), but clearing site data in the browser resets everything safely.
- **Bad deploy**: redeploy the previous commit with
  `netlify deploy --prod --no-build`; the fresh `CACHE` stamp on the old
  content will evict the bad version from installed clients on next load.

## The crew

The repo is operated by a Claude Code agent crew (single interface:
`ada-ceo`) with an independent Codex-judged critique gate. The contract lives
in `.claude/rules/` — start with `00-five-pillars.md`.
