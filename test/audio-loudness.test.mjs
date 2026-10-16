#!/usr/bin/env node
// 随应用下发的录音够不够响（2026-10-15 Victor 要：跑步时听不清，整体放大 1.5 倍）。
//
// 1.5 倍振幅 = +3.5 dB。放大前抽 58 段量过：响度最轻 -23、中位 -21、最响 -18.9 LUFS，
// 真峰值最高 -1.5 dBTP。放大后中位约 -17.5 LUFS（播客常用 -16，接近了）。不少段放大后会
// 顶破满格，所以处理时加了限幅，真峰值压在 -1 dBTP 以下（mp3 解码会冒出一点，留 1 dB 才不破音）。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长戴着耳机跑步，手机音量开到顶，预设句子和词典单词的英文听得清——
//      整批录音的响度比原来高约 3.5 dB（1.5 倍），而不是原来那样偏小声。
//   2. 放大之后不破音：最响的那一瞬间也没顶到满格。
//   3. 文件还是原来的格式（mp3、16 kHz、单声道），手机上照样能放、照样能离线缓存。
//
// 要用 ffmpeg 量。这台机器上没有 ffmpeg 时由 run.mjs 大声跳过，不算绿。
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO = join(ROOT, "audio");

// 抽样：句子每 25 段取一段，词典单词每 5 个取一个。固定抽法，每次量的是同一批。
const phrases = readdirSync(AUDIO).filter(f => f.endsWith(".mp3")).sort();
const words = readdirSync(join(AUDIO, "dict")).filter(f => f.endsWith(".mp3")).sort().map(f => "dict/" + f);
const sample = [...phrases.filter((_, i) => i % 25 === 0), ...words.filter((_, i) => i % 5 === 0)];

// ebur128 的汇总在 stderr 末尾：I = 整段响度（LUFS），Peak = 真峰值（dBTP，这里按 dBFS 写）。
function stats(rel) {
  const r = execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1`, "sh", join(AUDIO, rel)],
                         { encoding: "utf8" });
  const summary = r.slice(r.lastIndexOf("Summary:"));
  const I = Number((summary.match(/I:\s*(-?[\d.]+) LUFS/) || [])[1]);
  const peak = Number((summary.match(/Peak:\s*(-?[\d.]+|-inf) dBFS/) || [])[1]);
  const fmt = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,sample_rate,channels",
    "-of", "csv=p=0", join(AUDIO, rel)], { encoding: "utf8" }).trim();
  return { rel, I, peak, fmt };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const measured = sample.map(stats);
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

test(`整批录音比原来响 1.5 倍（抽 ${sample.length} 段：中位数从 -21 升到 -18 ～ -17 LUFS，最轻的也不低于 -20）`, () => {
  const m = median(measured.map(x => x.I));
  assert.ok(m >= -18.0 && m <= -17.0, `响度中位数 ${m} LUFS，不在 -18 ～ -17 之间（原来是 -21）`);
  const quiet = measured.filter(x => !(x.I >= -20)).map(x => `${x.rel}(${x.I})`);
  assert.deepEqual(quiet, [], `这几段还是偏小声：${quiet.join(", ")}`);
});

test("放大之后不破音：每段的真峰值都在 -1 dBTP 以下", () => {
  const hot = measured.filter(x => !(x.peak <= -1.0)).map(x => `${x.rel}(${x.peak})`);
  assert.deepEqual(hot, [], `这几段顶得太满，会破音：${hot.join(", ")}`);
});

test("还是原来的格式：mp3、16 kHz、单声道", () => {
  const off = measured.filter(x => x.fmt !== "mp3,16000,1").map(x => `${x.rel}(${x.fmt})`);
  assert.deepEqual(off, [], `格式变了：${off.join(", ")}`);
});

console.log("audio-loudness tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
