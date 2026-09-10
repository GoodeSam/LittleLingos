// LittleLingos 图标库：底部导航 / 通用 UI / 30 个亲子场景，全部为单色线性 SVG（24×24 网格，Lucide 风格）。
// 约定：不写 stroke / fill / stroke-width / width / height，由页面 CSS 的 .ic 类统一控制；仅 play、pause、starFill 三个实心形状例外。

(function () {
  var svg = function (inner) {
    return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';
  };

  var STAR = '12 3.5 14.4 9.3 20.6 9.7 15.8 13.7 17.3 19.8 12 16.5 6.7 19.8 8.2 13.7 3.4 9.7 9.6 9.3';
  var HEART = '<path d="M12 20l-6.6-6.6a4.6 4.6 0 0 1 6.6-6.4 4.6 4.6 0 0 1 6.6 6.4z"/>';

  window.LL_ICONS = {
    // 底部导航
    nav: {
    // 候选一（2026-09-10）：帮我说 = 对话气泡（不预设是查词还是翻译）；
    // 复习 = 循环箭头；设置 = 齿轮。
    // 2026-09-10 重画：原来那个是圆形气泡加一个小尖尾巴，接口处笔画交叠，
    // 24px 下读起来像个带疙瘩的圆。换成圆角矩形气泡，尾巴接在左下角；
    // 里面三个点把「正在说」说出来，而不只是一个泡泡。
    help: svg('<path d="M6 4h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6l-5 4v-4H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z"></path>' +
              '<circle cx="8.5" cy="10" r=".9" fill="currentColor" stroke="none"></circle>' +
              '<circle cx="12" cy="10" r=".9" fill="currentColor" stroke="none"></circle>' +
              '<circle cx="15.5" cy="10" r=".9" fill="currentColor" stroke="none"></circle>'),
    review: svg('<polyline points="21 4 21 9.5 15.5 9.5"></polyline><path d="M18.7 14.5a7.5 7.5 0 1 1-1.8-7.8L21 9.5"></path>'),
    gear: svg('<circle cx="12" cy="12" r="3.2"></circle><path d="M19.2 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1.1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3.8a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1.1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3.8a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1z"></path>'),
      home: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
      dict: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z"/>'),
      saved: svg(HEART),
      translate: svg('<polyline points="17 3 21 7 17 11"/><path d="M3 7h18"/><polyline points="7 13 3 17 7 21"/><path d="M21 17H3"/>')
    },

    // 通用 UI
    ui: {
      plus: svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
      search: svg('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16"/>'),
      mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="21"/>'),
      chevronDown: svg('<polyline points="6 9 12 15 18 9"/>'),
      chevronRight: svg('<polyline points="9 6 15 12 9 18"/>'),
      arrowLeft: svg('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'),
      arrowRight: svg('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'),
      play: svg('<polygon points="7 4 20 12 7 20" fill="currentColor" stroke="none"/>'),
      pause: svg('<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>'),
      loader: svg('<path d="M21 12a9 9 0 1 1-6.2-8.6"/>'),
      star: svg('<polygon points="' + STAR + '"/>'),
      starFill: svg('<polygon points="' + STAR + '" fill="currentColor" stroke="none"/>'),
      check: svg('<polyline points="5 12 10 17 19 8"/>'),
      refresh: svg('<path d="M21 12a9 9 0 0 0-9-9 9.8 9.8 0 0 0-6.7 2.7L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.8 9.8 0 0 0 6.7-2.7L21 16"/><path d="M16 16h5v5"/>'),
      clipboard: svg('<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/>'),
      close: svg('<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>'),
      volume: svg('<polygon points="11 5 7 9 3 9 3 15 7 15 11 19"/><path d="M15 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5a9.5 9.5 0 0 1 0 14"/>')
    },

    // 30 个亲子场景
    scenario: {
      bath: svg('<path d="M3 12h18"/><path d="M4 12v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3"/><path d="M6 12V5.5a2 2 0 0 1 4 0"/><path d="M7 19v2M17 19v2"/>'),
      meal: svg('<path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z"/><path d="M20 3l-5.5 8"/><path d="M21.5 5l-5 6"/>'),
      bedtime: svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>'),
      emotion: svg('<path d="M12 19l-5.3-5.3a3.7 3.7 0 0 1 5.3-5.1 3.7 3.7 0 0 1 5.3 5.1z"/><path d="M18.5 3v4M16.5 5h4M5.5 5.5v3M4 7h3"/>'),
      morning: svg('<path d="M7 16a5 5 0 0 1 10 0"/><path d="M3 16h18"/><path d="M12 5v3M5.5 8.5l2.1 2.1M18.5 8.5l-2.1 2.1"/><path d="M5 20h14"/>'),
      dress: svg('<path d="M8.5 4L3 6.5l1.5 4.5 2.5-.8V20h10v-9.8l2.5.8L21 6.5 15.5 4a3.5 3.5 0 0 1-7 0z"/>'),
      teeth: svg('<rect x="3" y="11.5" width="7" height="4" rx="1"/><path d="M4.5 11.5v-3M6.5 11.5v-3M8.5 11.5v-3"/><path d="M10 12h9.5a1.5 1.5 0 0 1 0 3H10"/>'),
      handwash: svg('<path d="M5 8h3V5h4v3h4a4 4 0 0 1 4 4v2h-3v-2a1 1 0 0 0-1-1H5z"/><path d="M18.5 17.5l-1.2 1.8a1.5 1.5 0 1 0 2.4 0z"/>'),
      reading: svg('<path d="M3 4h5.5a3.5 3.5 0 0 1 3.5 3.5V20a3 3 0 0 0-3-3H3z"/><path d="M21 4h-5.5A3.5 3.5 0 0 0 12 7.5V20a3 3 0 0 1 3-3h6z"/>'),
      music: svg('<circle cx="6.5" cy="17.5" r="3"/><circle cx="17.5" cy="15.5" r="3"/><path d="M9.5 17.5V6l11-2.5v12"/>'),
      art: svg('<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 1.6-2-.4-1.1.3-2 1.4-2H17a4 4 0 0 0 4-4 9 9 0 0 0-9-10z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>'),
      blocks: svg('<rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><rect x="8" y="3" width="8" height="8" rx="1"/>'),
      pretend: svg('<path d="M3 9.5c0-1.5 1.2-2.5 3-2.5 2.5 0 4 1.5 6 1.5s3.5-1.5 6-1.5c1.8 0 3 1 3 2.5 0 4-2.5 7.5-6 7.5-1.5 0-2.5-1-3-2-.5 1-1.5 2-3 2-3.5 0-6-3.5-6-7.5z"/><circle cx="8" cy="11.5" r="1.5"/><circle cx="16" cy="11.5" r="1.5"/>'),
      potty: svg('<rect x="5" y="3" width="8" height="7" rx="1"/><path d="M4 12h16v1.5a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M8 19.5V21M16 19.5V21"/>'),
      goodbye: svg('<path d="M10 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"/><polyline points="16 8 20 12 16 16"/><line x1="20" y1="12" x2="9" y2="12"/>'),
      outing: svg('<path d="M3 17v-4.5a1.5 1.5 0 0 1 1.5-1.5h.5l2-5h10l2 5h.5a1.5 1.5 0 0 1 1.5 1.5V17"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M5 11h14M9.5 17h5"/>'),
      shopping: svg('<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21 8H6"/>'),
      friends: svg('<circle cx="9" cy="8" r="3.5"/><path d="M3 20v-1.5a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4V20"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6"/><path d="M21 20v-1.5a4 4 0 0 0-3-3.9"/>'),
      share: svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5 4.8 8 0 0 1 4.5 5 4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>'),
      manners: svg('<path d="M20 14.5a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/><path d="M8 8.5h8M8 12h5"/>'),
      safety: svg('<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9.5C7.4 20 4 16.5 4 12V6z"/><polyline points="9 12 11 14 15 10"/>'),
      sick: svg('<path d="M14 4.5V14a3.5 3.5 0 1 1-4 0V4.5a2 2 0 0 1 4 0z"/><path d="M12 10v7"/>'),
      cleanup: svg('<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>'),
      discover: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18z"/>'),
      praise: svg('<circle cx="12" cy="9" r="6"/><path d="M8.7 14.1L7 21l5-3 5 3-1.7-6.9"/>'),
      exercise: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/><path d="M5.6 5.6a9 9 0 0 1 0 12.8M18.4 5.6a9 9 0 0 0 0 12.8"/>'),
      kitchen: svg('<path d="M5 10h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M3 10h18"/><path d="M8 10a4 4 0 0 1 8 0M12 4.5V6"/>'),
      nap: svg('<path d="M3 5v15"/><path d="M3 10h15a3 3 0 0 1 3 3v7"/><path d="M3 17h18"/><path d="M7 10v7"/>'),
      snack: svg('<path d="M12 8c-1.5-1.5-3.5-2-5-1.5C4 7.3 3 10.5 4 14c1 3.5 3 6 5 6 1 0 1.5-.5 3-.5s2 .5 3 .5c2 0 4-2.5 5-6 1-3.5 0-6.7-3-7.5-1.5-.5-3.5 0-5 1.5z"/><path d="M12 8c0-2.5 1-4 3-5"/>'),
      outdoor: svg('<path d="M12 3L5 13h4l-3 5h12l-3-5h4z"/><path d="M12 18v3"/>')
    }
  };

  window.llIcon = function (group, key) {
    return (window.LL_ICONS[group] && window.LL_ICONS[group][key]) || '';
  };
})();
