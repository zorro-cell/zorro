/*******************************
 * 多平台热榜 - hot.js
 * 作者：心事全在脸上
 *
 * 支持的榜单：
 *  - 微博热搜（xxapi）
 *  - 知乎热榜（PearAPI / 今日热榜）
 *  - 百度热搜（xxapi）
 *  - B站热门（PearAPI / 今日热榜）
 *  - 抖音热榜（xxapi）
 *  - 36氪热榜（xxapi）
 *  - 今日头条热榜（PearAPI / 今日热榜）
 *  - 快手热榜（icofun）
 *  - 小红书热门话题（PearAPI / 今日热榜）
 *
 * 主要功能：
 *  - 关键词监控：命中才推送 / 未命中则按配置决定是否推送最新 N 条
 *  - 可选「分开推送内容」：每条单独一条通知（模仿 evilbutcher 老版本）
 *  - 可选「附带跳转链接」：在通知正文里附上链接文本
 *******************************/

// ========== 通用存储读写（兼容 Quantumult X / Surge） ==========

function readStore(key, defVal = "") {
  try {
    if (typeof $prefs !== "undefined") {
      const v = $prefs.valueForKey(key);
      return v === undefined || v === null ? defVal : v;
    }
    if (typeof $persistentStore !== "undefined") {
      const v = $persistentStore.read(key);
      return v === undefined || v === null ? defVal : v;
    }
  } catch (e) {}
  return defVal;
}

function readBool(key, defVal = false) {
  const v = readStore(key, defVal ? "true" : "false");
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  return s === "true" || s === "1" || s === "on";
}

function readInt(key, defVal = 3) {
  const v = parseInt(readStore(key, String(defVal)), 10);
  return isNaN(v) ? defVal : v;
}

// ========== 全局配置 ==========

// 监控关键词：支持中文逗号 / 英文逗号 / 空格 / 换行分隔
const KEYWORD_STRING = readStore("hot_keywords", "");
const KEYWORDS = KEYWORD_STRING.split(/[,，\s\n]/)
  .map((x) => x.trim())
  .filter(Boolean);

// 附带跳转链接（在通知正文里附上 URL）
const ATTACH_LINK = readBool("hot_attach_link", false);

// 每个榜单的 BoxJs 配置
const CFG = {
  weibo: {
    enable: readBool("hot_weibo_enable", true),
    split: readBool("hot_weibo_split", false), // 分开推送微博内容
    ignorePushLatest: readBool("hot_weibo_ignore", true),
    count: readInt("hot_weibo_count", 3)
  },
  zhihu: {
    enable: readBool("hot_zhihu_enable", false),
    split: readBool("hot_zhihu_split", false),
    ignorePushLatest: readBool("hot_zhihu_ignore", false),
    count: readInt("hot_zhihu_count", 3)
  },
  baidu: {
    enable: readBool("hot_baidu_enable", true),
    split: readBool("hot_baidu_split", false),
    ignorePushLatest: readBool("hot_baidu_ignore", true),
    count: readInt("hot_baidu_count", 3)
  },
  bilibili: {
    enable: readBool("hot_bilibili_enable", false),
    split: readBool("hot_bilibili_split", false),
    ignorePushLatest: readBool("hot_bilibili_ignore", false),
    count: readInt("hot_bilibili_count", 3)
  },
  douyin: {
    enable: readBool("hot_douyin_enable", true),
    split: readBool("hot_douyin_split", false),
    ignorePushLatest: readBool("hot_douyin_ignore", true),
    count: readInt("hot_douyin_count", 3)
  },
  kr36: {
    enable: readBool("hot_36kr_enable", false),
    split: readBool("hot_36kr_split", false),
    ignorePushLatest: readBool("hot_36kr_ignore", false),
    count: readInt("hot_36kr_count", 3)
  },
  toutiao: {
    enable: readBool("hot_toutiao_enable", false),
    split: readBool("hot_toutiao_split", false),
    ignorePushLatest: readBool("hot_toutiao_ignore", false),
    count: readInt("hot_toutiao_count", 3)
  },
  kuaishou: {
    enable: readBool("hot_kuaishou_enable", false),
    split: readBool("hot_kuaishou_split", false),
    ignorePushLatest: readBool("hot_kuaishou_ignore", false),
    count: readInt("hot_kuaishou_count", 3)
  },
  xhs: {
    enable: readBool("hot_xhs_enable", false),
    split: readBool("hot_xhs_split", false),
    ignorePushLatest: readBool("hot_xhs_ignore", false),
    count: readInt("hot_xhs_count", 3)
  }
};

// 是否输出日志
const DEBUG_LOG = true;
function log(msg) {
  if (DEBUG_LOG) console.log(`[HotSearch] ${msg}`);
}

// 通用 UA
const UA = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
};

// ========== 公共函数 ==========

// 安全 JSON 解析（防止接口返回 HTML）
function parseJSON(body, label) {
  if (!body) throw new Error(`${label} 返回为空`);
  if (typeof body !== "string") return body;

  const trimmed = body.trim();
  if (!trimmed) throw new Error(`${label} 返回空字符串`);

  // 很多免费 API 出错时会直接返回 HTML
  if (trimmed[0] === "<") {
    throw new Error(`${label} 返回的是 HTML（疑似 403/404/安全验证页）`);
  }

  try {
    return JSON.parse(trimmed);
  } catch (e) {
    throw new Error(`${label} JSON 解析失败：${e.message || e}`);
  }
}

// 把一条记录转成“标题字符串”
function pickTitle(item) {
  if (!item) return "";

  // 本身是字符串
  if (typeof item === "string") return item.trim();

  if (typeof item !== "object") {
    try {
      return String(item);
    } catch (e) {
      return "";
    }
  }

  // 通用字段
  const keys = [
    "title",
    "word",
    "name",
    "hot_word",
    "keyword",
    "note",
    "desc",
    "summary",
    "content"
  ];
  for (const k of keys) {
    if (item[k] && typeof item[k] === "string") return item[k].trim();
  }

  // 兼容 36 氪：标题在 templateMaterial.widgetTitle
  if (
    item.templateMaterial &&
    typeof item.templateMaterial.widgetTitle === "string"
  ) {
    return item.templateMaterial.widgetTitle.trim();
  }

  try {
    return JSON.stringify(item).slice(0, 80);
  } catch (e) {
    return "";
  }
}

// 从条目里尽量挑出一个 URL / Scheme，用于分开推送时点击直达
function pickUrl(item, fallback) {
  if (!item || typeof item !== "object") return fallback;

  const candidates = [
    "url",
    "link",
    "href",
    "scheme",
    "schema",
    "target_url",
    "targetUrl",
    "mobileUrl",
    "mobile_url",
    "appUrl",
    "app_url",
    "share_url",
    "shareUrl"
  ];

  for (const key of candidates) {
    const v = item[key];
    if (typeof v === "string" && v) return v;
  }

  if (item.extra && typeof item.extra === "object") {
    for (const key of candidates) {
      const v = item.extra[key];
      if (typeof v === "string" && v) return v;
    }
  }

  if (item.origin && typeof item.origin === "object") {
    for (const key of candidates) {
      const v = item.origin[key];
      if (typeof v === "string" && v) return v;
    }
  }

  return fallback;
}

// 根据关键词 & 配置，从原始列表中选出要推送的条目
function selectItems(boardName, rawList, cfg) {
  if (!Array.isArray(rawList) || rawList.length === 0) return null;

  const count = Math.max(1, cfg.count || 3);
  const list = rawList.slice(); // 拷贝一份

  // 没设置任何关键词
  if (KEYWORDS.length === 0) {
    if (!cfg.ignorePushLatest) {
      log(
        `${boardName}：未设置关键词且未开启“忽略关键词推送最新内容”，跳过`
      );
      return null;
    }
    log(`${boardName}：未设置关键词，直接推最新 ${count} 条`);
    return list.slice(0, count);
  }

  // 有关键词：先过滤命中的
  const matched = list.filter((item) => {
    const title = pickTitle(item);
    return title && KEYWORDS.some((k) => title.includes(k));
  });

  if (matched.length > 0) {
    log(`${boardName}：命中关键词 ${matched.length} 条，取前 ${count} 条`);
    return matched.slice(0, count);
  }

  // 没命中关键词
  if (cfg.ignorePushLatest) {
    log(`${boardName}：未命中关键词，改为推最新 ${count} 条`);
    return list.slice(0, count);
  }

  log(
    `${boardName}：未命中关键词且未开启“忽略关键词推送最新内容”，跳过`
  );
  return null;
}

// 简单封装 GET（Quantumult X）
function httpGet(url, headers = UA) {
  return $task.fetch({
    url,
    method: "GET",
    headers
  });
}

// 各 fetch 函数统一返回格式：
// { ok: true, pushes: [ { title, body, openUrl }, ... ] }
// or { ok:false, title, err, skip }

// ========== 各平台获取函数 ==========

// 1. 微博热搜（xxapi）
async function fetchWeibo() {
  const name = "微博热搜";
  const cfg = CFG.weibo;
  const defaultUrl =
    "sinaweibo://pageinfo?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot";
  log(`开始获取  ${name}…`);

  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/weibohot");
    const json = parseJSON(resp.body, name);

    if (json.code !== 200 || !Array.isArray(json.data)) {
      throw new Error(json.msg || json.message || "接口返回格式异常");
    }

    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };

    const lines = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      const hot = item.hot || item.hotValue || item.hot_value;
      const hotStr = hot ? `【热度：${hot}】` : "";
      return `${idx + 1}. ${title}${hotStr}`;
    });

    if (!cfg.split) {
      return {
        ok: true,
        pushes: [
          {
            title: `${name} Top${used.length}`,
            body: lines.join("\n"),
            openUrl: defaultUrl
          }
        ]
      };
    }

    const pushes = used.map((item, idx) => ({
      title: `${name} 第${idx + 1}名`,
      body: lines[idx],
      openUrl: pickUrl(item, defaultUrl)
    }));

    return { ok: true, pushes };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 2. 抖音热榜（xxapi）
async function fetchDouyin() {
  const name = "抖音热榜";
  const cfg = CFG.douyin;
  const defaultUrl = "snssdk1128://search/trending";
  log(`开始获取  ${name}…`);

  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/douyinhot");
    const json = parseJSON(resp.body, name);

    if (json.code !== 200 || !Array.isArray(json.data)) {
      throw new Error(json.msg || json.message || "接口返回格式异常");
    }

    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };

    const lines = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      return `${idx + 1}. ${title}`;
    });

    if (!cfg.split) {
      return {
        ok: true,
        pushes: [
          {
            title: `${name} Top${used.length}`,
            body: lines.join("\n"),
            openUrl: defaultUrl
          }
        ]
      };
    }

    const pushes = used.map((item, idx) => ({
      title: `${name} 第${idx + 1}名`,
      body: lines[idx],
      openUrl: pickUrl(item, defaultUrl)
    }));

    return { ok: true, pushes };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 3. 百度热搜（xxapi）
async function fetchBaidu() {
  const name = "百度热搜";
  const cfg = CFG.baidu;
  const defaultUrl = "https://rebang.today/?tab=baidu";
  log(`开始获取  ${name}…`);

  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/baiduhot");
    const json = parseJSON(resp.body, name);

    if (json.code !== 200 || !Array.isArray(json.data)) {
      throw new Error(json.msg || json.message || "接口返回格式异常");
    }

    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };

    const lines = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      return `${idx + 1}. ${title}`;
    });

    if (!cfg.split) {
      return {
        ok: true,
        pushes: [
          {
            title: `${name} Top${used.length}`,
            body: lines.join("\n"),
            openUrl: defaultUrl
          }
        ]
      };
    }

    const pushes = used.map((item, idx) => ({
      title: `${name} 第${idx + 1}名`,
      body: lines[idx],
      openUrl: pickUrl(item, defaultUrl)
    }));

    return { ok: true, pushes };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 4. 36 氪热榜（xxapi）
async function fetch36Kr() {
  const name = "36 氪热榜";
  const cfg = CFG.kr36;
  const defaultUrl = "https://rebang.today/?tab=36kr";
  log(`开始获取  ${name}…`);

  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/hot36kr");
    const json = parseJSON(resp.body, name);

    if (json.code !== 200 || !Array.isArray(json.data)) {
      throw new Error(json.msg || json.message || "接口返回格式异常");
    }

    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };

    const lines = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      const author =
        item.templateMaterial && item.templateMaterial.authorName
          ? `（${item.templateMaterial.authorName}）`
          : "";
      return `${idx + 1}. ${title}${author}`;
    });

    if (!cfg.split) {
      return {
        ok: true,
        pushes: [
          {
            title: `${name} Top${used.length}`,
            body: lines.join("\n"),
            openUrl: defaultUrl
          }
        ]
      };
    }

    const pushes = used.map((item, idx) => ({
      title: `${name} 第${idx + 1}名`,
      body: lines[idx],
      openUrl: pickUrl(item, defaultUrl)
    }));

    return { ok: true, pushes };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 5. 知乎热榜（今日热榜 / PearAPI）
async function fetchZhihu() {
  const name = "知乎热榜";
  const cfg = CFG.zhihu;
  const defaultUrl = "zhihu://zhihu.com/hot";
  log(`开始获取  ${name}…`);

  try {
    const url =
      "https://api.pearktrue.cn/api/dailyhot/?title=" +
      encodeURIComponent("知乎");
    const resp = await httpGet(url);
    const json = parseJSON(resp.body, name);

    const data = Array.isArray(json.data) ? json.data : json.data && json.data.list;
    if (!Array.isArray(data)) {
      throw new Error(json.msg || json.message || "接口返回格式异常");
    }

    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };

    const lines = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      return `${idx + 1}. ${title}`;
    });

    if (!cfg.split) {
      return {
        ok: true,
        pushes: [
          {
            title: `${name} Top${used.length}`,
            body: lines.join("\n"),
            openUrl: defaultUrl
          }
        ]
      };
    }

    const pushes = used.map((item, idx) => ({
      title: `${name} 第${idx + 1}名`,
      body: lines[idx],
      openUrl: pickUrl(item, defaultUrl)
    }));

    return { ok: true, pushes };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 6. B 站热门（今日热榜 / PearAPI）
async function fetchBilibili() {
  const name = "B站热门";
  const cfg = CFG.bilibili;
  const defaultUrl = "bilibili://popular";
  log(`开始获取  ${name}…`);

  try {
    const url =
      "https://api.pearktrue.cn/api/dailyhot/?title=" +
      encodeURIComponent("哔哩哔哩");
    const resp = await httpGet(url);
    const json = parseJSON(resp.body, name);

    const data = Array.isArray(json.data) ? json.data : json.data && json.data.list;
    if (!Array.isArray(data)) {
      throw new Error(json.msg || json.message || "接口返回格式异常");
    }

    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };

    const lines = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      return `${idx + 1}. ${title}`;
    });

    if (!cfg.split) {
      return {
        ok: true,
        pushes: [
          {
            title: `${name} Top${used.length}`,
            body: lines.join("\n"),
            openUrl: defaultUrl
          }
        ]
      };
    }

    const pushes = used.map((item, idx) => ({
      title: `${name} 第${idx + 1}名`,
      body: lines[idx],
      openUrl: pickUrl(item, defaultUrl)
    }));

    return { ok: true, pushes };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 7. 今日头条热榜（今日热榜 / PearAPI）
async function fetchToutiao() {
  const name = "今日头条热榜";
  const cfg = CFG.toutiao;
  const defaultUrl = "snssdk141://"; // 拉起头条 App
  log(`开始获取  ${name}…`);

  try {
    const url =
      "https://api.pearktrue.cn/api/dailyhot/?title=" +
      encodeURIComponent("今日头条");
    const resp = await httpGet(url);
    const json = parseJSON(resp.body, name);

    const data = Array.isArray(json.data) ? json.data : json.data && json.data.list;
    if (!Array.isArray(data)) {
      throw new Error(json.msg || json.message || "接口返回格式异常");
    }

    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };

    const lines = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      return `${idx + 1}. ${title}`;
    });

    if (!cfg.split) {
      return {
        ok: true,
        pushes: [
          {
            title: `${name} Top${used.length}`,
            body: lines.join("\n"),
            openUrl: defaultUrl
          }
        ]
      };
    }

    const pushes = used.map((item, idx) => ({
      title: `${name} 第${idx + 1}名`,
      body: lines[idx],
      openUrl: pickUrl(item, defaultUrl)
    }));

    return { ok: true, pushes };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 8. 快手热榜（icofun）
async function fetchKuaishou() {
  const name = "快手热榜";
  const cfg = CFG.kuaishou;
  const defaultUrl = "kwai://search/topicRank";
  log(`开始获取  ${name}…`);

  try {
    const resp = await httpGet(
      "https://api.icofun.cn/api/kuaishou_hot_search.php?type=json"
    );
    const json = parseJSON(resp.body, name);

    // 返回形如 { "Top_1": "...", "Top_2": "...", ... }
    const keys = Object.keys(json || {}).filter((k) => /^Top_\d+/i.test(k));
    if (keys.length === 0) {
      throw new Error("接口返回格式异常");
    }

    keys.sort((a, b) => {
      const na = parseInt(a.split("_")[1], 10) || 0;
      const nb = parseInt(b.split("_")[1], 10) || 0;
      return na - nb;
    });

    const list = keys.map((k) => json[k]).filter(Boolean);

    const used = selectItems(name, list, cfg);
    if (!used) return { ok: false, title: name, skip: true };

    const lines = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      return `${idx + 1}. ${title}`;
    });

    if (!cfg.split) {
      return {
        ok: true,
        pushes: [
          {
            title: `${name} Top${used.length}`,
            body: lines.join("\n"),
            openUrl: defaultUrl
          }
        ]
      };
    }

    const pushes = used.map((item, idx) => ({
      title: `${name} 第${idx + 1}名`,
      body: lines[idx],
      openUrl: pickUrl(item, defaultUrl)
    }));

    return { ok: true, pushes };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 9. 小红书热门话题（今日热榜 / PearAPI）
async function fetchXHS() {
  const name = "小红书热门话题";
  const cfg = CFG.xhs;
  const defaultUrl = "xhsdiscover://";
  log(`开始获取  ${name}…`);

  try {
    const url =
      "https://api.pearktrue.cn/api/dailyhot/?title=" +
      encodeURIComponent("小红书");
    const resp = await httpGet(url);
    const json = parseJSON(resp.body, name);

    const data = Array.isArray(json.data) ? json.data : json.data && json.data.list;
    if (!Array.isArray(data)) {
      throw new Error(json.msg || json.message || "接口返回格式异常");
    }

    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };

    const lines = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      return `${idx + 1}. ${title}`;
    });

    if (!cfg.split) {
      return {
        ok: true,
        pushes: [
          {
            title: `${name} Top${used.length}`,
            body: lines.join("\n"),
            openUrl: defaultUrl
          }
        ]
      };
    }

    const pushes = used.map((item, idx) => ({
      title: `${name} 第${idx + 1}名`,
      body: lines[idx],
      openUrl: pickUrl(item, defaultUrl)
    }));

    return { ok: true, pushes };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// ========== 主流程 ==========

!(async () => {
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
    log("所有榜单都被关闭，脚本直接结束");
    $done();
    return;
  }

  const results = await Promise.all(tasks);

  results.forEach((res) => {
    if (!res) return;

    if (res.ok && Array.isArray(res.pushes)) {
      res.pushes.forEach((p) => {
        if (!p) return;

        let body = p.body || "";
        const extra = {};

        if (p.openUrl) {
          extra["open-url"] = p.openUrl;
          if (ATTACH_LINK) {
            body = body
              ? body + "\n\n🔗 " + p.openUrl
              : "🔗 " + p.openUrl;
          }
        }

        $notify(p.title || "热门监控", "", body, extra);
      });
    } else if (!res.skip) {
      $notify(`${res.title || "热榜"} 获取失败`, "", String(res.err || "未知错误"));
    }
  });

  $done();
})().catch((e) => {
  log(`脚本运行异常：${e.message || e}`);
  $notify("热榜脚本异常", "", String(e));
  $done();
});
