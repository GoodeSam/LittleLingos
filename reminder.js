// 到点提醒（ADR 0009 第十八块；原 ll:reminder 块）。见 ADR 0008。
// 上次复习后约 23.5 小时，服务器推一条空通知；点开去复习或连播。
//
// 浏览器零件全部从 create(deps) 传进来，之前都是直接抓全局：
//   storage / api                 —— storage.js、api-client.js 的实例
//   getAccessCode()               —— 推送相关请求都挡在邀请码后面
//   capabilityFacts()             —— { installEnv, isStandalone, pushSupported }，能不能开由它定
//   say(msg) / paint()            —— 状态行说什么、按钮怎么画：界面的事，留在 index.html
//   openIosSheet()                —— iPhone 没装主屏幕时带去装（可选）
//   caches / Notification / serviceWorker / crypto —— 浏览器零件
//   pushKey()                     —— VAPID 公钥的字节
//   setTimeout / clearTimeout     —— 时钟。复习后攒 1.5 秒再同步，测试要能驱动它
//
// 画界面的两个函数（reminderSay / paintReminder）和 online 事件监听留在 index.html。
// 普通脚本 + CommonJS 出口。
(function (root) {
  "use strict";

  function create(deps) {
    deps = deps || {};
    var storage = deps.storage || { readJSON: function (_k, f) { return f; }, write: function () { return false; } };
    var api = deps.api;
    var getAccessCode = deps.getAccessCode || function () { return ""; };
    var capabilityFacts = deps.capabilityFacts || function () { return {}; };
    var say = deps.say || function () {};
    var paint = deps.paint || function () {};
    var openIosSheet = deps.openIosSheet || null;
    var cachesObj = deps.caches || null;
    var NotificationApi = deps.Notification || null;
    var serviceWorker = deps.serviceWorker || null;
    var pushKey = deps.pushKey || function () { return null; };
    var cryptoObj = deps.crypto || (typeof crypto !== "undefined" ? crypto : null);
    var setTimeout = deps.setTimeout || root.setTimeout;
    var clearTimeout = deps.clearTimeout || root.clearTimeout;

    // 到点提醒（ADR 0008）。上次复习后约 23.5 小时，服务器推一条空通知；点开去
    // 复习或连播。
    //
    // 手机上存在 ll_reminder 里：是否开启、设备口令、推送地址、点开去哪、
    // 还没同步给服务器的那次复习时间、下一次提醒时间（只为显示）。
    // 设备口令是这台手机自己生成的随机串，服务器只存它的指纹，改、关都要出示它。
    // 「点开去哪」不发给服务器——空推送用不上它，Service Worker 从缓存里读。
    //
    // 复习后不是立刻同步：一轮复习要点很多下，攒 1.5 秒再发一次。断网就先攒着，
    // 下次打开 App 或恢复联网时补发。服务器说「没有这台手机的记录」（比如推送
    // 地址失效被删了），手机上也改成已关闭，不假装还开着。
    var REMINDER_KEY = "ll_reminder";
    var REMINDER_TARGETS = ["review", "loop"];
    var REMINDER_FLUSH_DELAY_MS = 1500;
    var reminderFlushTimer = null;

    function reminderState() {
      let s = storage.readJSON(REMINDER_KEY, null);
      if (!s || typeof s !== "object") s = {};
      if (!REMINDER_TARGETS.includes(s.target)) s.target = "review";
      return s;
    }
    function saveReminderState(s) { storage.write(REMINDER_KEY, JSON.stringify(s)); }

    function newDeviceSecret() {
      const b = new Uint8Array(32);
      cryptoObj.getRandomValues(b);
      return btoa(String.fromCharCode.apply(null, b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    function reminderTimeZone() {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; }
    }

    // 推送相关的请求都挡在邀请码后面，走这一处带码——带码的调用点越少，
    // 越不会有哪一处忘了带。
    async function pushApiPost(path, body) {
      const r = await api.post(path, body);
      // 原来断网是 fetch 直接抛、由调用方的 catch 说「没连上服务器」——照旧抛出去。
      if (r.kind === "network" || r.kind === "timeout") throw new Error(r.kind === "timeout" ? "请求超时" : "没连上服务器");
      return { status: r.status, out: r.body || {} };
    }

    function reminderPost(body) {
      return pushApiPost("/api/reminder", body);
    }

    // Service Worker 读得到的两样：点开去哪；这一条是不是开启时的确认通知。
    // 缓存名 push-spike 是试验期起的，沿用下来：改名要同时改 sw.js 和已装手机上的旧缓存。
    async function writePushTarget(t) {
      const c = await cachesObj.open("push-spike");
      await c.put("./__push-target", new Response(t));
    }
    async function setPushConfirmMark(on) {
      try {
        const c = await cachesObj.open("push-spike");
        if (on) await c.put("./__push-confirm", new Response("1"));
        else await c.delete("./__push-confirm");
      } catch (e) {}
    }


    function formatReminderTime(t) {
      const d = new Date(t);
      const hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${hm}`;
    }

    // 这个环境能不能开提醒、按钮写什么、说明行说什么——一处定（R21，PRD 6.4 支持矩阵）。
    // 三档：已验过（iPhone 主屏幕版）/ 没验证过（安卓、桌面……允许开但标明）/ 开不了
    // （iPhone 没装主屏幕、微信里、浏览器不支持通知）。没验过的事不许说成「能」或「不能」。
    // 平台事实从外面传进来，所以能在 Node 里直接测。
    function reminderCapability(facts) {
      const f = facts && typeof facts === "object" ? facts : {};
      const env = f.installEnv && typeof f.installEnv === "object" ? f.installEnv : {};
      const standalone = f.isStandalone === true;
      const push = f.pushSupported === true;
      const base = { buttonLabel: "开启提醒", action: "none", canEnable: false };
      if (env.isWeChat === true && !push) {
        // 这个微信内置浏览器没有通知能力——「收不到」是事实，不是猜测。指路去装主屏幕版。
        return { ...base, level: "wechat",
          note: "这个微信里收不到提醒。iPhone 请用 Safari 打开这个网址并「添加到主屏幕」，再从主屏幕打开；安卓在这里还没验证过。" };
      }
      if (env.isIOS === true && !standalone) {
        return { ...base, level: "ios-install-first", action: "install", buttonLabel: "先添加到主屏幕",
          note: "iPhone 要先「添加到主屏幕」、再从主屏幕上的图标打开，才收得到提醒。" };
      }
      if (!push) {
        return { ...base, level: "unsupported", note: "这个浏览器不支持通知，收不到提醒。" };
      }
      if (env.isIOS === true && standalone) {
        return { ...base, level: "ready", action: "enable", canEnable: true, note: "" };
      }
      // 有通知能力但没验证过（安卓、桌面、带通知能力的微信……）：允许开，但把话说在前面
      return { ...base, level: "unverified", action: "enable", canEnable: true,
        note: (env.isWeChat === true ? "微信里的提醒还没验证过" : "这个环境还没验证过") + "：可以开，但开了也可能收不到。收到了请告诉作者。" };
    }

    function reminderCapabilityNow() {
      return reminderCapability(capabilityFacts());
    }


    function setReminderTarget(t) {
      if (!REMINDER_TARGETS.includes(t)) return;
      const s = reminderState();
      s.target = t;
      saveReminderState(s);
      if (s.on) writePushTarget(t).catch(() => {});
      paint();
    }

    function toggleReminder() {
      if (reminderState().on) return disableReminder();
      const cap = reminderCapabilityNow();
      if (cap.action === "install") {
        if (openIosSheet) openIosSheet();   // 带去装，不是装作能开
        else say(cap.note);
        return;
      }
      if (!cap.canEnable) { say(cap.note); return; }
      return enableReminder();
    }

    // 必须由点击直接调用：iOS 只在用户手势里弹通知权限框，所以第一个 await 就是它。
    // 开启提醒失败时，界面上说什么。服务器的英文原话（"reminder not configured"
    // 之类）对家长没有意义，但状态码要留在括号里——家长会把这句话原样转给我。
    // 2026-09-22：preview 地址上没配提醒用的密钥，点开启必 500，原来照抄英文。
    function reminderFailureText(status, out, what = "开") {
      const err = (out && out.error) || "";
      if (status === 500 && /not configured/i.test(err)) {
        return "这个网址上没有提醒功能——预览版都这样。提醒要在正式版里用。";
      }
      if (status >= 500 && status <= 504) {
        return `服务器那边出错了，过一会儿再试（${status}）`;
      }
      return `没${what}成（${status}${err ? " " + err : ""}）`;
    }

    async function enableReminder() {
      const cap = reminderCapabilityNow();
      if (!cap.canEnable) { say(cap.note); return; }   // 和 paintReminder 用同一个判断
      let perm;
      try { perm = await NotificationApi.requestPermission(); }
      catch (e) { say("请求通知权限时出错：" + ((e && e.message) || e)); return; }
      if (perm !== "granted") {
        // 不把 "denied" 这种英文原词给家长；说清怎么重开
        say(perm === "denied"
          ? "通知权限被拒绝了。到手机「设置」里找到这个 App（或浏览器），重新允许通知，再回来点「开启提醒」。"
          : "没有拿到通知权限，收不到提醒。再点一次「开启提醒」，在弹出的框里选允许。");
        paint();
        return;
      }
      if (!getAccessCode()) { say("先在上面填邀请码"); return; }

      const s = reminderState();
      const secret = s.secret || newDeviceSecret();
      try {
        const reg = await serviceWorker.ready;
        const subscribe = () => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKey() });
        let sub = (await reg.pushManager.getSubscription()) || await subscribe();
        await writePushTarget(s.target);
        await setPushConfirmMark(true);
        say("正在开启……");
        const send = () => reminderPost({ action: "enable", endpoint: sub.endpoint, secret, tz: reminderTimeZone() });
        let r = await send();
        if (r.status === 409) {
          // 这个推送地址在服务器上被别的口令占着：换一个新地址重来一次
          try { await sub.unsubscribe(); } catch (e) {}
          sub = await subscribe();
          r = await send();
        }
        if (r.status === 403) { await setPushConfirmMark(false); say("邀请码不对，没开成"); return; }
        if (!r.out || !r.out.ok) {
          await setPushConfirmMark(false);
          if (r.out && r.out.gone) {
            try { await sub.unsubscribe(); } catch (e) {}
            say("这台手机的推送授权失效了，再点一次「开启提醒」");
          } else {
            say(reminderFailureText(r.status, r.out));
          }
          return;
        }
        saveReminderState({ on: true, secret, endpoint: sub.endpoint, target: s.target, pendingAt: null, nextAt: r.out.nextAt });
        paint();
        say("已开启。刚才那条通知，就是到点时会来的样子");
      } catch (e) {
        await setPushConfirmMark(false);
        say("没开成：" + ((e && e.message) || e));
      }
    }

    async function disableReminder() {
      const s = reminderState();
      let r;
      try { r = await reminderPost({ action: "disable", endpoint: s.endpoint, secret: s.secret }); }
      catch (e) { say("没连上服务器，提醒还开着。联网后再点一次"); return; }
      if (r.status !== 200) { say(reminderFailureText(r.status, r.out, "关")); return; }
      try {
        const reg = await serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      } catch (e) {}
      saveReminderState({ on: false, target: s.target });
      paint();
      say("已关闭，服务器上这台手机的记录已删除");
    }

    function reminderNoteReview() {
      const s = reminderState();
      if (!s.on) return;
      s.pendingAt = Date.now();
      saveReminderState(s);
      if (reminderFlushTimer) clearTimeout(reminderFlushTimer);
      reminderFlushTimer = setTimeout(() => { reminderFlushTimer = null; flushReminderReview(); }, REMINDER_FLUSH_DELAY_MS);
    }

    async function flushReminderReview() {
      const s = reminderState();
      if (!s.on || !s.pendingAt) return;
      let r;
      try {
        r = await reminderPost({ action: "review", endpoint: s.endpoint, secret: s.secret, at: s.pendingAt, tz: reminderTimeZone() });
      } catch (e) { return; }   // 断网：攒着，下次再发
      const cur = reminderState();
      if (r.status === 200) {
        if (cur.pendingAt === s.pendingAt) cur.pendingAt = null;
        if (r.out && typeof r.out.nextAt === "number") cur.nextAt = r.out.nextAt;
        saveReminderState(cur);
      } else if (r.status === 404) {
        saveReminderState({ on: false, target: cur.target });
      }
      paint();
    }

    return {
      REMINDER_KEY: REMINDER_KEY,
      REMINDER_TARGETS: REMINDER_TARGETS,
      REMINDER_FLUSH_DELAY_MS: REMINDER_FLUSH_DELAY_MS,
      reminderState: reminderState,
      saveReminderState: saveReminderState,
      newDeviceSecret: newDeviceSecret,
      reminderTimeZone: reminderTimeZone,
      pushApiPost: pushApiPost,
      reminderPost: reminderPost,
      writePushTarget: writePushTarget,
      setPushConfirmMark: setPushConfirmMark,
      formatReminderTime: formatReminderTime,
      reminderCapability: reminderCapability,
      reminderCapabilityNow: reminderCapabilityNow,
      setReminderTarget: setReminderTarget,
      toggleReminder: toggleReminder,
      reminderFailureText: reminderFailureText,
      enableReminder: enableReminder,
      disableReminder: disableReminder,
      reminderNoteReview: reminderNoteReview,
      flushReminderReview: flushReminderReview,
    };
  }

  var api = { create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llReminderLib = api;                                               // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
