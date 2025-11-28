// ==UserScript==
// @name         Seek 多站关键词搜索（App 跳转版）
// @description  从 BoxJs 读取关键词，一键在 抖音/快手/小红书/微博/B 站/知乎/今日头条 中搜索，并尽量直接拉起 App。
// @author       veyna + GPT
// @version      1.1
// ==/UserScript==

// ---------------- 配置 Key（保持和 BoxJs 一致） ----------------
const KEY_KEYWORDS        = "seek_keywords";          // 关键词，多行
const KEY_DOUYIN          = "seek_enable_douyin";     // 抖音
const KEY_KUAISHOU        = "seek_enable_kuaishou";   // 快手
const KEY_XHS             = "seek_enable_xhs";        // 小红书
const KEY_WEIBO           = "seek_enable_weibo";      // 微博
const KEY_BILIBILI        = "seek_enable_bilibili";   // B 站
const KEY_ZHIHU           = "seek_enable_zhihu";      // 知乎
const KEY_TOUTIAO         = "seek_enable_toutiao";    // 今日头条

// ---------------- 工具函数：只考虑 Quantumult X / NE 环境 ----------------
function readData(key, def = "") {
  try {
    const v = $prefs.valueForKey(key);
    if (v === undefined || v === null || v === "") return def;
    return v;
  } catch (e) {
    return def;
  }
}

function readBool(key, def = false) {
  const raw = readData(key, def ? "true" : "false");
  if (typeof raw === "boolean") return raw;
  const str = String(raw).toLowerCase();
  if (["1", "true", "yes", "on"].includes(str)) return true;
  if (["0", "false", "no", "off"].includes(str)) return false;
  return def;
}

function notify(title, subtitle, body, opts) {
  $notify(title, subtitle, body, opts);
}

// ---------------- 平台定义：同时给出 App Scheme 和 Web 链接 ----------------

function encode(q) {
  return encodeURIComponent(q);
}

/*
  说明：
  - appUrl(kw):  优先使用的 App 内搜索 Scheme
  - webUrl(kw):  备用的网页搜索链接（用于通知里预览 / 复制）
  - 有的 App（比如今日头条）官方没公开搜索 Scheme，就只用网页
  - 如果某个 App 没有安装：点击 Scheme 可能无反应，这是 iOS 限制
*/

const PLATFORMS = [
  {
    id: "douyin",
    name: "抖音搜索",
    enableKey: KEY_DOUYIN,
    defaultEnable: true,
    appUrl: kw => `snssdk1128://search?keyword=${encode(kw)}`, // 或 snssdk1128://search/result?keyword=
    webUrl: kw => `https://www.douyin.com/search/${encode(kw)}`
  },
  {
    id: "kuaishou",
    name: "快手搜索",
    enableKey: KEY_KUAISHOU,
    defaultEnable: true,
    appUrl: kw => `kwai://search?keyword=${encode(kw)}`,
    webUrl: kw => `https://www.kuaishou.com/search/${encode(kw)}`
  },
  {
    id: "xhs",
    name: "小红书搜索",
    enableKey: KEY_XHS,
    defaultEnable: true,
    appUrl: kw => `xhsdiscover://search/result?keyword=${encode(kw)}`,
    webUrl: kw => `https://www.xiaohongshu.com/search_result?keyword=${encode(kw)}`
  },
  {
    id: "weibo",
    name: "微博搜索",
    enableKey: KEY_WEIBO,
    defaultEnable: true,
    // 官方收集到的搜索 Scheme：sinaweibo://searchall?q=关键词
    appUrl: kw => `sinaweibo://searchall?q=${encode(kw)}`,
    webUrl: kw => `https://s.weibo.com/weibo?q=${encode(kw)}`
  },
  {
    id: "bilibili",
    name: "B 站搜索",
    enableKey: KEY_BILIBILI,
    defaultEnable: true,
    appUrl: kw => `bilibili://search?keyword=${encode(kw)}`,
    webUrl: kw => `https://search.bilibili.com/all?keyword=${encode(kw)}`
  },
  {
    id: "zhihu",
    name: "知乎搜索",
    enableKey: KEY_ZHIHU,
    defaultEnable: true,
    appUrl: kw => `zhihu://search?q=${encode(kw)}`,
    webUrl: kw => `https://www.zhihu.com/search?q=${encode(kw)}`
  },
  {
    id: "toutiao",
    name: "今日头条搜索",
    enableKey: KEY_TOUTIAO,
    defaultEnable: true,
    // 头条目前没有稳定可查的公开“搜索” Scheme，这里暂时只用网页搜索
    appUrl: null,
    webUrl: kw => `https://so.toutiao.com/search?keyword=${encode(kw)}`
  }
];

// ---------------- 主逻辑 ----------------

(function main() {
  // 1. 读关键词（支持多行）
  const rawKw = readData(KEY_KEYWORDS, "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  if (!rawKw.length) {
    notify(
      "Seek 多站关键词搜索",
      "",
      "未配置关键词，请到 BoxJs → seek_keywords 中填写（每行一个）。"
    );
    return $done();
  }

  // 多个关键词就用空格拼起来一起搜
  const query = rawKw.join(" ");

  // 2. 读哪些平台开启了
  const enabledPlatforms = PLATFORMS.filter(p =>
    readBool(p.enableKey, p.defaultEnable)
  );

  if (!enabledPlatforms.length) {
    notify(
      "Seek 多站关键词搜索",
      "",
      "所有平台都被关闭了，请到 BoxJs 勾选需要的站点。"
    );
    return $done();
  }

  // 3. 逐个平台发通知（点击即跳 App）
  enabledPlatforms.forEach(p => {
    const appUrl = p.appUrl ? p.appUrl(query) : p.webUrl(query);
    const webUrl = p.webUrl(query);

    const subtitle = `关键词：${query}`;
    const body = p.appUrl
      ? "点击打开 App 搜索"
      : "当前平台暂时只支持网页搜索";

    notify(p.name, subtitle, body, {
      "open-url": appUrl,   // 优先尝试拉起 App
      "media-url": webUrl   // 通知里长按可复制 / 预览网页
    });
  });

  $done();
})();
