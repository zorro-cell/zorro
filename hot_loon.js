/*******************************
 * 多平台热榜 - hot_loon.js (官方接口重制版)
 * 版本: 2025-11-28 V2
 * 作者: @心事全在脸上
 *******************************/

// ========== 1. 基础工具 ==========

const $arg = {};
// 解析参数，增强兼容性
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

function readStore(key, defVal) {
  if ($arg && $arg[key] !== undefined) return $arg[key];
  if (typeof $persistentStore !== "undefined") {
    const v = $persistentStore.read(key);
    if (v !== undefined && v !== null) return v;
  }
  return defVal;
}

// 默认值全部设为 true，防止参数读取失败导致不推送
function readBool(key, defVal) {
  let v = readStore(key, String(defVal));
  if (typeof v === 'string') {
    v = v.toLowerCase().trim();
    if (v === "false" || v === "0" || v === "off") return false;
  }
  return true; // 只要不是明确的 false，统统当 true 处理
}

function readInt(key, defVal) {
  const v = parseInt(readStore(key, String(defVal)), 10);
  return isNaN(v) ? defVal : v;
}

// ========== 2. 配置 ==========

const KEYWORDS = readStore("hot_keywords", "").split(/[,，\s\n]/).filter(Boolean);
const PUSH_HOURS = readStore("hot_push_hours", ""); 
const ATTACH_LINK = readBool("hot_attach_link", true);

// 强制开启所有开关的默认值，确保有数据
const CFG = {
  weibo:    { enable: readBool("hot_weibo_enable", true), split: readBool("hot_weibo_split", true), ignore: readBool("hot_weibo_ignore", true), count: readInt("hot_weibo_count", 3) },
  baidu:    { enable: readBool("hot_baidu_enable", true), split: readBool("hot_baidu_split", true), ignore: readBool("hot_baidu_ignore", true), count: readInt("hot_baidu_count", 3) },
  douyin:   { enable: readBool("hot_douyin_enable", true), split: readBool("hot_douyin_split", true), ignore: readBool("hot_douyin_ignore", true), count: readInt("hot_douyin_count", 3) },
  zhihu:    { enable: readBool("hot_zhihu_enable", true), split: readBool("hot_zhihu_split", true), ignore: readBool("hot_zhihu_ignore", true), count: readInt("hot_zhihu_count", 3) },
  bilibili: { enable: readBool("hot_bilibili_enable", true), split: readBool("hot_bilibili_split", true), ignore: readBool("hot_bilibili_ignore", true), count: readInt("hot_bilibili_count", 3) },
  kr36:     { enable: readBool("hot_36kr_enable", true),  split: readBool("hot_36kr_split", true), ignore: readBool("hot_36kr_ignore", true), count: readInt("hot_36kr_count", 3) },
  toutiao:  { enable: readBool("hot_toutiao_enable", true), split: readBool("hot_toutiao_split", true), ignore: readBool("hot_toutiao_ignore", true), count: readInt("hot_toutiao_count", 3) },
  kuaishou: { enable: readBool("hot_kuaishou_enable", true), split: readBool("hot_kuaishou_split", true), ignore: readBool("hot_kuaishou_ignore", true), count: readInt("hot_kuaishou_count", 3) },
  xhs:      { enable: readBool("hot_xhs_enable", true),   split: readBool("hot_xhs_split", true), ignore: readBool("hot_xhs_ignore", true), count: readInt("hot_xhs_count", 3) }
};

const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1" };

function log(msg) { console.log(`[HotSearch] ${msg}`); }

// ========== 3. 网络与处理 ==========

function httpGet(url) {
  return new Promise((resolve, reject) => {
    // 某些官方接口需要特定 Referer 否则 403
    const opts = { url: url, headers: { ...UA, "Referer": "https://www.baidu.com" } };
    if (typeof $httpClient !== "undefined") {
      $httpClient.get(opts, (error, response, data) => {
        if (error) reject(error);
        else resolve(data);
      });
    } else if (typeof $task !== "undefined") {
      $task.fetch(opts).then(resp => resolve(resp.body), err => reject(err));
    } else reject("Env Error");
  });
}

function parseJSON(body) {
  try { return JSON.parse(body); } catch (e) { return null; }
}

function notify(title, body, url) {
  if (typeof $notification !== "undefined") {
    $notification.post(title, "", body, url || "");
  } else if (typeof $notify !== "undefined") {
    $notify(title, "", body, url ? { "open-url": url } : {});
  } else {
    console.log(`[Notify] ${title}: ${body}`);
  }
}

function checkTime() {
  if (!PUSH_HOURS) return true;
  const h = new Date().getHours();
  const allowed = PUSH_HOURS.split(/[,，]/).map(x=>parseInt(x.trim())).filter(x=>!isNaN(x));
  return allowed.includes(h);
}

// 统一数据处理：筛选关键词 -> 截取数量 -> 格式化
function processList(name, list, cfg, titleKey, urlKey) {
  if (!list || !Array.isArray(list) || list.length === 0) return null;
  
  let result = list;
  // 1. 关键词过滤
  if (KEYWORDS.length > 0) {
    const filtered = list.filter(item => {
      const t = item[titleKey] || "";
      return KEYWORDS.some(k => t.includes(k));
    });
    if (filtered.length > 0) result = filtered;
    else if (!cfg.ignore) return null; // 没命中且不推最新
  }

  // 2. 截取数量
  result = result.slice(0, cfg.count);

  // 3. 生成推送数据
  return result.map((item, index) => ({
    title: `${name} Top${index+1}`,
    body: item[titleKey] || "无标题",
    url: item[urlKey] || ""
  }));
}

// ========== 4. 官方接口抓取 ==========

// 1. 微博 (官方)
async function fetchWeibo() {
  const cfg = CFG.weibo;
  try {
    const data = await httpGet("https://weibo.com/ajax/side/hotSearch");
    const json = parseJSON(data);
    const list = json?.data?.realtime || [];
    return processList("微博热搜", list, cfg, "word_scheme", "url")?.map(p => ({
      ...p, url: `sinaweibo://searchall?q=${encodeURIComponent(p.body)}`
    }));
  } catch(e) { log("Weibo Err: " + e); return null; }
}

// 2. 百度 (官方)
async function fetchBaidu() {
  const cfg = CFG.baidu;
  try {
    const data = await httpGet("https://top.baidu.com/board?tab=realtime");
    // 简单正则提取
    const matches = [...data.matchAll(/<div class="c-single-text-ellipsis">\s*(.*?)\s*<\/div>/g)];
    const list = matches.map(m => ({ title: m[1].trim() })).filter(x => x.title);
    return processList("百度热搜", list, cfg, "title", "url")?.map(p => ({
      ...p, url: `baiduboxapp://search?word=${encodeURIComponent(p.body)}`
    }));
  } catch(e) { log("Baidu Err: " + e); return null; }
}

// 3. 知乎 (官方)
async function fetchZhihu() {
  const cfg = CFG.zhihu;
  try {
    const data = await httpGet("https://api.zhihu.com/topstory/hot-list?limit=50&desktop=true");
    const json = parseJSON(data);
    const list = json?.data || [];
    return processList("知乎热榜", list, cfg, "target", "url")?.map(p => {
       // 修复取值
       const title = p.body.title || p.body;
       const url = p.url.url || p.url;
       const id = url.match(/question\/(\d+)/)?.[1];
       return { 
         title: p.title, 
         body: title, 
         url: id ? `zhihu://questions/${id}` : url 
       };
    });
  } catch(e) { log("Zhihu Err: " + e); return null; }
}

// 4. B站 (官方)
async function fetchBilibili() {
  const cfg = CFG.bilibili;
  try {
    const data = await httpGet("https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all");
    const json = parseJSON(data);
    const list = json?.data?.list || [];
    return processList("B站热门", list, cfg, "title", "short_link")?.map(p => ({
      ...p, url: p.url.replace("https://b23.tv/", "bilibili://video/") // 简单替换尝试
    }));
  } catch(e) { log("Bilibili Err: " + e); return null; }
}

// 5. 抖音 (官方 Web)
async function fetchDouyin() {
  const cfg = CFG.douyin;
  try {
    const data = await httpGet("https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/");
    const json = parseJSON(data);
    const list = json?.word_list || [];
    return processList("抖音热榜", list, cfg, "word", "url")?.map(p => ({
      ...p, url: `snssdk1128://search?keyword=${encodeURIComponent(p.body)}`
    }));
  } catch(e) { log("Douyin Err: " + e); return null; }
}

// 6. 36Kr (官方 Gateway)
async function fetch36Kr() {
  const cfg = CFG.kr36;
  try {
    const data = await httpGet("https://gateway.36kr.com/api/mis/nav/newsflash/flow");
    const json = parseJSON(data);
    const list = json?.data?.itemList || [];
    return processList("36氪热榜", list, cfg, "templateMaterial", "url")?.map(p => ({
      ...p, body: p.body.widgetTitle, url: "https://36kr.com/newsflashes"
    }));
  } catch(e) { log("36Kr Err: " + e); return null; }
}

// 7. 头条 (使用备用接口)
async function fetchToutiao() {
  const cfg = CFG.toutiao;
  try {
    // 官方接口很难搞，使用稳定的 Aggregator
    const data = await httpGet("https://api.vvhan.com/api/hotlist?type=toutiao");
    const json = parseJSON(data);
    const list = json?.data || [];
    return processList("头条热榜", list, cfg, "title", "url")?.map(p => ({
      ...p, url: `snssdk141://search?keyword=${encodeURIComponent(p.body)}`
    }));
  } catch(e) { log("Toutiao Err: " + e); return null; }
}

// 8. 快手 (使用备用接口)
async function fetchKuaishou() {
  const cfg = CFG.kuaishou;
  try {
    // 尝试韩小韩接口
    const data = await httpGet("https://api.vvhan.com/api/hotlist?type=ks");
    const json = parseJSON(data);
    const list = json?.data || [];
    return processList("快手热榜", list, cfg, "title", "url")?.map(p => ({
       ...p, url: `kwai://search?keyword=${encodeURIComponent(p.body)}`
    }));
  } catch(e) { log("Kuaishou Err: " + e); return null; }
}

// 9. 小红书 (使用备用接口)
async function fetchXHS() {
  const cfg = CFG.xhs;
  try {
    const data = await httpGet("https://api.vvhan.com/api/hotlist?type=xhs");
    const json = parseJSON(data);
    const list = json?.data || []; // { name: "xxx", url: "xxx" }
    return processList("小红书热榜", list, cfg, "title", "url")?.map(p => ({
       ...p, url: p.url || "xhsdiscover://"
    }));
  } catch(e) { log("XHS Err: " + e); return null; }
}

// ========== 5. 执行 ==========

!(async () => {
  if (!checkTime()) {
    log("非推送时间，跳过");
    $done();
    return;
  }

  const tasks = [];
  if (CFG.weibo.enable) tasks.push(fetchWeibo());
  if (CFG.baidu.enable) tasks.push(fetchBaidu());
  if (CFG.zhihu.enable) tasks.push(fetchZhihu());
  if (CFG.douyin.enable) tasks.push(fetchDouyin());
  if (CFG.bilibili.enable) tasks.push(fetchBilibili());
  if (CFG.kr36.enable) tasks.push(fetch36Kr());
  if (CFG.toutiao.enable) tasks.push(fetchToutiao());
  if (CFG.kuaishou.enable) tasks.push(fetchKuaishou());
  if (CFG.xhs.enable) tasks.push(fetchXHS());

  const results = await Promise.all(tasks);
  
  let count = 0;
  for (const group of results) {
    if (group && group.length > 0) {
      for (const item of group) {
        notify(item.title, item.body, ATTACH_LINK ? item.url : "");
        count++;
      }
    }
  }

  log(`执行结束，共推送 ${count} 条通知`);
  $done();
})();
