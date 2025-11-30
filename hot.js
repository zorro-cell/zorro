/*******************************
 * 多平台热榜 - hot.js（定制版）
 *
 * 修正点：
 *  - B站：分开推送时尽量直达视频
 *  - 百度：改为调起百度App搜索，而不是在 QX 内打开网页
 *  - 36氪：统一跳到 https://36kr.com/hot-list（人气榜）
 *  - 抖音 / 微博 / 快手：恢复正常跳转，不再额外处理
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

// 关键词：支持中文逗号、英文逗号、空格、换行分隔
const KEYWORD_STRING = readStore("hot_keywords", "");
const KEYWORDS = KEYWORD_STRING.split(/[,，\s\n]/)
  .map((x) => x.trim())
  .filter(Boolean);

// 通知里是否附带跳转链接（BoxJs: hot_attach_link）
const ATTACH_LINK = readBool("hot_attach_link", true);

// 每个榜单的 BoxJs 配置
const CFG = {
  weibo: {
    enable: readBool("hot_weibo_enable", true),
    split: readBool("hot_weibo_split", false),
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

// 从条目里尽量抽取一个可用的链接（优先具体内容，其次备用链接）
function pickUrl(item, fallback) {
  const urls = [];

  function collect(obj) {
    if (!obj || typeof obj !== "object") return;
    const keys = [
      "scheme",
      "url",
      "link",
      "href",
      "mobileUrl",
      "mobile_url",
      "appUrl",
      "app_url",
      "target_url",
      "targetUrl",
      "jump_url",
      "jumpUrl"
    ];
    for (const k of keys) {
      if (typeof obj[k] === "string") urls.push(obj[k]);
    }
  }

  if (typeof item === "string") {
    urls.push(item);
  } else if (item && typeof item === "object") {
    collect(item);
    // 常见嵌套字段再扫一遍
    ["target", "card", "object", "templateMaterial", "mblog"].forEach((k) => {
      if (item[k] && typeof item[k] === "object") collect(item[k]);
    });
  }

  for (const raw of urls) {
    const v = String(raw).trim();
    if (!v) continue;
    if (/^https?:\/\//i.test(v)) return v; // http(s)
    if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(v)) return v; // 自定义 scheme
  }

  return fallback || "";
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

// 简单封装 GET（以 Quantumult X 为主）
function httpGet(url, headers = UA) {
  if (typeof $task !== "undefined") {
    return $task.fetch({
      url,
      method: "GET",
      headers
    });
  }
  // 其他环境（Surge / Loon）简单适配
  return new Promise((resolve, reject) => {
    if (typeof $httpClient === "undefined") {
      reject(new Error("当前环境不支持 httpGet"));
      return;
    }
    $httpClient.get({ url, headers }, (err, resp, body) => {
      if (err) reject(err);
      else resolve({ statusCode: resp.status || resp.statusCode, body });
    });
  });
}

// 通用：构造 pushes（大部分平台用这个）
function makePushes(name, cfg, usedItems, lines, defaultUrl, itemList) {
  // 不分开推送：一条通知
  if (!cfg.split) {
    return {
      ok: true,
      title: name,
      pushes: [
        {
          title: `${name} Top${usedItems.length}`,
          body: lines.join("\n"),
          openUrl: defaultUrl
        }
      ]
    };
  }

  // 分开推送：每一条都是单独通知
  const pushes = usedItems.map((item, idx) => ({
    title: `${name} 第${idx + 1}名`,
    body: lines[idx],
    openUrl: pickUrl(itemList[idx], defaultUrl)
  }));

  return { ok: true, title: name, pushes };
}

// ========== 特定平台的跳转修正 ==========

// B站：把网页链接尽量转成 bilibili://video/BVXXX
function transformBilibiliUrl(rawUrl, fallback) {
  if (!rawUrl) return fallback;
  const u = String(rawUrl).trim();

  // 已经是 bilibili:// 直接用
  if (/^bilibili:\/\//i.test(u)) return u;

  // 标准视频页
  const m = u.match(
    /https?:\/\/(?:www\.)?bilibili\.com\/video\/(BV[0-9A-Za-z]+)/i
  );
  if (m) {
    return "bilibili://video/" + m[1];
  }

  // 其它链接（b23.tv 等），就走原始链接
  return u || fallback;
}

// 百度：构造百度App搜索的 scheme
function buildBaiduSearchUrl(word) {
  const q = encodeURIComponent(word || "");
  // 常见分享里用到的 searchbox scheme
  return `baiduboxapp://searchbox?from=hotjs&word=${q}`;
}

// 36氪：统一跳到人气榜（热榜）
function build36KrHotListUrl() {
  return "https://36kr.com/hot-list";
}

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

    // 微博：直接用通用 makePushes（不要额外加工，保证按原来那样正常跳转）
    return makePushes(name, cfg, used, lines, defaultUrl, used);
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

    // 抖音：也保持原样，用统一 trending 页面 scheme
    return makePushes(name, cfg, used, lines, defaultUrl, used);
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 3. 百度热搜（xxapi）——改为调起百度 App 搜索
async function fetchBaidu() {
  const name = "百度热搜";
  const cfg = CFG.baidu;
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

    // 不分开推送：用第 1 条的标题做搜索词
    if (!cfg.split) {
      const topTitle = pickTitle(used[0]) || "热搜榜";
      const url = buildBaiduSearchUrl(topTitle);
      return {
        ok: true,
        title: name,
        pushes: [
          {
            title: `${name} Top${used.length}`,
            body: lines.join("\n"),
            openUrl: url
          }
        ]
      };
    }

    // 分开推送：每条用自己的标题做搜索词
    const pushes = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      return {
        title: `${name} 第${idx + 1}名`,
        body: lines[idx],
        openUrl: buildBaiduSearchUrl(title)
      };
    });

    return { ok: true, title: name, pushes };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 4. 36 氪热榜（xxapi）——统一跳到 36kr 人气榜
async function fetch36Kr() {
  const name = "36 氪热榜";
  const cfg = CFG.kr36;
  const defaultUrl = build36KrHotListUrl();
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
      // 不分开推送：点击就统一到 36kr 人气榜
      return {
        ok: true,
        title: name,
        pushes: [
          {
            title: `${name} Top${used.length}`,
            body: lines.join("\n"),
            openUrl: defaultUrl
          }
        ]
      };
    }

    // 分开推送：每条也都统一跳人气榜（你需求是定位到人气榜，而不是每篇文章）
    const pushes = used.map((item, idx) => ({
      title: `${name} 第${idx + 1}名`,
      body: lines[idx],
      openUrl: defaultUrl
    }));

    return { ok: true, title: name, pushes };
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

    return makePushes(name, cfg, used, lines, defaultUrl, used);
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 6. B 站热门（今日热榜 / PearAPI）——修正为尽量直达视频
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
      // 不分开推送：保持原样，打开 B站热门页
      return {
        ok: true,
        title: name,
        pushes: [
          {
            title: `${name} Top${used.length}`,
            body: lines.join("\n"),
            openUrl: defaultUrl
          }
        ]
      };
    }

    // 分开推送：尽量直达对应视频
    const pushes = used.map((item, idx) => {
      const rawUrl = pickUrl(item, defaultUrl);
      const openUrl = transformBilibiliUrl(rawUrl, defaultUrl);
      return {
        title: `${name} 第${idx + 1}名`,
        body: lines[idx],
        openUrl
      };
    });

    return { ok: true, title: name, pushes };
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

    return makePushes(name, cfg, used, lines, defaultUrl, used);
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 8. 快手热榜（icofun：只给文本，没有原文链接）
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

    const keys = Object.keys(json || {}).filter((k) =>
      /^Top_\d+/i.test(k)
    );
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

    const lines = used.map((t, idx) => {
      const title = pickTitle(t) || "无标题";
      return `${idx + 1}. ${title}`;
    });

    // 快手：本身就只拿文本，保持原有 scheme，不做别的处理
    return makePushes(name, cfg, used, lines, defaultUrl, used);
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 9. 小红书热门话题（今日热榜 / PearAPI）
async function fetchXHS() {
  const name = "小红书热门话题";
  const cfg = CFG.xhs;
  const defaultUrl = "xhsdiscover://"; // 打开小红书发现页
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

    return makePushes(name, cfg, used, lines, defaultUrl, used);
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
    if (typeof $done === "function") $done();
    return;
  }

  const results = await Promise.all(tasks);

  results.forEach((res) => {
    if (!res) return;
    if (res.ok && Array.isArray(res.pushes)) {
      res.pushes.forEach((p) => {
        const opts = {};
        if (ATTACH_LINK && p.openUrl) {
          opts["open-url"] = p.openUrl;
        }
        $notify("热门监控", p.title || "", p.body || "", opts);
      });
    } else if (!res.skip) {
      // 真报错（网络 / 接口挂了）才提示
      $notify(
        `${res.title || "某平台"} 获取失败`,
        "",
        String(res.err || "未知错误")
      );
    }
  });

  if (typeof $done === "function") $done();
})().catch((e) => {
  log(`脚本运行异常：${e.message || e}`);
  $notify("热榜脚本异常", "", String(e));
  if (typeof $done === "function") $done();
});
