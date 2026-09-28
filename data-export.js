// 备份与恢复的唯一主人（ADR 0009 第九块；原 index.html 的 ll:data-export 块）。
// 导出 JSON / CSV、读回来、合并场景与句子——整块 379 行**零外部依赖**，原样搬出，
// 连注释一字未改；下面就是它原来的说明。
//
// 这一块为什么最该有唯一一份：家长的收藏和复习进度只在手机上，备份是唯一的退路
// （ADR 0004「只做加法」）。同一个格式有两份实现，哪天改了一处没改另一处，
// 导出的文件就再也读不回来——而这件事要等到家长换手机那天才会发现。
// 纯的：不碰 document / window / 存储 / 网络。普通脚本 + CommonJS 出口（同 storage.js）。
(function (root) {
  "use strict";

  // Pure logic for taking a backup and putting one back. Touches neither the
  // DOM nor localStorage so test/data-export.test.mjs can run it in a bare vm
  // context; the surrounding UI functions do the I/O.
  //
  // Why this exists: on iOS a home-screen PWA and Safari at the same URL get
  // SEPARATE storage. A parent's saved phrases and review progress live in
  // exactly one place — that PWA's sandbox — with no second copy anywhere.
  // Delete the icon and months of work are gone, with no way back.
  //
  // Why restoring MERGES instead of overwriting: the backup file is history,
  // the device is the present. Letting an older file overwrite this device
  // would silently discard review progress made since the backup — and there
  // is no undo, because the thing it overwrote was the only copy.
  const EXPORT_SCHEMA = 1;
  const EXPORT_APP = "LittleLingos";

  // A record is restorable only if we can key it. Everything else about a saved
  // item is optional or reconstructible; the id is not — without it the item
  // can't be de-duplicated on merge, so it would multiply on every restore.
  function isRestorableRecord(r) {
    return !!r && typeof r === "object" && !Array.isArray(r)
        && typeof r.id === "string" && r.id.length > 0;
  }

  // `scenarios` is ADDITIVE and the schema number stays at 1 on purpose.
  // parseImportPayload() refuses a schema it does not recognise — guessing at an
  // unknown shape writes garbage into the only copy of a parent's data — so
  // bumping it would have rejected every backup file already on a parent's disk.
  // An older build reading a newer file simply ignores the extra field.
  function buildExportPayload({ saved, age, scenarios }) {
    return {
      schema: EXPORT_SCHEMA,
      app: EXPORT_APP,
      // ISO 8601 so a parent holding three backups can tell which is newest
      // without opening them.
      exportedAt: new Date().toISOString(),
      age: typeof age === "string" ? age : null,
      // rv (review progress) rides along inside each record — dropping it would
      // restore the phrases but silently reset months of spaced repetition.
      saved: Array.isArray(saved) ? saved.filter(isRestorableRecord) : [],
      // Without these, a restored phrase tagged custom_<id> points at a scenario
      // that does not exist: the sentence survives in the data and disappears
      // from the screen, with nothing to tell the parent anything went wrong.
      // Always an array, never absent — one shape for the importer to handle.
      scenarios: Array.isArray(scenarios) ? scenarios.filter(isRestorableScenario) : [],
    };
  }

  // A scenario with no id cannot own phrases; one with no name is a tile the
  // parent cannot identify.
  function isRestorableScenario(x) {
    return !!x && typeof x === "object"
      && typeof x.id === "string" && x.id
      && typeof x.name === "string" && x.name.trim();
  }

  // Returns {ok:true, payload} or {ok:false, error}. The error codes are what
  // the UI turns into a specific message — "this file isn't from this app" is
  // actionable, "import failed" is not.
  function parseImportPayload(text) {
    let data;
    try { data = JSON.parse(text); }
    catch { return { ok: false, error: "not-json" }; }

    // A bare array or number parses fine but is not an export file.
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, error: "not-json" };
    }
    if (data.app !== EXPORT_APP) return { ok: false, error: "wrong-app" };
    // Refuse a schema we don't know rather than guessing at the shape: a wrong
    // guess writes malformed records into the only copy of the parent's data.
    if (data.schema !== EXPORT_SCHEMA) return { ok: false, error: "unknown-schema" };
    if (!Array.isArray(data.saved)) return { ok: false, error: "no-saved" };
    // Optional, and never fatal. A backup is the parent's only copy; refusing
    // the whole file because one secondary field is malformed gambles their
    // sentences on it. Missing or broken means "no custom scenarios".
    data.scenarios = Array.isArray(data.scenarios)
      ? data.scenarios.filter(isRestorableScenario) : [];

    return {
      ok: true,
      payload: {
        age: typeof data.age === "string" ? data.age : null,
        // Individual junk records are dropped, not fatal — one bad row must
        // never cost the parent the other 200 good ones.
        saved: data.saved.filter(isRestorableRecord),
        // Always present, already filtered above. Callers get one shape whether
        // the file predates custom scenarios or not.
        scenarios: data.scenarios,
      },
    };
  }

  // Phrases that came back pointing at a scenario that is not here.
  //
  // Two ways it happens, neither hypothetical. A CSV backup carries each
  // phrase's `scenario` column — custom_<id> included — but the format has
  // nowhere to put the scenario's name and icon, so a CSV restore brings back
  // every self-made phrase tagged for a scenario that does not exist. And a JSON
  // backup with a damaged `scenarios` field is read as "no custom scenarios"
  // rather than rejected, on purpose: it is the parent's only copy, and refusing
  // it over a secondary field gambles their sentences on it.
  //
  // They are not lost either way — 全部收藏 shows everything. But the tag points
  // at nothing, and a scenario recreated later gets a fresh id, so those phrases
  // would never rejoin it. Dropping the tag is what deleteCustomScenario()
  // already does: keep the phrase, keep its review progress, lose only the
  // grouping that has no counterpart.
  function healScenarioTags(phrases, scenarios) {
    const list = Array.isArray(phrases) ? phrases : [];
    const live = new Set((Array.isArray(scenarios) ? scenarios : [])
      .filter(x => x && typeof x.id === "string")
      .map(x => "custom_" + x.id));
    let healed = 0;
    for (const p of list) {
      if (!p || typeof p.scenario !== "string") continue;
      // Preset scenarios and the two general buckets are not this mechanism's
      // business — only custom_ tags can be orphaned this way.
      if (!p.scenario.startsWith("custom_")) continue;
      if (live.has(p.scenario)) continue;
      p.scenario = "__translate__";
      healed++;
    }
    return { phrases: list, healed };
  }

  // Same stance as mergeSaved(): importing ADDS what is missing, it does not
  // replace what this device already has. A name that already exists counts as
  // present even under a different id — the same scenario created separately on
  // two phones would otherwise restore as two identical-looking tiles.
  function mergeScenarios(existing, incoming) {
    const merged = Array.isArray(existing) ? existing.slice() : [];
    const seenId = new Set(merged.map(x => x && x.id));
    const seenName = new Set(merged.map(x => x && String(x.name || "").trim()));
    // Which local scenario an incoming one was folded into. Without this, the
    // phrases that came with a skipped scenario still carry ITS id, find nothing
    // under that id, and get filed into the general bucket — a parent who made
    // 「去医院」 on two devices loses the grouping on restore, silently, while
    // the phrases and their review progress survive.
    const byName = new Map(merged.map(x => [String(x && x.name || "").trim(), x && x.id]));
    const aliases = {};
    let added = 0, skipped = 0;
    for (const sc of (Array.isArray(incoming) ? incoming : [])) {
      if (!isRestorableScenario(sc)) { skipped++; continue; }
      const name = String(sc.name).trim();
      if (seenId.has(sc.id)) { skipped++; continue; }
      if (seenName.has(name)) {
        const keptId = byName.get(name);
        if (keptId && keptId !== sc.id) aliases["custom_" + sc.id] = "custom_" + keptId;
        skipped++;
        continue;
      }
      merged.push(sc);
      seenId.add(sc.id);
      seenName.add(name);
      byName.set(name, sc.id);
      added++;
    }
    return { merged, added, skipped, aliases };
  }

  // Rewrite incoming phrases onto the scenario they were folded into. Runs
  // BEFORE healScenarioTags — reversed, a phrase that belongs in a same-named
  // local scenario is judged an orphan first and loses its tag for good.
  //
  // That ordering is the whole point and it is not self-evident from either
  // function alone, so it is pinned by a test and recorded in ADR 0004. If you
  // are here to refactor the import path, read that first: the failure mode is
  // silent, and what it costs a parent is the grouping they built by hand.
  function applyScenarioAliases(phrases, aliases) {
    if (!Array.isArray(phrases) || !aliases) return;
    for (const p of phrases) {
      if (!p || typeof p.scenario !== "string") continue;
      const to = aliases[p.scenario];
      if (to) p.scenario = to;
    }
  }

  // Merge, never overwrite. An id already on this device wins over the backup's
  // copy of it. Returns a NEW array — callers pass their live savedPhrases in
  // and must not have it mutated under them mid-merge.
  function mergeSaved(existing, incoming) {
    const base = (Array.isArray(existing) ? existing : []).filter(isRestorableRecord);
    const have = new Set(base.map(r => r.id));
    const merged = base.slice();
    let added = 0, skipped = 0;
    for (const r of (Array.isArray(incoming) ? incoming : [])) {
      if (!isRestorableRecord(r)) continue;
      if (have.has(r.id)) { skipped++; continue; }
      have.add(r.id);
      merged.push(r);
      added++;
    }
    return { merged, added, skipped };
  }

  // ── CSV backup ─────────────────────────────────────────
  // A second format alongside the JSON one, for a parent who wants to actually
  // look at what they saved. JSON is the durable copy; CSV is the readable one.
  //
  // CSV is the more fragile of the two, and deliberately so: opening it in
  // Excel and pressing save can silently rewrite a 13-digit timestamp as
  // 1.7256E+12. parseCsvBackup() drops any record it can't read back as a
  // number rather than guessing at a date — a wrong due date is worse than a
  // missing record, because the parent would never notice it.
  //
  // Columns are fixed. The three saved shapes carry different fields (scenario
  // phrases have tier/why/next/fallback, translations have source, dictionary
  // words have senseLabel and no age band at all), so a record's missing fields
  // export as empty and come back absent — never as the string "undefined".
  // Every line carries its kind in the first column, so the reader never has to
  // infer one from the shape of the row. That buys two things a plain table
  // can't have at once: the app-wide age band gets a row of its own (kind
  // "meta") without pretending to be a phrase with a missing id, and an empty
  // library still round-trips its settings.
  const CSV_COLUMNS = [
    "rowType", "id", "en", "zh", "scenario", "age", "tier",
    "tip", "why", "next", "fallback", "senseLabel", "source",
    // `name`/`icon` belong to scenario rows only. The alternative was accepting
    // that a CSV restore always drops every self-made grouping — the rowType
    // column exists precisely so the format can grow a fifth kind of row.
    "name", "icon",
    "savedAt", "rv_s", "rv_due", "currentAge",
  ];
  const CSV_NUMERIC = new Set(["savedAt", "rv_s", "rv_due"]);

  // A quoted CSV cell cannot tell "field absent" from "field present but
  // empty" — both read back as "". Rather than guessing per column, each kind
  // declares which fields belong to it: a field IN the list is restored even
  // when empty (an AI translation's `tip: ""` is a real stored value, since
  // saveTranslation writes `tip: r.tip || ""`), and a field not in the list is
  // ignored no matter what the cell holds. Absence is decided by the record's
  // kind, not inferred from emptiness.
  const CSV_FIELDS_BY_TYPE = {
    phrase:     ["id", "en", "zh", "scenario", "age", "tier", "tip", "why", "next", "fallback"],
    translation:["id", "en", "zh", "scenario", "age", "tip", "source"],
    dictionary: ["id", "en", "zh", "scenario", "tip", "senseLabel"],
  };

  // Which kind a saved record is. Mirrors the three save paths: saveTranslation
  // stamps scenario "__translate__", buildDictSaveEntry stamps "__dict__", and
  // everything else came from scenarios.js.
  function csvRowType(r) {
    if (r.scenario === "__translate__" || (typeof r.id === "string" && r.id.startsWith("t_"))) return "translation";
    if (r.scenario === "__dict__") return "dictionary";
    return "phrase";
  }

  // Quote every field unconditionally: a bare field is only safe if it contains
  // no comma, quote, CR or LF, and phrase text contains all four. Doubling the
  // inner quote is the CSV spec's own escape.
  function csvCell(v) {
    return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  }

  function csvLine(cells) {
    return CSV_COLUMNS.map(col => csvCell(cells[col])).join(",");
  }

  function buildCsvBackup({ saved, age, scenarios }) {
    const rows = [
      CSV_COLUMNS.map(csvCell).join(","),
      // The settings row. It is a legitimate kind of row, not a phrase with
      // fields missing, so a clean file reports zero damage even when the
      // library is empty.
      csvLine({ rowType: "meta", currentAge: typeof age === "string" ? age : "" }),
    ];
    // Before the phrases: a reader scanning the file top to bottom meets the
    // scenario before the sentences that reference it.
    for (const sc of (Array.isArray(scenarios) ? scenarios : []).filter(isRestorableScenario)) {
      rows.push(csvLine({
        rowType: "scenario", id: sc.id, name: sc.name,
        icon: sc.icon || "", savedAt: sc.createdAt,
      }));
    }
    for (const r of (Array.isArray(saved) ? saved : []).filter(isRestorableRecord)) {
      const type = csvRowType(r);
      const cells = { rowType: type };
      for (const col of CSV_FIELDS_BY_TYPE[type]) cells[col] = r[col];
      if (r.rv && typeof r.rv.s === "number")   cells.rv_s   = r.rv.s;
      if (r.rv && typeof r.rv.due === "number") cells.rv_due = r.rv.due;
      if (typeof r.savedAt === "number")        cells.savedAt = r.savedAt;
      rows.push(csvLine(cells));
    }
    // BOM first: without it Excel decodes UTF-8 as the local codepage and every
    // Chinese field arrives as mojibake.
    return "﻿" + rows.join("\r\n") + "\r\n";
  }

  // Split CSV text into rows of fields. Hand-rolled because a field may itself
  // contain a comma, a quote, or a newline — split(",") corrupts all three.
  function csvRows(text) {
    const out = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c !== '"') { field += c; continue; }
        if (text[i + 1] === '"') { field += '"'; i++; continue; }  // "" -> literal "
        inQuotes = false;
        continue;
      }
      if (c === '"') { inQuotes = true; continue; }
      if (c === ",") { row.push(field); field = ""; continue; }
      if (c === "\r" && text[i + 1] === "\n") { i++; row.push(field); out.push(row); row = []; field = ""; continue; }
      if (c === "\n" || c === "\r") { row.push(field); out.push(row); row = []; field = ""; continue; }
      field += c;
    }
    if (field !== "" || row.length) { row.push(field); out.push(row); }
    return out;
  }

  function parseCsvBackup(text) {
    const rows = csvRows(String(text || "").replace(/^﻿/, ""));
    if (!rows.length) return { ok: false, error: "empty" };

    const header = rows[0];
    // Identify the file by its columns. Anything without them — another app's
    // export, or a JSON file fed to the wrong reader — is refused outright
    // rather than half-imported as one very long row.
    for (const required of ["rowType", "id", "en", "savedAt", "rv_due"]) {
      if (!header.includes(required)) return { ok: false, error: "wrong-columns" };
    }
    const idx = {};
    header.forEach((h, i) => { idx[h] = i; });

    const saved = [], scenarios = [];
    let dropped = 0, age = null;

    for (const row of rows.slice(1)) {
      // A short row means the file was truncated or a spreadsheet rewrote it;
      // reading it would silently shift every value one column left.
      if (row.length !== header.length) { dropped++; continue; }

      const get = col => (idx[col] === undefined ? "" : row[idx[col]]);
      const type = get("rowType");

      if (type === "meta") { age = get("currentAge") || age; continue; }
      // Handled before the numeric check below: a scenario row has no savedAt or
      // rv_due, and would otherwise be counted as a damaged phrase.
      if (type === "scenario") {
        const sc = { id: get("id"), name: get("name"), icon: get("icon") || "📌" };
        const created = get("savedAt");
        if (/^\d+$/.test(created)) sc.createdAt = Number(created);
        // A half-written scenario row is skipped, not fatal, and not counted as
        // damage: the phrases it would have grouped are still restorable.
        if (isRestorableScenario(sc)) scenarios.push(sc);
        continue;
      }
      if (!CSV_FIELDS_BY_TYPE[type]) { dropped++; continue; }

      const id = get("id");
      if (!id) { dropped++; continue; }

      // Excel turns a 13-digit timestamp into 1.7256E+12 on save. Number()
      // would happily accept that and hand back a plausible-looking wrong date,
      // so require the text to be plain digits.
      const nums = {}; let bad = false;
      for (const col of CSV_NUMERIC) {
        const raw = get(col);
        if (!/^\d+$/.test(raw)) { bad = true; break; }
        nums[col] = Number(raw);
      }
      if (bad) { dropped++; continue; }

      // The row's kind decides which fields it has. A field in the list is
      // restored even when empty; one that isn't is ignored regardless.
      const rec = {};
      for (const col of CSV_FIELDS_BY_TYPE[type]) rec[col] = get(col);
      rec.savedAt = nums.savedAt;
      rec.rv = { s: nums.rv_s, due: nums.rv_due };
      saved.push(rec);
    }

    // `scenarios` is always present, empty for a file predating them, so the
    // importer has one shape to handle whichever format it read.
    return { ok: true, payload: { age, saved, scenarios, dropped } };
  }

  var api = { EXPORT_SCHEMA: EXPORT_SCHEMA, EXPORT_APP: EXPORT_APP, CSV_COLUMNS: CSV_COLUMNS, CSV_NUMERIC: CSV_NUMERIC, CSV_FIELDS_BY_TYPE: CSV_FIELDS_BY_TYPE, isRestorableRecord: isRestorableRecord, buildExportPayload: buildExportPayload, isRestorableScenario: isRestorableScenario, parseImportPayload: parseImportPayload, healScenarioTags: healScenarioTags, mergeScenarios: mergeScenarios, applyScenarioAliases: applyScenarioAliases, mergeSaved: mergeSaved, csvRowType: csvRowType, csvCell: csvCell, csvLine: csvLine, buildCsvBackup: buildCsvBackup, csvRows: csvRows, parseCsvBackup: parseCsvBackup };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llExport = api;                                                    // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
