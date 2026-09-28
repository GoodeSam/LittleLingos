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
| `index.html` | The app shell: markup, the 28 `<script src>` tags, and the UI orchestration that is not (yet) a module (~3,500 lines of script — down from ~5,500 before ADR 0009) |
| `app.css` | All styling. Loaded synchronously from `<head>` (render-blocking, so no flash of unstyled content); part of the precached shell |
| `*.js` modules (see below) | One owner per concern: playback, storage, API, review, audio store/provision/loop/marks, reminder, voice, translate-save, custom scenarios, dictionary logic, backup export, app state … |
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

### Inside `index.html` (after ADR 0009, 2026-09-28)

Every concern that could be given a single owner now lives in its own plain-script module,
loaded before the main script, with a CommonJS export for Node and a `root.llXLib` global for
the browser. Modules that need browser or app collaborators receive them through
`create(deps)`; `index.html` builds the instance and leaves `var` aliases so call sites
did not have to change. Tests `require()` the module directly instead of slicing text.

| Module | Owns | Takes via `create(deps)` |
|---|---|---|
| `audio-controller.mjs` | play / pause / resume / fallback-to-speech, one owner per playing thing | `Audio`, `speechSynthesis`, `SpeechSynthesisUtterance` |
| `storage.js` | every `localStorage` read/write, the 11 `ll_*` keys | backend, `onWriteFailed` |
| `api-client.js` | every `/api/*` call, status-code classification | `fetch`, `getAccessCode`, timers |
| `app-state.js` | the 17 pieces of mutable state, installed as `window` accessors (`llState`) | — |
| `review-engine.js` / `review-queue.js` | intervals + scheduling / due list + answer-by-id | `getSaved()`, `persistSaved`, review |
| `audio-store.js` / `audio-playback.js` / `audio-provision.js` / `audio-marks.js` / `audio-loop.js` | IndexedDB clips (voice-keyed) / object-URL cache / generate-on-save / the 🔊⏳⚠ marks / continuous play with pause-resume | `indexedDB`, `getVoice`, `api`, `Audio`, timers … |
| `voice.js` | the voice list, default (Andrew), preset voice (Jenny, bare storage keys) | `storage` |
| `translate-save.js` / `custom-scenarios.js` / `own-words.js` / `transcript-mine.js` | translation ids + saving / self-made scenarios / own-words / transcript mining | `api`, `getSaved()`, `getAge()`, `persistSaved` … |
| `dict-logic.js` / `item-kind.js` / `tap-word.js` | pure dictionary logic / preset-vs-custom classification / tokenising a sentence for tap-to-look-up | `scenarios`, `isCustomScenario` |
| `reminder.js` / `push-open.js` | the scheduled-reminder client (enable / disable / sync after review) / VAPID key decode, deep-link target | `caches`, `Notification`, `serviceWorker`, `crypto`, timers … |
| `access-code.js` / `first-value.js` / `install-env.js` / `data-export.js` | invite code / first-run pick / install environment / backup export & import | `storage` |

**Two rules that only exist because they were broken once** (full list: ADR 0009 迁移规矩, 11 rules):

- Any state a module needs that `index.html` **reassigns** (`savedPhrases`, `translateAge`,
  `reviewQueue` …) is passed as a **getter function**, never as a value — otherwise the module
  keeps working on an array nobody else is looking at after a backup import.
- A `typeof x !== "undefined"` guard around a name that has since moved into a module
  **silently disables the branch** (no error, no red test). `test/no-orphan-modules.test.mjs`
  now refuses any guarded name without an owner; keep it that way.

What is still in `index.html`, by design: screen switching, every `render*`, the scenario screen,
the saved list, the review card, the translate screen, and five leftover marker blocks that hold
the DOM half of a concern whose pure half moved out (`ll:first-value`, `ll:review-engine`,
`ll:tap-word`, `ll:dictionary-lookup`, `ll:push-open`). Text-slicing tests still exist for those.
State changes do **not** trigger repaints automatically; `llState.subscribe()` is the hook for
that when a screen is ready to use it.

Every new module must be added in three places or the offline install breaks: the `<script src>`
tag, `SHELL` in `sw.js`, and `SOURCES` in `scripts/stamp-sw.mjs` (a test checks each).

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
