// netlify/functions/reminder-cron.mjs — 到点提醒的钟（ADR 0008）。
//
// Netlify 每 5 分钟叫醒它一次，它做的事和 /api/reminder 的 tick 完全一样：
// 同一段 runTick()。去重、失败补发、失效删除都在那里，这里不重复。
//
// 两点要知道：
//   · Netlify 的定时任务只在生产环境（已发布的部署）上运行；别名和 preview 上
//     它不会醒。别名上测试时用 tick 代替（手动或外部的钟去敲）。
//   · 它没写网址（config 里只有 schedule，没有 path），也不挡邀请码：Netlify
//     叫醒它时不带邀请码，装门会把它自己挡在外面。「没写网址就调不到」还没
//     核实——Netlify 普通函数不写网址，默认也能从 /.netlify/functions/<名字>
//     访问。上线后要从外面请求一次确认。即使能被调用，最坏也只是「提前检查
//     一次」：去重在，不会多发；但每次调用会消耗一点额度。
//
// 每次运行都在日志里写一行结果（检查了几台、推了几条、删了几条），上线后在
// Netlify 的函数日志里看得到钟在走。
//
// Requires: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, REMINDER_STORE
import { vapidFromEnv } from "./_shared/push.mjs";
import { ruleFromEnv } from "./_shared/reminder-rule.mjs";
import { openReminderStore } from "./_shared/reminder-store.mjs";
import { runTick } from "./reminder.mjs";

export default async () => {
  const vapid = vapidFromEnv();
  const store = await openReminderStore();
  if (!vapid || !store) {
    console.error("reminder-cron: not configured (VAPID keys or REMINDER_STORE missing)");
    return new Response("not configured", { status: 500 });
  }
  const out = await runTick(store, vapid, ruleFromEnv());
  console.log("reminder-cron:", JSON.stringify(out));
  return new Response(null, { status: 204 });
};

export const config = { schedule: "*/5 * * * *" };
