# LittleLingos 小小灵语

A bilingual PWA that teaches Chinese-speaking parents the English a native
parent would actually say to a 0–6 year-old in real daily-life moments.
30 scenarios × 4 age bands (`0-1`, `1-2`, `2-3`, `3-6`), ~600 phrases, each
with native-parent English, aligned Chinese, an action tip, and generated
audio. Live at <https://littlelingos.netlify.app>.

## Architecture

Static, dependency-free frontend:

| File | Role |
|---|---|
| `index.html` | The whole app UI + logic (single file, inline script) |
| `scenarios.js` | The product data: 30 scenarios of phrase objects (see `.claude/rules/03-phrase-schema.md`) |
| `sw.js` | Service worker: precached shell, cache-first audio, network-first shell/data. `CACHE` is mechanically stamped — never hand-edit (see below) |
| `audio/` | Azure Neural TTS mp3s, named `<id>_normal.mp3` / `<id>_slow_wbw.mp3` |
| `netlify/` | The `/api/translate` serverless function (AI child-English translation) |

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
- The only data that leaves the device is the free text a parent submits on
  the translate screen, sent to `/api/translate` (a Netlify function that
  calls an AI translation backend). The UI carries a just-in-time notice
  telling parents not to include personal information. Voice input uses the
  browser's Web Speech API, which may route audio through the browser
  vendor's speech service while dictating.

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
