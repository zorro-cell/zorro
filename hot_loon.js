/*******************************
 * 多平台热榜 - hot_loon.js (QX兼容还原版)
 * 核心逻辑还原自用户提供的 QX 脚本
 * 适配 Loon 插件面板 & 接口还原
 *******************************/

// ============================================
// 1. Loon 环境兼容层 (让 QX 代码在 Loon 跑起来)
// ============================================

const $arg = {};
if (typeof $argument !== "undefined") {
  $argument.split("&").forEach((item) => {
    const parts = item.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let val = parts.slice(1).join("=");
      try { val = decodeURIComponent(val); } catch(e) {}
      $arg[key] = val.trim();
    }
  });
}

// 模拟 QX 的 $task.fetch
const $task = {
  fetch: function(opt) {
    return new Promise((resolve, reject) => {
      // 转换 headers
      const headers = opt.headers || {};
      $httpClient.get({ url: opt.url, headers: headers }, (err, resp, body) => {
        if (err) return reject(err);
        resolve({ statusCode: resp.status, headers: resp.headers, body: body });
      });
    });
  }
};

// 模拟 QX 的 $notify
const $notify = function(title, sub, body, opts) {
  let url = "";
  if (opts && opts["open-url"]) url = opts["open-url"];
  if (typeof $notification !== "undefined") {
    $notification.post(title, sub, body, url);
  } else {
    console.log(`[通知] ${title}: ${body} (${url})`);
  }
};

// 模拟 QX 的 $prefs (优先读取 Loon 插件参数)
const $prefs = {
  valueForKey: function(key) {
    if ($arg && $arg[key] !== undefined) return $arg[key];
    if (typeof $persistentStore !== "undefined") return $persistentStore.read(key);
    return null;
  }
};

// ============================================
// 2. 核心逻辑 (还原原脚本)
// ============================================

// --- 通用存储读写 ---
function readStore(key, defVal = "") {
  const v = $prefs.valueForKey(key);
  return v === undefined || v === null ? defVal : v;
}

function readBool(key, defVal = false) {
  let v = readStore(key, String(defVal));
  if (typeof v === 'string') {
    v = v.toLowerCase().trim();
    if (v === "true" || v === "1" || v === "on") return true;
    if (v === "false" || v === "0" || v === "off") return false;
  }
  return v === true;
}

function readInt(key, defVal = 3) {
  const v = parseInt(readStore(key, String(defVal)), 10);
  return isNaN(v) ? defVal : v;
}

// --- 全局配置 ---

const KEYWORD_STRING = readStore("hot_keywords", "");
const KEYWORDS = KEYWORD_STRING.split(/[,，\s\n]/).map((x) => x.trim()).filter(Boolean);
const PUSH_HOURS_STR = readStore("hot_push_hours", ""); 
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

const UA = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
};

// --- 时间检查函数 (新增) ---
function checkTime() {
  if (!PUSH_HOURS_STR || PUSH_HOURS_STR.trim() === "") return true;
  const currentHour = new Date().getHours();
  const allowedHours = PUSH_HOURS_STR.split(/[,，]/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
  if (allowedHours.includes(currentHour)) {
    log(`时间符合 (当前${currentHour}点)，执行任务`);
    return true;
  }
  log(`时间不符 (当前${currentHour}点)，跳过`);
  return false;
}

// --- 公共函数 ---

function parseJSON(body, label) {
  if (!body) throw new Error(`${label} 返回为空`);
  if (typeof body !== "string") return body;
  const trimmed = body.trim();
  if (!trimmed) throw new Error(`${label} 返回空字符串`);
  if (trimmed[0] === "<") throw new Error(`${label} 返回的是 HTML`);
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    throw new Error(`${label} JSON 解析失败：${e.message || e}`);
  }
}

function pickTitle(item) {
  if (!item) return "";
  if (typeof item === "string") return item.trim();
  const keys = ["title", "word", "name", "hot_word", "keyword", "note", "desc", "summary", "content"];
  for (const k of keys) {
    if (item[k] && typeof item[k] === "string") return item[k].trim();
  }
  if (item.templateMaterial && typeof item.templateMaterial.widgetTitle === "string") {
    return item.templateMaterial.widgetTitle.trim();
  }
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
    ["target", "card", "object", "templateMaterial", "mblog"].forEach((k) => {
      if (item[k] && typeof item[k] === "object") collect(item[k]);
    });
  }
  for (const raw of urls) {
    const v = String(raw).trim();
    if (!v) continue;
    if (/^https?:\/\//i.test(v)) return v;
    if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(v)) return v;
  }
  return fallback || "";
}

function buildAppUrl(boardName, item, defaultUrl) {
  const title = pickTitle(item);
  const kw = String((item && (item.hot_word || item.word || item.keyword || item.name || item.title)) || title || "").trim();
  const encodedKw = kw ? encodeURIComponent(kw) : "";
  const rawUrl = pickUrl(item, "");

  switch (boardName) {
    case "微博热搜": return encodedKw ? `sinaweibo://searchall?q=${encodedKw}` : (rawUrl || defaultUrl);
    case "抖音热榜": return encodedKw ? `snssdk1128://search?keyword=${encodedKw}` : (rawUrl || defaultUrl);
    case "百度热搜": 
      let target = rawUrl;
      if (!target && encodedKw) target = `https://www.baidu.com/s?wd=${encodedKw}`;
      if (target) return "baiduboxapp://v1/easybrowse/open?url=" + encodeURIComponent(target);
      return encodedKw ? `baiduboxapp://search?word=${encodedKw}` : defaultUrl;
    case "知乎热榜":
      if (rawUrl && /^https?:\/\/www\.zhihu\.com/i.test(rawUrl)) {
        const m = rawUrl.match(/question\/(\d+)/);
        if (m && m[1]) return `zhihu://questions/${m[1]}`;
      }
      return encodedKw ? `zhihu://search?type=content&q=${encodedKw}` : defaultUrl;
    case "B站热门": return encodedKw ? `bilibili://search?keyword=${encodedKw}` : defaultUrl;
    case "今日头条热榜": return encodedKw ? `snssdk141://search?keyword=${encodedKw}` : (rawUrl || defaultUrl);
    case "快手热榜": return encodedKw ? `kwai://search?keyword=${encodedKw}` : (rawUrl || defaultUrl);
    case "小红书热门话题": return (rawUrl && rawUrl.includes("xiaohongshu")) ? rawUrl : defaultUrl;
    default: return rawUrl || defaultUrl;
  }
}

function selectItems(boardName, rawList, cfg) {
  if (!Array.isArray(rawList) || rawList.length === 0) return null;
  const count = Math.max(1, cfg.count || 3);
  const list = rawList.slice();
  if (KEYWORDS.length === 0) {
    if (!cfg.ignorePushLatest) {
      log(`${boardName}：跳过 (无关键词且不开推新)`);
      return null;
    }
    return list.slice(0, count);
  }
  const matched = list.filter((item) => {
    const title = pickTitle(item);
    return title && KEYWORDS.some((k) => title.includes(k));
  });
  if (matched.length > 0) return matched.slice(0, count);
  if (cfg.ignorePushLatest) return list.slice(0, count);
  return null;
}

function httpGet(url, headers = UA) {
  return $task.fetch({ url, method: "GET", headers });
}

function makePushes(name, cfg, usedItems, lines, defaultUrl, itemList) {
  if (!cfg.split) {
    return {
      ok: true,
      title: name,
      pushes: [{ title: `${name} Top${usedItems.length}`, body: lines.join("\n"), openUrl: defaultUrl }]
    };
  }
  const pushes = usedItems.map((item, idx) => ({
    title: `${name} Top${idx + 1}`,
    body: lines[idx],
    openUrl: buildAppUrl(name, itemList[idx], defaultUrl)
  }));
  return { ok: true, title: name, pushes };
}

// ============================================
// 3. 各平台获取 (还原原脚本 API)
// ============================================

async function fetchWeibo() {
  const name = "微博热搜"; const cfg = CFG.weibo;
  const defaultUrl = "sinaweibo://pageinfo?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot";
  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/weibohot");
    const json = parseJSON(resp.body, name);
    if (json.code !== 200 || !Array.isArray(json.data)) throw new Error("API Error");
    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => {
      const hot = item.hot || item.hotValue || "";
      return `${idx + 1}. ${pickTitle(item)}${hot ? ` [${hot}]` : ""}`;
    });
    return makePushes(name, cfg, used, lines, defaultUrl, used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchDouyin() {
  const name = "抖音热榜"; const cfg = CFG.douyin;
  const defaultUrl = "snssdk1128://search/trending";
  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/douyinhot");
    const json = parseJSON(resp.body, name);
    if (json.code !== 200 || !Array.isArray(json.data)) throw new Error("API Error");
    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx + 1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, defaultUrl, used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchBaidu() {
  const name = "百度热搜"; const cfg = CFG.baidu;
  const defaultUrl = "baiduboxapp://v1/easybrowse/open?url=" + encodeURIComponent("https://top.baidu.com/board?tab=realtime");
  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/baiduhot");
    const json = parseJSON(resp.body, name);
    if (json.code !== 200 || !Array.isArray(json.data)) throw new Error("API Error");
    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx + 1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, defaultUrl, used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetch36Kr() {
  const name = "36氪热榜"; const cfg = CFG.kr36;
  const defaultUrl = "https://36kr.com/newsflashes";
  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/hot36kr");
    const json = parseJSON(resp.body, name);
    if (json.code !== 200 || !Array.isArray(json.data)) throw new Error("API Error");
    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx + 1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, defaultUrl, used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchZhihu() {
  const name = "知乎热榜"; const cfg = CFG.zhihu;
  const defaultUrl = "zhihu://topstory/hot-list";
  try {
    const resp = await httpGet("https://api.pearktrue.cn/api/dailyhot/?title=" + encodeURIComponent("知乎"));
    const json = parseJSON(resp.body, name);
    const data = Array.isArray(json.data) ? json.data : json.data && json.data.list;
    if (!Array.isArray(data)) throw new Error("API Error");
    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx + 1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, defaultUrl, used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchBilibili() {
  const name = "B站热门"; const cfg = CFG.bilibili;
  const defaultUrl = "bilibili://popular";
  try {
    const resp = await httpGet("https://api.pearktrue.cn/api/dailyhot/?title=" + encodeURIComponent("哔哩哔哩"));
    const json = parseJSON(resp.body, name);
    const data = Array.isArray(json.data) ? json.data : json.data && json.data.list;
    if (!Array.isArray(data)) throw new Error("API Error");
    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx + 1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, defaultUrl, used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchToutiao() {
  const name = "今日头条热榜"; const cfg = CFG.toutiao;
  const defaultUrl = "snssdk141://";
  try {
    const resp = await httpGet("https://api.pearktrue.cn/api/dailyhot/?title=" + encodeURIComponent("今日头条"));
    const json = parseJSON(resp.body, name);
    const data = Array.isArray(json.data) ? json.data : json.data && json.data.list;
    if (!Array.isArray(data)) throw new Error("API Error");
    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx + 1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, defaultUrl, used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchKuaishou() {
  const name = "快手热榜"; const cfg = CFG.kuaishou;
  const defaultUrl = "kwai://search/topicRank";
  const sources = [
    { url: "https://tenapi.cn/v2/kuaishouhot", parser: j=>j.data, desc: "TenAPI" },
    { url: "https://api.oioweb.cn/api/common/kuaishou", parser: j=>j.result&&j.result.data, desc: "Oioweb" }
  ];
  let lastErr = null;
  for (const src of sources) {
    try {
      const resp = await httpGet(src.url);
      const json = parseJSON(resp.body, name);
      const list = src.parser(json);
      if (Array.isArray(list) && list.length > 0) {
        const used = selectItems(name, list, cfg);
        if (!used) return { ok: false, title: name, skip: true };
        const lines = used.map((item, idx) => {
          const hot = item.hot_value || item.hotValue || "";
          return `${idx + 1}. ${pickTitle(item)}${hot ? ` [${hot}]` : ""}`;
        });
        return makePushes(name, cfg, used, lines, defaultUrl, used);
      }
    } catch (e) { lastErr = e.message; }
  }
  return { ok: false, title: name, err: lastErr || "所有接口均失效" };
}

async function fetchXHS() {
  const name = "小红书热门话题"; const cfg = CFG.xhs;
  const defaultUrl = "xhsdiscover://";
  try {
    const resp = await httpGet("https://api.pearktrue.cn/api/dailyhot/?title=" + encodeURIComponent("小红书"));
    const json = parseJSON(resp.body, name);
    const data = Array.isArray(json.data) ? json.data : json.data && json.data.list;
    if (!Array.isArray(data)) throw new Error("API Error");
    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx + 1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, defaultUrl, used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

// ============================================
// 4. 主流程
// ============================================

!(async () => {
  if (!checkTime()) {
    $done();
    return;
  }

  const tasks = [];
  if (CFG.weibo.enable) tasks.push(fetchWeibo());
  if (CFG.zhihu.enable) tasks.push(fetchZhihu());
  if (CFG.baidu.enable) tasks.push(fetchBaidu());
  if (CFG.bilibili.enable) tasks.push(fetchBilibili());
  if (CFG.douyin.enable) tasks.push(fetchDouyin());
  if (CFG.kr36.enable) tasks.push(fetch36Kr());
  if (CFG.toutiao.enable) tasks.push(fetchToutiao());
  if (CFG.kuaishou.enable) tasks.push(fetchKuaishou());
  if (CFG.xhs.enable) tasks.push(fetchXHS());

  if (tasks.length === 0) {
    log("所有平台均关闭");
    $done();
    return;
  }

  const results = await Promise.all(tasks);

  results.forEach((res) => {
    if (!res) return;
    if (res.ok && Array.isArray(res.pushes)) {
      res.pushes.forEach((p) => {
        const opts = {};
        if (ATTACH_LINK && p.openUrl) opts["open-url"] = p.openUrl;
        $notify(p.title || "", "", p.body || "", opts);
      });
    } else if (!res.skip) {
      $notify(`${res.title} 失败`, "", String(res.err || "未知错误"));
    }
  });

  $done();
})().catch((e) => {
  log(`脚本异常: ${e}`);
  $notify("热榜脚本异常", "", String(e));
  $done();
});
