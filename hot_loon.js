/*******************************
 * 多平台热榜 - hot_loon.js (Loon 原生修复版)
 *******************************/

// ========== Loon 参数解析 ==========
const $arg = {};
if (typeof $argument !== "undefined") {
  $argument.split("&").forEach((item) => {
    const parts = item.split("=");
    if (parts.length >= 2) {
      const key = parts[0];
      const val = decodeURIComponent(parts.slice(1).join("="));
      $arg[key] = val;
    }
  });
}

// ========== 存储读写 ==========
function readStore(key, defVal = "") {
  if ($arg && $arg[key] !== undefined) return $arg[key];
  try {
    if (typeof $persistentStore !== "undefined") {
      const v = $persistentStore.read(key);
      return v === undefined || v === null ? defVal : v;
    }
  } catch (e) {}
  return defVal;
}

function readBool(key, defVal = false) {
  const v = readStore(key, String(defVal));
  const s = String(v).toLowerCase();
  return s === "true" || s === "1" || s === "on";
}

function readInt(key, defVal = 3) {
  const v = parseInt(readStore(key, String(defVal)), 10);
  return isNaN(v) ? defVal : v;
}

// ========== 全局配置 ==========
const KEYWORD_STRING = readStore("hot_keywords", "");
const KEYWORDS = KEYWORD_STRING.split(/[,，\s\n]/).map((x) => x.trim()).filter(Boolean);
const ATTACH_LINK = readBool("hot_attach_link", true);

const CFG = {
  weibo: { enable: readBool("hot_weibo_enable", true), split: readBool("hot_weibo_split", false), ignorePushLatest: readBool("hot_weibo_ignore", true), count: readInt("hot_weibo_count", 3) },
  zhihu: { enable: readBool("hot_zhihu_enable", false), split: readBool("hot_zhihu_split", false), ignorePushLatest: readBool("hot_zhihu_ignore", false), count: readInt("hot_zhihu_count", 3) },
  baidu: { enable: readBool("hot_baidu_enable", true), split: readBool("hot_baidu_split", false), ignorePushLatest: readBool("hot_baidu_ignore", true), count: readInt("hot_baidu_count", 3) },
  bilibili: { enable: readBool("hot_bilibili_enable", false), split: readBool("hot_bilibili_split", false), ignorePushLatest: readBool("hot_bilibili_ignore", false), count: readInt("hot_bilibili_count", 3) },
  douyin: { enable: readBool("hot_douyin_enable", true), split: readBool("hot_douyin_split", false), ignorePushLatest: readBool("hot_douyin_ignore", true), count: readInt("hot_douyin_count", 3) },
  kr36: { enable: readBool("hot_36kr_enable", false), split: readBool("hot_36kr_split", false), ignorePushLatest: readBool("hot_36kr_ignore", false), count: readInt("hot_36kr_count", 3) },
  toutiao: { enable: readBool("hot_toutiao_enable", false), split: readBool("hot_toutiao_split", false), ignorePushLatest: readBool("hot_toutiao_ignore", false), count: readInt("hot_toutiao_count", 3) },
  kuaishou: { enable: readBool("hot_kuaishou_enable", false), split: readBool("hot_kuaishou_split", false), ignorePushLatest: readBool("hot_kuaishou_ignore", false), count: readInt("hot_kuaishou_count", 3) },
  xhs: { enable: readBool("hot_xhs_enable", false), split: readBool("hot_xhs_split", false), ignorePushLatest: readBool("hot_xhs_ignore", false), count: readInt("hot_xhs_count", 3) }
};

const DEBUG_LOG = true;
function log(msg) {
  if (DEBUG_LOG) console.log(`[HotSearch] ${msg}`);
}

const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1" };

// ========== Loon 原生适配函数 ==========

// 1. 网络请求适配
function httpGet(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url: url, headers: UA }, (error, response, data) => {
      if (error) {
        reject(error);
      } else {
        resolve({ body: data, statusCode: response.status });
      }
    });
  });
}

// 2. 通知推送适配
function pushMsg(title, subtitle, body, openUrl) {
  if (typeof $notification !== "undefined") {
    // Loon 的第四个参数直接传 URL 字符串即可跳转
    $notification.post(title, subtitle, body, openUrl || "");
  } else {
    console.log(`[Notify] ${title} - ${body} [${openUrl}]`);
  }
}

// ========== 数据解析与处理 ==========

function parseJSON(body, label) {
  if (!body) throw new Error(`${label} 返回为空`);
  if (typeof body !== "string") return body;
  try { return JSON.parse(body); } catch (e) { throw new Error(`${label} JSON 解析失败`); }
}

function pickTitle(item) {
  if (!item) return "";
  if (typeof item === "string") return item.trim();
  const keys = ["title", "word", "name", "hot_word", "keyword", "note", "desc", "summary", "content"];
  for (const k of keys) if (item[k] && typeof item[k] === "string") return item[k].trim();
  if (item.templateMaterial && item.templateMaterial.widgetTitle) return item.templateMaterial.widgetTitle.trim();
  return "";
}

function pickUrl(item, fallback) {
  const urls = [];
  function collect(obj) {
    if (!obj || typeof obj !== "object") return;
    const keys = ["scheme", "url", "link", "href", "mobileUrl", "mobile_url", "appUrl", "app_url", "target_url", "targetUrl", "jump_url", "jumpUrl"];
    for (const k of keys) if (typeof obj[k] === "string") urls.push(obj[k]);
  }
  if (typeof item === "string") urls.push(item);
  else if (item && typeof item === "object") {
    collect(item);
    ["target", "card", "object", "templateMaterial", "mblog"].forEach(k => item[k] && collect(item[k]));
  }
  for (const raw of urls) {
    const v = String(raw).trim();
    if (/^https?:\/\//i.test(v) || /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(v)) return v;
  }
  return fallback || "";
}

function buildAppUrl(boardName, item, defaultUrl) {
  const title = pickTitle(item);
  const kwRaw = (item && (item.hot_word || item.word || item.keyword || item.name || item.title || item.note)) || title || "";
  const kw = String(kwRaw).trim();
  const encodedKw = kw ? encodeURIComponent(kw) : "";
  const rawUrl = pickUrl(item, "");

  switch (boardName) {
    case "微博热搜": return encodedKw ? `sinaweibo://searchall?q=${encodedKw}` : (rawUrl || defaultUrl);
    case "抖音热榜": return encodedKw ? `snssdk1128://search?keyword=${encodedKw}` : (rawUrl || defaultUrl);
    case "百度热搜": return encodedKw ? `baiduboxapp://search?word=${encodedKw}` : defaultUrl;
    case "知乎热榜": 
      if (rawUrl && rawUrl.includes("zhihu.com/question/")) {
         const m = rawUrl.match(/question\/(\d+)/);
         if (m) return `zhihu://questions/${m[1]}`;
      }
      return encodedKw ? `zhihu://search?type=content&q=${encodedKw}` : defaultUrl;
    case "B站热门": return encodedKw ? `bilibili://search?keyword=${encodedKw}` : defaultUrl;
    case "今日头条热榜": return encodedKw ? `snssdk141://search?keyword=${encodedKw}` : (rawUrl || defaultUrl);
    case "快手热榜": return encodedKw ?
