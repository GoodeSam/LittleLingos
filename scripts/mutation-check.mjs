#!/usr/bin/env node
// Breaks the product on purpose, one way at a time, and checks that a test
// notices.
//
//   node scripts/mutation-check.mjs           run them all
//   node scripts/mutation-check.mjs 3         run only mutant #3
//
// WHY. A green suite says the tests passed. It does not say they would have
// failed had the code been wrong — and in the 2026-09 deliveries they often
// would not have. Every defect found that month was caught by review, by a
// wiring guard, or by walking the data flow; none by a failing test. Five
// assertions turned out to match a pattern wider than the thing they were
// supposed to verify, one of which (`/"scenario"/`, matching a column name in
// the header row) would have passed against a build that emitted no scenario
// rows at all.
//
// Probing with a do-nothing stub caught some of that, but a stub is one
// mutation and real mistakes are usually half-right: the export updated and
// the import forgotten, the check placed one branch too late, the claim staked
// before the await instead of after. Each mutant below is a real or
// near-miss defect from that month, rewritten as a one-line edit.
//
// A SURVIVING MUTANT IS THE FINDING. It means the suite would ship that bug.
//
// Two shapes of false green this is aimed at, both observed here:
//   · same-source round trip — export and import agreeing on the same error,
//     so `export → import` stays green while the file on disk is wrong
//   · source-regex assertions — satisfied by dead code, or by a comment
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = join(ROOT, "index.html");

// Each mutant names the test that MUST go red. Naming it is half the value:
// "some test will catch this" is a hope, "this file catches this" is a claim
// that can be checked — and when it turns out to be the wrong file, that is
// worth knowing too.
const MUTANTS = [
  {
    name: "CSV 不再输出场景行",
    why: "表格恢复会丢掉每一个自建场景，而句子还带着指向它的标签",
    find: `rowType: "scenario", id: sc.id, name: sc.name,`,
    with: `rowType: "phrase", id: sc.id, name: sc.name,`,
    kills: "test/scenario-restore-fidelity.test.mjs",
  },
  {
    name: "场景行输出了，但不带名字",
    why: "没有名字的场景会被过滤掉 —— 半个字段的损失和整行丢失后果一样",
    find: `rowType: "scenario", id: sc.id, name: sc.name,`,
    with: `rowType: "scenario", id: sc.id, name: "",`,
    kills: "test/scenario-restore-fidelity.test.mjs",
  },
  {
    name: "只改了导出，忘了改导入",
    why: "这是最典型的半做对 —— 文件里有场景行，导入方视而不见",
    find: `if (type === "scenario") {`,
    with: `if (type === "scenario" && false) {`,
    kills: "test/scenario-restore-fidelity.test.mjs",
  },
  {
    name: "同名场景合并了，但不返回别名表",
    why: "两台设备各建一个「去医院」时，一边的句子会静默掉进通用桶",
    find: `aliases["custom_" + sc.id] = "custom_" + keptId;`,
    with: `void keptId;`,
    kills: "test/scenario-restore-fidelity.test.mjs",
  },
  {
    name: "自建场景的判断挪到预设场景之后",
    why: "那些句子会被当成有随应用下发的 mp3，去播一个不存在的文件",
    find: `  if (typeof isCustomScenario === "function" && isCustomScenario(item.scenario)) return "translate";\n`,
    with: ``,
    kills: "test/scenario-ui.test.mjs",
  },
  {
    name: "并发认领挪回 await 之后",
    why: "同一 tick 里的两次点击会各花一次钱 —— 这个 bug 真实发生过",
    find: `  audioPending.add(id);\n  audioFailed.delete(id);\n  return provisionAudio(item, id);`,
    with: `  audioFailed.delete(id);\n  return provisionAudio(item, id).then(r => { audioPending.add(id); return r; });`,
    kills: "test/audio-provision.test.mjs",
  },
  {
    name: "循环只认 IndexedDB 里的片段",
    why: "一个全是预设短语的收藏列表会被判定成「一条都不能播」—— 真实反馈过",
    find: `loopQueue = (items || []).filter(it => playableUrlFor(it));`,
    with: `loopQueue = (items || []).filter(it => it && it.id && audioUrlFor(it.id));`,
    kills: "test/audio-loop.test.mjs",
  },
  {
    name: "标记不再从本机存储回填",
    why: "关掉 App 再打开，每条都谎称没有声音，而片段就在手机里",
    find: `  const have = await whichHaveAudio(unknown);\n  for (const id of have) audioReady.add(id);`,
    with: `  void unknown;`,
    kills: "test/marks-after-reload.test.mjs",
  },
  {
    name: "保存时不认条目自己的场景",
    why: "在自建场景里加的句子会落进通用桶，家长在自己的场景里看不到它",
    find: `    scenario: entry.scenario || "__translate__",`,
    with: `    scenario: "__translate__",`,
    kills: "test/scenario-add-phrase.test.mjs",
  },
  {
    name: "已收藏的判断永远说「没收过」",
    why: "星标永远是空心，而点下去说已经收藏过了 —— 界面和行为各说各的",
    find: `  return savedPhrases.some(p => p && p.en === en);`,
    with: `  return false;`,
    kills: "test/save-star.test.mjs",
  },
];

// ── safety ──────────────────────────────────────────────────────────────
// This edits the product file. A crash between mutate and restore would lose
// work, so it refuses to start unless everything is committed: then the worst
// case is `git checkout index.html`.
const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", ...opts });

if (sh("git", ["status", "--porcelain", "index.html"]).trim()) {
  console.error("✗ index.html 有未提交改动 —— 先提交或 stash。");
  console.error("  这个脚本会反复改写它，崩在中间就找不回来了。");
  process.exit(2);
}

const ORIGINAL = readFileSync(TARGET, "utf8");
const restore = () => writeFileSync(TARGET, ORIGINAL);
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => { restore(); process.exit(130); });
}

const only = process.argv[2] ? Number(process.argv[2]) : null;
const results = [];

try {
  for (const [i, m] of MUTANTS.entries()) {
    const n = i + 1;
    if (only && only !== n) continue;

    const count = ORIGINAL.split(m.find).length - 1;
    if (count !== 1) {
      // The anchor moved. Reported as a failure of this file, not of the
      // suite — a mutant that cannot be applied proves nothing and must not
      // be mistaken for one that was killed.
      results.push({ n, m, verdict: "anchor", detail: `锚串命中 ${count} 次，应为 1` });
      console.log(`[${n}/${MUTANTS.length}] ⚠ ${m.name} —— 锚串命中 ${count} 次，这条变异没跑`);
      continue;
    }

    writeFileSync(TARGET, ORIGINAL.replace(m.find, m.with));
    let killed = false;
    try {
      execFileSync("node", [m.kills], { cwd: ROOT, stdio: "pipe" });
    } catch {
      killed = true;   // the named test went red, which is the point
    }
    restore();

    results.push({ n, m, verdict: killed ? "killed" : "survived" });
    console.log(`[${n}/${MUTANTS.length}] ${killed ? "✓" : "✗"} ${m.name}` +
                (killed ? ` → ${m.kills.replace("test/", "")} 抓到了` : "  存活"));
  }
} finally {
  restore();
  // Belt and braces: a restore that silently failed would leave a mutated
  // product file in the working tree, which is far worse than any finding
  // this script could report.
  if (readFileSync(TARGET, "utf8") !== ORIGINAL) {
    console.error("\n🚨 index.html 没能还原！立刻跑：git checkout index.html");
    process.exit(3);
  }
}

// ── report ──────────────────────────────────────────────────────────────
const survived = results.filter(r => r.verdict === "survived");
const anchors = results.filter(r => r.verdict === "anchor");
const killed = results.filter(r => r.verdict === "killed").length;

console.log(`\n杀掉 ${killed} / 跑了 ${killed + survived.length}` +
            (anchors.length ? `（另有 ${anchors.length} 条因锚串失效没跑）` : ""));

if (anchors.length) {
  console.error("\n⚠ 这些变异的锚串已经失效 —— 代码动过了，把它们更新到当前写法：");
  for (const r of anchors) console.error(`  ${r.n}. ${r.m.name} —— ${r.detail}`);
}

if (survived.length) {
  console.error("\n✗ 存活的变异 —— 这些 bug 现在写进去，测试不会拦：");
  for (const r of survived) {
    console.error(`\n  ${r.n}. ${r.m.name}`);
    console.error(`     后果：${r.m.why}`);
    console.error(`     本该抓到它的：${r.m.kills}`);
  }
  console.error("\n  修的是测试，不是这个脚本。");
}

process.exit(survived.length || anchors.length ? 1 : 0);
