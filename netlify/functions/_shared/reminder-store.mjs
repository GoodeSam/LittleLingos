// 到点提醒的存储（ADR 0008）。服务器上每台手机一条记录，只有 Victor
// 2026-09-18 同意的五个字段：endpoint、lastReviewAt、lastSentAt、tz、secretHash。
//
// 存在哪由 REMINDER_STORE 决定，而且必须显式设：别名（branch-deploy）用
// reminders-preview，生产用 reminders。Netlify Blobs 的站点级存储在所有部署
// 之间共享，名字不分开，测试数据就会混进正式版。没设就返回 null，调用方报错
// ——宁可停下，也不要猜一个名字写进去。
//
// 读用强一致（consistency: "strong"）：「这台手机发没发过」刚写进去就必须
// 读得到，否则钟敲两下就会推两次。写用 onlyIfMatch 做条件写入，见 reminder.mjs。
//
// 测试用 REMINDER_STORE=memory:<名字>，换成下面的内存替身——Netlify Blobs
// 在本项目控制之外。替身按 Blobs 的语义实现 etag 与条件写入，并且每个操作
// 都让出一次事件循环，模拟网络往返，这样并发检查的测试才测得到交错。
// @netlify/blobs 只在真要连 Netlify 时才加载，所以跑测试不需要 npm install。
export const MAX_RECORDS = 50;

export async function openReminderStore(env = process.env) {
  const name = env.REMINDER_STORE;
  if (!name) return null;
  if (name.startsWith("memory:")) return memoryStore(name);
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name, consistency: "strong" });
}

const memory = new Map();
let etagSeq = 0;
const hop = () => new Promise(r => setImmediate(r));

function memoryStore(name) {
  if (!memory.has(name)) memory.set(name, new Map());
  const s = memory.get(name);
  const copy = v => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
  return {
    async list() {
      await hop();
      return { blobs: Array.from(s.entries()).map(([key, e]) => ({ key, etag: e.etag })), directories: [] };
    },
    async get(key) {
      await hop();
      return s.has(key) ? copy(s.get(key).data) : null;
    },
    async getWithMetadata(key) {
      await hop();
      if (!s.has(key)) return null;
      const e = s.get(key);
      return { data: copy(e.data), etag: e.etag, metadata: {} };
    },
    async setJSON(key, data, opts = {}) {
      await hop();
      const cur = s.get(key);
      if (opts.onlyIfNew && cur) return { modified: false };
      if (opts.onlyIfMatch && (!cur || cur.etag !== opts.onlyIfMatch)) return { modified: false };
      const etag = `"m${++etagSeq}"`;
      s.set(key, { data: copy(data), etag });
      return { modified: true, etag };
    },
    async delete(key) {
      await hop();
      s.delete(key);
    },
  };
}

export function __memoryStoreForTest(name) {
  return memoryStore(name);
}
