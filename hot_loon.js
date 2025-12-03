/*******************************
 * 多平台热搜榜 - hot_loon.js (终极修复版)
 * 版本: 2025-11-28
 *******************************/

// ========== 1. 参数解析 (增强健壮性) ==========

const $arg = {};

// 尝试获取 Loon 传入的参数
if (typeof $argument !== "undefined" && $argument) {
  // console.log("[HotSearch] Raw Argument: " + $argument); // 调试：查看原始参数字符串
  $argument.split("&").forEach((item) => {
    const parts = item.split("=");
    if (parts.length >= 2) {
      // 兼容处理：去除空格，处理 URL 编码
      const key = parts[0].trim();
      let val = parts.slice(1).join("=");
      try { val = decodeURIComponent(val); } catch(e) {}
      $arg[key] = val.trim();
    }
  });
}

// 通用读取函数
function readStore(key, defVal) {
  // 1. 优先从插件参数($argument)读取
  if ($arg && $arg[key] !== undefined) {
    return $arg[key];
  }
  // 2. 其次从持久化存储读取
  if (typeof $persistentStore !== "undefined") {
    const v = $persistentStore.read(key);
    if (v !== undefined && v !== null) return v;
  }
  // 3. 返回默认值
  return defVal;
}

// 读取布尔值 (核心修复：更宽容的判断)
function readBool(key, defVal) {
  let v = readStore(key, String(defVal));
  // 只要是字符串，都转小写去空格
  if (typeof v === 'string') {
    v = v.toLowerCase().trim();
    if (v === "true" || v === "1" || v === "on" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "off" || v === "no") return false;
  }
  return v === true; 
}

// 读取整数
function readInt(key, defVal) {
  const v = parseInt(readStore(key, String(defVal)), 10);
  return isNaN(v) ? defVal : v;
}

// ========== 2. 配置加载 (默认值调整以符合你的习惯) ==========

const KEYWORD_STRING = readStore("hot_keywords", "");
const KEYWORDS = KEYWORD_STRING.split(/[,，\s\n]/).map((x) => x.trim()).filter(Boolean);
const PUSH_HOURS_STR = readStore("hot_push_hours", ""); 
const ATTACH_LINK = readBool("hot_attach_link", true);

// 【重点】这里将 split 的默认值改为了 true
// 这样即使插件参数没读进去，脚本也会默认分条推送，符合你的要求。
const CFG = {
  weibo:    { enable: readBool("hot_weibo_enable", true),  split: readBool("hot_weibo_split", true),  ignore: readBool("hot_weibo_ignore", true),  count: readInt("hot_weibo_count", 3) },
  baidu:    { enable: readBool("hot_baidu_enable", true),  split: readBool("hot_baidu_split", true),  ignore: readBool("hot_baidu_ignore", true),  count: readInt("hot_baidu_count", 3) },
  douyin:   { enable: readBool("hot_douyin_enable", true), split: readBool("hot_douyin_split", true), ignore: readBool("hot_douyin_ignore", true), count: readInt("hot_douyin_count", 3) },
  zhihu:    { enable: readBool("hot_zhihu_enable", true),  split: readBool("hot_zhihu_split", true),  ignore: readBool("hot_zhihu_ignore", false), count: readInt("hot_zhihu_count", 3) },
  bilibili: { enable: readBool("hot_bilibili_enable", false), split: readBool("hot_bilibili_split", true), ignore: readBool("hot_bilibili_ignore", false), count: readInt("hot_bilibili_count", 3) },
  kr36:     { enable: readBool("hot_36kr_enable", false),  split: readBool("hot_36kr_split", true),   ignore: readBool("hot_36kr_ignore", false),  count: readInt("hot_36kr_count", 3) },
  toutiao:  { enable: readBool("hot_toutiao_enable", false), split: readBool("hot_toutiao_split", true), ignore: readBool("hot_toutiao_ignore", false), count: readInt("hot_toutiao_count", 3) },
  kuaishou: { enable: readBool("hot_kuaishou_enable", false), split: readBool("hot_kuaishou_split", true), ignore: readBool("hot_kuaishou_ignore", false), count: readInt("hot_kuaishou_count", 3) },
  xhs:      { enable: readBool("hot_xhs_enable", false),   split: readBool("hot_xhs_split", true),    ignore: readBool("hot_xhs_ignore", false),   count: readInt("hot_xhs_count", 3) }
};

const DEBUG_LOG = true;
function log(msg) { if (DEBUG_LOG) console.log(`[HotSearch] ${msg}`); }

// 打印配置状态，用于排查
if (DEBUG_LOG) {
  console.log(`[HotSearch] 配置状态检查:
  - 微博: 开启=${CFG.weibo.enable}, 分拆=${CFG.weibo.split}
  - 百度: 开启=${CFG.baidu.enable}, 分拆=${CFG.baidu.split}
  - 抖音: 开启=${CFG.douyin.enable}, 分拆=${CFG.douyin.split}
  - 推送时间限制: ${PUSH_HOURS_STR || "无 (全天推送)"}
  - 关键词: ${KEYWORDS.length > 0 ? KEYWORDS.join(",") : "无"}
  `);
}

const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1" };

// ========== 3. 核心功能函数 ==========

function checkTime() {
  if (!PUSH_HOURS_STR || PUSH_HOURS_STR.trim() === "") return true;
  const currentHour = new Date().getHours();
  // 修复：处理全角逗号，处理空值
  const allowedHours = PUSH_HOURS_STR.split(/[,，]/)
    .map(n => parseInt(n.trim()))
    .filter(n => !isNaN(n));
    
  if (allowedHours.includes(currentHour)) {
    log(`时间符合 (当前${currentHour}点, 设定${allowedHours}), 执行推送`);
    return true;
  } else {
    log(`时间不符 (当前${currentHour}点, 设定${allowedHours}), 跳过`);
    return false;
  }
}

function postMsg(title, sub, body, url) {
  if (typeof $notification !== "undefined") {
    $notification.post(title, sub, body, url || "");
  } else if (typeof $notify !== "undefined") {
    $notify(title, sub, body, url ? { "open-url": url } : {});
  } else {
    console.log(`[通知模拟] ${title}: ${body} (${url})`);
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
      reject("Unknown Env");
    }
  });
}

function parseJSON(body) {
  try { return JSON.parse(body); } catch (e) { return null; }
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
  const kw = String((item && (item.hot_word || item.word || item.keyword || item.name || item.title)) || title || "").trim();
  const encKw = kw ? encodeURIComponent(kw) : "";
  const rawUrl = pickUrl(item, "");

  switch (boardName) {
    case "微博热搜": return encKw ? `sinaweibo://searchall?q=${encKw}` : (rawUrl || defaultUrl);
    case "抖音热榜": return encKw ? `snssdk1128://search?keyword=${encKw}` : (rawUrl || defaultUrl);
    case "百度热搜": return encKw ? `baiduboxapp://search?word=${encKw}` : defaultUrl;
    case "知乎热榜": 
      if (rawUrl && rawUrl.includes("zhihu.com/question/")) {
         const m = rawUrl.match(/question\/(\d+)/);
         if (m) return `zhihu://questions/${m[1]}`;
      }
      return encKw ? `zhihu://search?type=content&q=${encKw}` : defaultUrl;
    case "B站热门": return encKw ? `bilibili://search?keyword=${encKw}` : defaultUrl;
    case "今日头条热榜": return encKw ? `snssdk141://search?keyword=${encKw}` : (rawUrl || defaultUrl);
    case "快手热榜": return encKw ? `kwai://search?keyword=${encKw}` : (rawUrl || defaultUrl);
    case "小红书热门话题": return (rawUrl && rawUrl.includes("xiaohongshu")) ? rawUrl : defaultUrl;
    case "36 氪热榜": return rawUrl || defaultUrl;
    default: return rawUrl || defaultUrl;
  }
}

function selectItems(boardName, rawList, cfg) {
  if (!Array.isArray(rawList) || rawList.length === 0) return null;
  const count = Math.max(1, cfg.count || 3);
  let list = rawList.slice();
  
  if (KEYWORDS.length > 0) {
    const matched = list.filter((item) => {
      const t = pickTitle(item);
      return t && KEYWORDS.some(k => t.includes(k));
    });
    if (matched.length > 0) {
      log(`${boardName} 命中关键词: ${matched.length}条`);
      return matched.slice(0, count);
    }
  }
  
  if (cfg.ignore) { // ignore=true 表示无词推新
    // log(`${boardName} 无关键词匹配，推送最新前${count}条`);
    return list.slice(0, count);
  }
  
  log(`${boardName} 既无关键词匹配，也未开启[无词推新]，跳过`);
  return null;
}

function makePushes(name, cfg, usedItems, lines, defaultUrl, itemList) {
  // 如果 cfg.split 为 true，则返回数组；否则返回合并的一条
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

// ========== 4. 抓取逻辑 (保留 QX 双重保险机制) ==========

async function fetchWeibo() {
  const name = "微博热搜"; const cfg = CFG.weibo;
  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/weibohot");
    const json = parseJSON(resp.body);
    if (!json || json.code !== 200 || !Array.isArray(json.data)) throw new Error("API异常");
    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => {
      const hot = item.hot || item.hotValue || item.hot_value;
      return `${idx+1}. ${pickTitle(item)}${hot ? ' ['+hot+']' : ''}`;
    });
    return makePushes(name, cfg, used, lines, "sinaweibo://pageinfo?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot", used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchBaidu() {
  const name = "百度热搜"; const cfg = CFG.baidu;
  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/baiduhot");
    const json = parseJSON(resp.body);
    if (!json || json.code !== 200 || !Array.isArray(json.data)) throw new Error("API异常");
    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx+1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, "baiduboxapp://v1/easybrowse/open?url=" + encodeURIComponent("https://top.baidu.com/board?tab=realtime"), used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchDouyin() {
  const name = "抖音热榜"; const cfg = CFG.douyin;
  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/douyinhot");
    const json = parseJSON(resp.body);
    if (!json || json.code !== 200 || !Array.isArray(json.data)) throw new Error("API异常");
    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx+1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, "snssdk1128://search/trending", used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchZhihu() {
  const name = "知乎热榜"; const cfg = CFG.zhihu;
  try {
    const resp = await httpGet("https://api.pearktrue.cn/api/dailyhot/?title=" + encodeURIComponent("知乎"));
    const json = parseJSON(resp.body);
    const data = json ? (Array.isArray(json.data) ? json.data : (json.data && json.data.list)) : null;
    if (!Array.isArray(data)) throw new Error("API异常");
    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx+1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, "zhihu://topstory/hot-list", used);
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
      const json = parseJSON(resp.body);
      const list = json ? src.parser(json) : null;
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
  return { ok: false, title: name, err: lastErr || "所有接口失效" };
}

async function fetchBilibili() {
  const name = "B站热门"; const cfg = CFG.bilibili;
  try {
    const resp = await httpGet("https://api.pearktrue.cn/api/dailyhot/?title=" + encodeURIComponent("哔哩哔哩"));
    const json = parseJSON(resp.body);
    const data = json ? (Array.isArray(json.data) ? json.data : (json.data && json.data.list)) : null;
    if (!Array.isArray(data)) throw new Error("API异常");
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
    const json = parseJSON(resp.body);
    if (!json || json.code !== 200 || !Array.isArray(json.data)) throw new Error("API异常");
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
    const json = parseJSON(resp.body);
    const data = json ? (Array.isArray(json.data) ? json.data : (json.data && json.data.list)) : null;
    if (!Array.isArray(data)) throw new Error("API异常");
    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx+1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, "snssdk141://", used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

async function fetchXHS() {
  const name = "小红书热门话题"; const cfg = CFG.xhs;
  try {
    const resp = await httpGet("https://api.pearktrue.cn/api/dailyhot/?title=" + encodeURIComponent("小红书"));
    const json = parseJSON(resp.body);
    const data = json ? (Array.isArray(json.data) ? json.data : (json.data && json.data.list)) : null;
    if (!Array.isArray(data)) throw new Error("API异常");
    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };
    const lines = used.map((item, idx) => `${idx+1}. ${pickTitle(item)}`);
    return makePushes(name, cfg, used, lines, "xhsdiscover://", used);
  } catch (e) { return { ok: false, title: name, err: e.message }; }
}

// ========== 5. 主执行入口 ==========

!(async () => {
  if (!checkTime()) {
    $done();
    return;
  }

  const tasks = [];
  if (CFG.weibo.enable) tasks.push(fetchWeibo());
  if (CFG.baidu.enable) tasks.push(fetchBaidu());
  if (CFG.douyin.enable) tasks.push(fetchDouyin());
  if (CFG.zhihu.enable) tasks.push(fetchZhihu());
  if (CFG.bilibili.enable) tasks.push(fetchBilibili());
  if (CFG.kr36.enable) tasks.push(fetch36Kr());
  if (CFG.toutiao.enable) tasks.push(fetchToutiao());
  if (CFG.kuaishou.enable) tasks.push(fetchKuaishou());
  if (CFG.xhs.enable) tasks.push(fetchXHS());

  if (tasks.length === 0) {
    log("所有平台均未启用");
    $done();
    return;
  }

  const results = await Promise.all(tasks);

  results.forEach((res) => {
    if (!res) return;
    if (res.ok && Array.isArray(res.pushes)) {
      res.pushes.forEach((p) => postMsg(p.title, "", p.body, ATTACH_LINK ? p.openUrl : ""));
    } else if (!res.skip) {
      log(`${res.title} 获取失败: ${res.err}`);
    }
  });

  $done();
})().catch((e) => {
  log(`脚本异常: ${e}`);
  postMsg("热榜脚本异常", "", String(e));
  $done();
});
