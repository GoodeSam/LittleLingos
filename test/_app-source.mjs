// 整个前端的源码，index.html 加上它加载的每一个模块文件。
//
// 为什么要有这个（ADR 0009 教训，2026-09-28）：
// 一批测试的断言是「源码里得有 / 不得有某样东西」——翻译请求走不走统一出口、
// 收藏只有一处写入、超时时长是不是只定义了一次。这类断言原来都读 index.html。
// 每搬走一块，它们就集体变红，而红的原因不是应用坏了，是代码换了文件。
// 三次之后（第 11、13、15 块）把它收成一处：问「这个应用里」，不是「这个文件里」。
//
// 清单从 scripts/stamp-sw.mjs 的 SOURCES 现取，不在这里再抄一份——
// 抄一份的话，下一个模块会同时漏掉缓存戳和这里，而且两处都不会红。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function moduleFiles() {
  const stamp = readFileSync(join(ROOT, "scripts/stamp-sw.mjs"), "utf8");
  const at = stamp.indexOf("const SOURCES = [");
  const list = stamp.slice(at, stamp.indexOf("]", at));
  return [...list.matchAll(/"([^"]+\.js)"/g)].map(m => m[1]).filter(f => f !== "sw.js");
}

// 每个文件一段，带一行文件名注释——断言失败时看得出是哪个文件的事。
export function appSource() {
  const parts = [`/* ==== index.html ==== */\n` + readFileSync(join(ROOT, "index.html"), "utf8")];
  for (const f of moduleFiles()) {
    try { parts.push(`/* ==== ${f} ==== */\n` + readFileSync(join(ROOT, f), "utf8")); }
    catch (e) { /* SOURCES 里列了但文件还不存在：交给 sw 那一层的测试去红 */ }
  }
  return parts.join("\n");
}

export const APP_SOURCE = appSource();
