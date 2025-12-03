/*******************************
 * 多平台热榜 - hot_loon.js (Loon 修复完整版)
 *******************************/

// ========== 1. Loon 环境适配与参数解析 ==========

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

// 统一数据读取
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

// ========== 2. 核心功能：时间检查 (新增) ==========

const PUSH_HOURS_STR = readStore("hot_push_hours", ""); 

// 检查是否在指定时间运行
function checkTime() {
  if (!PUSH_HOURS_STR || PUSH_HOURS_STR.trim() === "") {
    // 如果没填时间，默认不拦截，按 Cron 设定运行
    return true; 
  }
  
  const currentHour = new Date().getHours();
  // 支持中文逗号和英文逗号
  const allowedHours = PUSH_HOURS_STR.split(/[,，]/)
    .map(n => parseInt(n.trim()))
    .filter(n => !isNaN(n));

  if (allowedHours.includes(currentHour)) {
    console.log(`[HotSearch] 当前时间 ${currentHour} 点，符合推送设置 [${PUSH_HOURS_STR}]，开始运行。`);
    return true;
  } else {
    console.log(`[HotSearch] 当前时间 ${currentHour} 点，不在推送设置 [${PUSH_HOURS_STR}] 内，跳过。`);
    return false;
  }
}

// ========== 3. 配置读取 ==========

function readBool(key, defVal = false) {
  const v = readStore(key, String(defVal));
  const s = String(v).toLowerCase();
  return s === "true" || s === "1" || s === "on";
}

function readInt(key, defVal = 3) {
  const v = parseInt(readStore(key, String(defVal)), 10);
  return isNaN(v) ? defVal : v;
}

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

// ========== 4. 工具函数适配 ==========

function postMsg(title, sub, body, url) {
  if (typeof $notification !== "undefined") {
    $notification.post(title, sub, body, url || "");
  } else if (typeof $notify !== "undefined") {
    $notify(title, sub, body, url ? { "open-url": url } : {});
  } else {
    console.log(`[Notify] ${title}: ${body}`);
  }
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const opts = { url: url, headers: UA };
    if (typeof $httpClient !== "undefined") {
      $httpClient.get(opts, (error, response, data) => {
        if (error) reject(error);
        else resolve({ body: data, statusCode: response ? response.status : 0 });
      });
    } else if (typeof $task !== "undefined") {
      $task.fetch(opts).then(
        (response) => resolve({ body: response.body, statusCode: response.statusCode }),
        (reason) => reject(reason)
      );
    } else {
      reject("Unknown Environment");
    }
  });
}

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
  try { return JSON.stringify(item).slice(0, 50); } catch (e) { return ""; }
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
    case "快手热榜": return encodedKw ? `kwai://search?keyword=${encodedKw}` : (rawUrl || defaultUrl);
    case "小红书热门话题": return (rawUrl && rawUrl.includes("xiaohongshu")) ? rawUrl : defaultUrl;
    case "36 氪热榜": return rawUrl || defaultUrl;
    default: return rawUrl || defaultUrl;
  }
}

function selectItems(boardName, rawList, cfg) {
  if (!Array.isArray(rawList) || rawList.length === 0) return null;
  const count = Math.max(1, cfg.count || 3);
  const list = rawList.slice();
  if (KEYWORDS.length === 0) {
    if (!cfg.ignorePushLatest) {
      log(`${boardName}：未设置关键词且未开启“无词推新”，跳过`);
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

function makePushes(name, cfg, usedItems, lines, defaultUrl, itemList) {
  if (!cfg.split) {
    return {
      ok: true,
      title: name,
      pushes: [{ title: `${name} Top${usedItems.length}`, body: lines.join("\n"), openUrl: defaultUrl }]
    };
  }
  const pushes = usedItems.map((item, idx) => ({
    title: `${name} 第${idx + 1}名`,
    body: lines[idx],
    openUrl: buildAppUrl(name, itemList[idx], defaultUrl)
  }));
  return { ok: true, title: name, pushes };
}

// ========== 5. 抓取逻辑 ==========

async function fetchWeibo() {
  const name = "微博热搜"; const cfg = CFG.weibo;
  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/weibohot");
    const json = parseJSON(resp.body, name);
    if (json.code !== 200 || !Array.isArray(json.data)) throw new Error(json.msg || "API Error");
    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => {
      const hot = item.hot || item.hotValue || item.hot_value;
      return `${idx+1}. ${pickTitle(item)}${hot ? ' ['+hot+']' : ''}`;
    });
    return makePushes(name, cfg, used, lines, "sinaweibo://pageinfo?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot", used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchDouyin() {
  const name = "抖音热榜"; const cfg = CFG.douyin;
  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/douyinhot");
    const json = parseJSON(resp.body, name);
    if (json.code !== 200 || !Array.isArray(json.data)) throw new Error(json.msg || "API Error");
    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx+1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, "snssdk1128://search/trending", used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchBaidu() {
  const name = "百度热搜"; const cfg = CFG.baidu;
  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/baiduhot");
    const json = parseJSON(resp.body, name);
    if (json.code !== 200 || !Array.isArray(json.data)) throw new Error(json.msg || "API Error");
    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx+1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, "baiduboxapp://v1/easybrowse/open?url=" + encodeURIComponent("https://top.baidu.com/board?tab=realtime"), used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchZhihu() {
  const name = "知乎热榜"; const cfg = CFG.zhihu;
  try {
    const resp = await httpGet("https://api.pearktrue.cn/api/dailyhot/?title=" + encodeURIComponent("知乎"));
    const json = parseJSON(resp.body, name);
    const data = Array.isArray(json.data) ? json.data : (json.data && json.data.list);
    if (!Array.isArray(data)) throw new Error("API Error");
    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx+1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, "zhihu://topstory/hot-list", used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchBilibili() {
  const name = "B站热门"; const cfg = CFG.bilibili;
  try {
    const resp = await httpGet("https://api.pearktrue.cn/api/dailyhot/?title=" + encodeURIComponent("哔哩哔哩"));
    const json = parseJSON(resp.body, name);
    const data = Array.isArray(json.data) ? json.data : (json.data && json.data.list);
    if (!Array.isArray(data)) throw new Error("API Error");
    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx+1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, "bilibili://popular", used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetch36Kr() {
  const name = "36 氪热榜"; const cfg = CFG.kr36;
  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/hot36kr");
    const json = parseJSON(resp.body, name);
    if (json.code !== 200 || !Array.isArray(json.data)) throw new Error(json.msg || "API Error");
    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx+1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, "https://36kr.com/newsflashes", used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchToutiao() {
  const name = "今日头条热榜"; const cfg = CFG.toutiao;
  try {
    const resp = await httpGet("https://api.pearktrue.cn/api/dailyhot/?title=" + encodeURIComponent("今日头条"));
    const json = parseJSON(resp.body, name);
    const data = Array.isArray(json.data) ? json.data : (json.data && json.data.list);
    if (!Array.isArray(data)) throw new Error("API Error");
    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx+1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, "snssdk141://", used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchKuaishou() {
  const name = "快手热榜"; const cfg = CFG.kuaishou;
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
          return `${idx+1}. ${pickTitle(item)}${hot ? ' ['+hot+']' : ''}`;
        });
        return makePushes(name, cfg, used, lines, "kwai://search/topicRank", used);
      }
    } catch (e) { lastErr = e.message; }
  }
  return { ok: false, title: name, err: lastErr || "所有接口均失效" };
}

async function fetchXHS() {
  const name = "小红书热门话题"; const cfg = CFG.xhs;
  try {
    const resp = await httpGet("https://api.pearktrue.cn/api/dailyhot/?title=" + encodeURIComponent("小红书"));
    const json = parseJSON(resp.body, name);
    const data = Array.isArray(json.data) ? json.data : (json.data && json.data.list);
    if (!Array.isArray(data)) throw new Error("API Error");
    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx+1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, "xhsdiscover://", used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

// ========== 6. 主执行入口 ==========

!(async () => {
  // 1. 检查是否在允许的推送时间内
  if (!checkTime()) {
    $done();
    return;
  }

  // 2. 执行任务
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
    log("无启用榜单");
    $done();
    return;
  }

  const results = await Promise.all(tasks);

  results.forEach((res) => {
    if (!res) return;
    if (res.ok && Array.isArray(res.pushes)) {
      res.pushes.forEach((p) => postMsg(p.title, "", p.body, ATTACH_LINK ? p.openUrl : ""));
    } else if (!res.skip) {
      postMsg(`${res.title} 获取失败`, "", String(res.err || "未知错误"));
    }
  });

  $done();
})().catch((e) => {
  log(`Error: ${e}`);
  postMsg("热榜脚本异常", "", String(e));
  $done();
});
