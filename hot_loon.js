// 多平台热榜监控 - Loon 版（加强修复版）
// 更新日期: 2025-12-13
// 修复点：
// 1) 全平台 Top1 通知置顶（倒序发送通知）
// 2) B站：改为“全站热榜/排行榜”数据源（ranking/v2 全站）
// 3) B站：单条通知点击直达视频（bilibili://video/...）
// 4) B站：合集通知点击优先拉起“App 原生排行榜页”（默认 bilibili://rank），避免网页/白底 WebView

// ========== 参数解析 ==========
const $config = {};

// 兼容：Loon 对象参数 & "a=1&b=2" 字符串参数
if (typeof $argument !== "undefined") {
  if (typeof $argument === "object") {
    Object.keys($argument).forEach((key) => {
      const val = $argument[key];
      if (val !== undefined && val !== null && val !== "") {
        $config[key] = val;
      }
    });
  } else if (typeof $argument === "string") {
    $argument
      .split("&")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((kv) => {
        const [k, v = ""] = kv.split("=");
        if (!k) return;
        let val = v.trim();
        try {
          val = decodeURIComponent(val);
        } catch (_) {}
        $config[k] = val;
      });
  }
}

function getConfig(key, type, defVal) {
  let v = $config[key];
  if (v === undefined || v === null || v === "") return defVal;
  if (type === "bool") return String(v).toLowerCase() === "true";
  if (type === "int") return parseInt(v, 10) || defVal;
  return String(v);
}

// ========== 全局配置 ==========
const KEYWORDS_STR = getConfig("hot_keywords", "string", "");
const KEYWORDS = KEYWORDS_STR
  .split(/[,，\s]+/)
  .map((k) => k.trim())
  .filter(Boolean);

const PUSH_HOURS_STR = getConfig("hot_push_hours", "string", "");
const ATTACH_LINK = getConfig("hot_attach_link", "bool", true);

const ENABLE_RETRY = getConfig("hot_enable_retry", "bool", true);
// 默认只重试 1 次（总共最多 2 轮）
const MAX_RETRIES = getConfig("hot_max_retries", "int", 1);
// 是否打印详细 HTTP 日志（可选开关，默认 false）
const DETAIL_LOG = getConfig("hot_log_detail", "bool", false);
// 额外保险丝超时时间（毫秒），防止回调不触发，比如 12000
const GUARD_TIMEOUT = getConfig("hot_guard_timeout", "int", 12000);

// ✅ B站合集通知打开的“原生排行榜页” URL（可用参数覆盖）
// 你要第三张那种“排行榜原生页”，必须走 bilibili:// 这类内部路由，不能用 https / bilibili://browser
// 如果你发现 bilibili://rank 在你设备上不是排行榜页，可以尝试改成（任选其一）：
// - bilibili://rank/
// - bilibili://popular
// - bilibili://main/home/
// 但默认优先 bilibili://rank（最像“排行榜入口”）
const BILIBILI_HOME = getConfig("hot_bilibili_home", "string", "bilibili://rank");

console.log(`🎯 [配置] 关键词: ${KEYWORDS.length ? KEYWORDS.join(", ") : "全部"}`);
console.log(`⏰ [配置] 推送时间: ${PUSH_HOURS_STR || "全天"}`);
console.log(`🔗 [配置] 附带链接: ${ATTACH_LINK ? "是" : "否"}`);
console.log(`🔄 [配置] 请求重试: ${ENABLE_RETRY ? `开启 (最多${MAX_RETRIES}次)` : "关闭"}`);
console.log(`⏱ [配置] 自定义超时保护: ${GUARD_TIMEOUT} ms`);
console.log(`📌 [B站] 合集跳转: ${BILIBILI_HOME}`);

// ========== 平台配置 ==========
const PLATFORMS = {
  weibo: {
    name: "微博热搜",
    home: "sinaweibo://pageinfo?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot",
    urls: [
      "https://xzdx.top/api/tophub?type=weibo",
      "https://v2.xxapi.cn/api/weibohot",
      "https://api.vvhan.com/api/hotlist?type=weibo",
      "https://tenapi.cn/v2/weibohot",
      "https://api-hot.imsyy.top/weibo",
    ],
    enable: getConfig("hot_weibo_enable", "bool", true),
    split: getConfig("hot_weibo_split", "bool", true),
    ignore: getConfig("hot_weibo_ignore", "bool", true),
    count: getConfig("hot_weibo_count", "int", 3),
  },

  baidu: {
    name: "百度热搜",
    home: "baiduboxapp://v1/easybrowse/open?url=https%3A%2F%2Ftop.baidu.com%2Fboard%3Ftab%3Drealtime",
    urls: [
      "https://xzdx.top/api/tophub?type=baidu",
      "https://v2.xxapi.cn/api/baiduhot",
      "https://api.vvhan.com/api/hotlist?type=baiduRD",
      "https://tenapi.cn/v2/baiduhot",
      "https://api-hot.imsyy.top/baidu",
    ],
    enable: getConfig("hot_baidu_enable", "bool", true),
    split: getConfig("hot_baidu_split", "bool", true),
    ignore: getConfig("hot_baidu_ignore", "bool", true),
    count: getConfig("hot_baidu_count", "int", 3),
  },

  douyin: {
    name: "抖音热榜",
    home: "snssdk1128://search/trending",
    urls: [
      "https://xzdx.top/api/tophub?type=douyin",
      "https://v2.xxapi.cn/api/douyinhot",
      "https://api.vvhan.com/api/hotlist?type=douyin",
      "https://tenapi.cn/v2/douyinhot",
      "https://api-hot.imsyy.top/douyin",
    ],
    enable: getConfig("hot_douyin_enable", "bool", true),
    split: getConfig("hot_douyin_split", "bool", true),
    ignore: getConfig("hot_douyin_ignore", "bool", true),
    count: getConfig("hot_douyin_count", "int", 3),
  },

  zhihu: {
    name: "知乎热榜",
    home: "zhihu://topstory/hot-list",
    urls: [
      "https://api.vvhan.com/api/hotlist?type=zhihu",
      "https://xzdx.top/api/tophub?type=zhihu",
      "https://v2.xxapi.cn/api/zhihuhot",
      "https://api.oioweb.cn/api/common/hotlist/zhihu",
      "https://tenapi.cn/v2/zhihuhot",
      "https://api.guole.fun/zhihu",
      "https://api.zhihu.com/topstory/hot-lists/total?limit=50",
    ],
    enable: getConfig("hot_zhihu_enable", "bool", true),
    split: getConfig("hot_zhihu_split", "bool", true),
    ignore: getConfig("hot_zhihu_ignore", "bool", true),
    count: getConfig("hot_zhihu_count", "int", 3),
  },

  // ✅ B站：改为“全站热榜/排行榜”
  bilibili: {
    name: "B站全站热榜",
    // ✅ 合集通知：优先打开 App 原生排行榜页（避免 https / browser webview）
    home: BILIBILI_HOME,
    urls: [
      // ✅ 1) 官方：全站排行榜（你截图第三张“排行榜/全站”对齐这个）
      "https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all",
      // ✅ 2) 备用：综合热门（万一排行榜接口临时异常）
      "https://api.bilibili.com/x/web-interface/popular?ps=50&pn=1",
      // 兜底：第三方聚合接口
      "https://api.vvhan.com/api/hotlist?type=bilibili",
      "https://xzdx.top/api/tophub?type=bilihot",
      "https://v.api.aa1.cn/api/bilibili-rs/",
      "https://v2.xxapi.cn/api/bilibilihot",
      "https://tenapi.cn/v2/bilihot",
    ],
    enable: getConfig("hot_bilibili_enable", "bool", true),
    split: getConfig("hot_bilibili_split", "bool", true),
    ignore: getConfig("hot_bilibili_ignore", "bool", true),
    // 你想要 Top10 就设置 hot_bilibili_count=10
    count: getConfig("hot_bilibili_count", "int", 10),
  },

  kr36: {
    name: "36氪热榜",
    home: "https://36kr.com/newsflashes",
    urls: [
      "https://api.vvhan.com/api/hotlist?type=36kr",
      "https://v2.xxapi.cn/api/hot36kr",
      "https://tenapi.cn/v2/36krhot",
      "https://xzdx.top/api/tophub?type=36kr",
      "https://api-hot.imsyy.top/36kr",
      "https://api.oioweb.cn/api/common/hotlist/36kr",
      "https://api-bz.ayou.xyz/v1/news/36kr",
      "https://api.gumengya.com/Api/36Kr",
    ],
    enable: getConfig("hot_36kr_enable", "bool", false),
    split: getConfig("hot_36kr_split", "bool", true),
    ignore: getConfig("hot_36kr_ignore", "bool", true),
    count: getConfig("hot_36kr_count", "int", 3),
  },

  toutiao: {
    name: "头条热榜",
    home: "snssdk141://",
    urls: [
      "https://api.vvhan.com/api/hotlist?type=toutiao",
      "https://xzdx.top/api/tophub?type=toutiao",
      "https://v2.xxapi.cn/api/toutiaohot",
      "https://api.oioweb.cn/api/common/hotlist/toutiao",
      "https://api.guole.fun/toutiao",
    ],
    enable: getConfig("hot_toutiao_enable", "bool", false),
    split: getConfig("hot_toutiao_split", "bool", true),
    ignore: getConfig("hot_toutiao_ignore", "bool", true),
    count: getConfig("hot_toutiao_count", "int", 3),
  },

  xhs: {
    name: "小红书热榜",
    home: "xhsdiscover://home/explore",
    urls: [
      "https://api.vvhan.com/api/hotlist?type=xhs",
      "https://api.itapi.cn/api/hotnews/xiaohongshu?key=8BheThaS4E4msRqzttdh6JzaKO",
      "https://xzdx.top/api/tophub?type=xhs",
      "https://v2.xxapi.cn/api/xhshot",
      "https://tenapi.cn/v2/xhshot",
    ],
    enable: getConfig("hot_xhs_enable", "bool", false),
    split: getConfig("hot_xhs_split", "bool", true),
    ignore: getConfig("hot_xhs_ignore", "bool", true),
    count: getConfig("hot_xhs_count", "int", 3),
  },

  kuaishou: {
    name: "快手热榜",
    home: "kwai://home/hot",
    urls: [
      "https://v2.xxapi.cn/api/kuaishouhot",
      "https://tenapi.cn/v2/kuaishouhot",
      "https://api.guole.fun/kuaishou",
      "https://api.suyanw.cn/api/kuaishou_hot_search.php",
      "https://api.vvhan.com/api/hotlist?type=ks",
    ],
    enable: getConfig("hot_kuaishou_enable", "bool", false),
    split: getConfig("hot_kuaishou_split", "bool", true),
    ignore: getConfig("hot_kuaishou_ignore", "bool", true),
    count: getConfig("hot_kuaishou_count", "int", 3),
  },
};

const BILI_NAME = PLATFORMS.bilibili.name;

// ========== 工具函数 ==========
const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  Referer: "https://www.baidu.com",
};

// 根据 host 动态补充/修正 Referer（提升官方接口成功率，且不影响第三方接口）
function buildHeaders(url) {
  const headers = { ...COMMON_HEADERS };
  try {
    const host = new URL(url).hostname;
    if (host.endsWith("bilibili.com")) {
      headers.Referer = "https://www.bilibili.com";
      headers.Origin = "https://www.bilibili.com";
    } else if (host.endsWith("zhihu.com")) {
      headers.Referer = "https://www.zhihu.com";
    }
  } catch (_) {}
  return headers;
}

function notify(title, body, url) {
  try {
    if (url && ATTACH_LINK) {
      $notification.post(title || "", "", body || "", url);
    } else {
      $notification.post(title || "", "", body || "");
    }
  } catch (e) {
    console.log(`❌ [通知失败] ${title}: ${e}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 把英文错误信息翻译成简单中文
function getErrorSummary(msg) {
  if (!msg) return "未知原因";
  const m = String(msg).toLowerCase();

  if (m.includes("timeout_guard")) return "请求超时";
  if (m.includes("empty dns") || m.includes("dns")) return "DNS 解析失败";
  if (m.includes("network is unreachable") || m.includes("unreachable")) return "网络不可达";
  if (m.includes("timeout")) return "请求超时";

  const httpMatch = m.match(/http\s+(\d{3})/i);
  if (httpMatch) {
    const code = httpMatch[1];
    if (code.startsWith("5")) return `服务器错误（HTTP ${code}）`;
    if (code.startsWith("4")) return `请求异常（HTTP ${code}）`;
    return `HTTP 错误（HTTP ${code}）`;
  }
  return "接口异常";
}

// 10 秒超时 + 最多重试 N 次 + 保险丝超时保护
async function httpGet(url) {
  const maxRetries = ENABLE_RETRY ? MAX_RETRIES : 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0 && DETAIL_LOG) {
        console.log(`🔄 [重试] ${url} 第 ${attempt} 次重试...`);
      }

      return await new Promise((resolve, reject) => {
        let finished = false;

        // 保险丝：Loon 偶尔不按 timeout 回调，这里自己掐掉
        const guard = setTimeout(() => {
          if (finished) return;
          finished = true;
          reject(new Error("TIMEOUT_GUARD"));
        }, GUARD_TIMEOUT);

        $httpClient.get(
          {
            url,
            headers: buildHeaders(url),
            timeout: 10000, // Loon 内部超时
          },
          (err, resp, data) => {
            if (finished) return;
            finished = true;
            clearTimeout(guard);

            if (err) {
              if (attempt < maxRetries) {
                if (DETAIL_LOG) console.log(`⚠️ [HTTP] ${url} 失败(${err.message || err})，准备重试...`);
                reject(new Error(`RETRYABLE: ${err.message || err}`));
              } else {
                if (DETAIL_LOG) console.log(`❌ [HTTP] ${url} 最终失败: ${err.message || err}`);
                reject(err);
              }
              return;
            }

            if (!resp || resp.status !== 200) {
              const e = new Error(`HTTP ${resp ? resp.status : "NO_RESP"}`);
              if (attempt < maxRetries) {
                if (DETAIL_LOG) console.log(`⚠️ [HTTP] ${url} 失败(${e.message})，准备重试...`);
                reject(new Error(`RETRYABLE: ${e.message}`));
              } else {
                if (DETAIL_LOG) console.log(`❌ [HTTP] ${url} 最终失败: ${e.message}`);
                reject(e);
              }
              return;
            }

            try {
              // ✅ 支持数组 JSON（'['）+ 兼容少量接口 Content-Type 不规范
              if (data && typeof data === "object") {
                resolve(data);
                return;
              }
              const ct = (resp.headers["Content-Type"] || resp.headers["content-type"] || "").toLowerCase();
              const s = typeof data === "string" ? data.trim().replace(/^\uFEFF/, "") : "";
              if (ct.includes("application/json") || (s && (s[0] === "{" || s[0] === "["))) {
                resolve(JSON.parse(s));
              } else {
                resolve(data);
              }
            } catch (_) {
              resolve(data);
            }
          }
        );
      });
    } catch (error) {
      const msg = error.message || String(error);
      if (attempt >= maxRetries || !msg.includes("RETRYABLE")) {
        throw error;
      }
      await sleep(80);
    }
  }
}

function inPushTime() {
  if (!PUSH_HOURS_STR) return true;
  const h = new Date().getHours();
  const hours = PUSH_HOURS_STR
    .split(/[,，]/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 0 && n <= 23);

  if (hours.includes(h)) return true;
  console.log(`⏰ 当前 ${h} 点不在推送时间 ${hours.join(",")}，跳过本次`);
  return false;
}

// ========== B站链接生成（关键：单条直达视频，合集直达排行榜） ==========
function toHttps(u) {
  if (!u) return "";
  let s = String(u).trim();
  if (!s) return "";
  if (s.startsWith("//")) s = "https:" + s;
  return s;
}

function buildBiliVideoDeepLink(item) {
  // 优先 aid（最稳），其次 bvid
  const aid = item && item.aid ? String(item.aid).replace(/^av/i, "") : "";
  const bvid = item && item.bvid ? String(item.bvid) : "";

  if (aid && /^\d+$/.test(aid)) return `bilibili://video/${aid}`;
  if (bvid && /^BV/i.test(bvid)) return `bilibili://video/${bvid}`;

  // 再从 url 里尝试解析
  const u = toHttps(item && item.url ? item.url : "");
  if (u) {
    const mBV = u.match(/\/video\/(BV[0-9A-Za-z]+)\b/);
    if (mBV) return `bilibili://video/${mBV[1]}`;
    const mAV = u.match(/\/video\/av(\d+)\b/i);
    if (mAV) return `bilibili://video/${mAV[1]}`;
  }

  // 最后兜底：搜索
  const title = item && item.title ? String(item.title).trim() : "";
  return `bilibili://search?keyword=${encodeURIComponent(title)}`;
}

// ========== 数据标准化 ==========
function normalizeList(platformName, rawData) {
  if (!rawData) return null;
  let items = [];

  // 快手：特殊处理文本格式
  if (platformName === "快手热榜" && typeof rawData === "string") {
    const lines = rawData
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    if (lines.length && lines[0].includes("快手热搜")) {
      lines.shift();
    }

    items = lines.map((line) => {
      const m = line.match(/^\d+[:：.、]\s*(.*)$/);
      const title = m ? m[1] : line;
      return { title, url: "" };
    });
  }

  // 知乎：官方 API 格式
  else if (platformName === "知乎热榜" && rawData.data) {
    const dataArray = rawData.data || [];
    items = dataArray.map((x) => {
      const title = x.target?.title || x.title || x.target?.question?.title || "";
      let url = x.target?.url || x.url || "";
      if (url && url.includes("api.zhihu.com")) {
        url = url.replace("https://api.zhihu.com/questions", "zhihu://questions");
      }
      return { title, url };
    });
  }

  // 36氪：多种接口格式
  else if (platformName === "36氪热榜") {
    let arr = [];
    if (Array.isArray(rawData.data)) {
      arr = rawData.data;
    } else if (Array.isArray(rawData)) {
      arr = rawData;
    } else if (rawData.data && Array.isArray(rawData.data)) {
      arr = rawData.data;
    } else if (rawData.itemList) {
      arr = rawData.itemList;
    }

    items = arr.map((x) => ({
      title: x.title || x.templateMaterial?.widgetTitle || x.name || x.word || "",
      url: x.url || x.link || "https://36kr.com/hot-list-m",
    }));
  }

  // ✅ B站：全站热榜/排行榜（ranking/v2 & popular）
  else if (platformName === BILI_NAME) {
    let arr = [];

    // ranking/v2 或 popular：data.list
    if (rawData.data && Array.isArray(rawData.data.list)) {
      arr = rawData.data.list;
    }
    // 部分第三方：data 直接是数组
    else if (rawData.data && Array.isArray(rawData.data)) {
      arr = rawData.data;
    }
    // 直接是数组
    else if (Array.isArray(rawData)) {
      arr = rawData;
    }
    // 兼容：list 字段
    else if (rawData.list && Array.isArray(rawData.list)) {
      arr = rawData.list;
    }

    items = arr.map((x) => {
      const title = x.title || x.name || x.keyword || x.word || "";
      const bvid = x.bvid || x.bv_id || x.bv || "";
      const aid = x.aid || x.av || x.id || "";

      // 尽量保留原始链接（后续会统一改成 bilibili://video/...）
      let url = x.short_link || x.shortLink || x.url || x.link || x.share_url || "";

      // 如果没给直链但给了 bvid/aid，就拼出 https 备用
      if (!url) {
        if (bvid) url = `https://www.bilibili.com/video/${bvid}`;
        else if (aid) url = `https://www.bilibili.com/video/av${aid}`;
      }

      return { title, url, bvid, aid };
    });
  }

  // 微博
  else if (platformName === "微博热搜") {
    let arr = [];
    if (Array.isArray(rawData.realtime)) {
      arr = rawData.realtime;
    } else if (Array.isArray(rawData.data)) {
      arr = rawData.data;
    } else if (Array.isArray(rawData)) {
      arr = rawData;
    }

    items = arr.map((x) => ({
      title: x.word || x.title || x.name || x.word_scheme || "",
      url: x.url || "",
    }));
  }

  // 通用数组
  else if (Array.isArray(rawData)) {
    items = rawData.map((x) => ({
      title: x.title || x.word || x.name || x.desc || "",
      url: x.url || x.link || x.short_link || "",
    }));
  }

  // 通用对象
  else if (typeof rawData === "object") {
    const dataArray = rawData.data || rawData.result?.data || rawData.list || [];
    items = dataArray.map((x) => ({
      title: x.title || x.word || x.name || x.desc || "",
      url: x.url || x.link || x.short_link || "",
    }));
  }

  // 文本
  else if (typeof rawData === "string") {
    const lower = rawData.trim().toLowerCase();
    if (lower.startsWith("<") || lower.includes("<html")) return null;

    items = rawData
      .split(/[、,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((title) => ({ title, url: "" }));
  }

  // 去掉空标题
  items = items.filter((x) => x.title && x.title.trim().length > 0);
  if (!items.length) return null;

  // 强制覆盖 URL 为 App Scheme（按平台策略）
  items = items.map((item) => {
    const t = (item.title || "").trim();
    const enc = encodeURIComponent(t);
    let url = item.url || "";

    if (platformName === "微博热搜") {
      url = `sinaweibo://searchall?q=${enc}`;
    } else if (platformName === "抖音热榜") {
      url = `snssdk1128://search?keyword=${enc}`;
    } else if (platformName === "头条热榜") {
      url = `snssdk141://search?keyword=${enc}`;
    } else if (platformName === "快手热榜") {
      url = `kwai://search?keyword=${enc}`;
    } else if (platformName === "小红书热榜") {
      url = `xhsdiscover://search/result?keyword=${enc}`;
    } else if (platformName === "百度热搜") {
      url = `baiduboxapp://search?word=${enc}`;
    } else if (platformName === BILI_NAME) {
      // ✅ 关键修复：B站单条通知 = 直达视频（bilibili://video/...），避免 bilibili://browser 白底网页
      url = buildBiliVideoDeepLink(item);
    } else if (platformName === "知乎热榜") {
      if (url && url.includes("zhihu://questions")) {
        // 保留 questions 链接
      } else {
        url = `zhihu://search?q=${enc}`;
      }
    } else if (platformName === "36氪热榜") {
      url = url || "https://36kr.com/hot-list-m";
    }

    // ✅ 保留其他字段（例如 B站的 aid/bvid）
    return { ...item, title: t, url };
  });

  // 关键词过滤
  let filtered = [];
  if (KEYWORDS.length) {
    filtered = items.filter((it) => KEYWORDS.some((k) => it.title.includes(k)));
    if (filtered.length) console.log(`✅ [${platformName}] 命中关键词 ${filtered.length} 条`);
  }

  if (!filtered.length) {
    const key = Object.keys(PLATFORMS).find((k) => PLATFORMS[k].name === platformName);
    const cfg = key ? PLATFORMS[key] : null;

    if (cfg?.ignore || !KEYWORDS.length) {
      filtered = items;
    } else {
      console.log(`⛔ [${platformName}] 无关键词匹配且未开启推新, 跳过`);
      return null;
    }
  }

  return filtered;
}

// ========== 抓取单个平台 ==========
async function fetchPlatform(key) {
  const cfg = PLATFORMS[key];
  if (!cfg || !cfg.enable) return { success: false, host: null, error: "未启用" };

  console.log(`📡 [${cfg.name}] 开始抓取...`);
  let lastError = null;

  for (const url of cfg.urls || []) {
    try {
      if (DETAIL_LOG) console.log(`🔗 尝试接口: ${new URL(url).hostname}`);

      const raw = await httpGet(url);
      const items = normalizeList(cfg.name, raw);

      if (items && items.length) {
        const finalItems = items.slice(0, cfg.count);

        if (cfg.split) {
          // ✅ 关键修复：倒序发送，保证 Top1 在通知顶端
          for (let i = finalItems.length - 1; i >= 0; i--) {
            const item = finalItems[i];
            // Top 的序号必须是原始排名 i+1
            notify(`${cfg.name} Top${i + 1}`, item.title, item.url);
          }
        } else {
          const body = finalItems.map((item, idx) => `${idx + 1}. ${item.title}`).join("\n");
          notify(`${cfg.name} Top${finalItems.length}`, body, cfg.home);
        }

        console.log(`✅ [${cfg.name}] 推送成功 ${finalItems.length} 条 (来自: ${new URL(url).hostname})`);
        return { success: true, host: new URL(url).hostname, error: "" };
      } else {
        if (DETAIL_LOG) console.log(`⚠️ [${cfg.name}] 接口无有效数据: ${new URL(url).hostname}`);
      }
    } catch (e) {
      lastError = e;
      const errorMsg = e.message || String(e);
      if (DETAIL_LOG) console.log(`⚠️ [${cfg.name}] 接口失败: ${new URL(url).hostname} -> ${errorMsg}`);
    }
  }

  if (lastError) {
    console.log(`❌ [${cfg.name}] 所有接口均失败，最后一次错误: ${lastError.message || lastError}`);
    return { success: false, host: null, error: lastError.message || String(lastError) };
  } else {
    console.log(`❌ [${cfg.name}] 所有接口均失败，未获取到有效数据`);
    return { success: false, host: null, error: "未获取到有效数据" };
  }
}

// ========== 主流程 ==========
(async () => {
  console.log("🚀 ========== 多平台热榜监控启动 ==========");
  console.log(`📅 当前时间: ${new Date().toLocaleString()}`);

  if (!inPushTime()) {
    console.log("⏰ 不在推送时间，脚本结束");
    $done();
    return;
  }

  const enabled = Object.keys(PLATFORMS).filter((k) => PLATFORMS[k].enable);
  console.log(`📊 已启用平台: ${enabled.map((k) => PLATFORMS[k].name).join(", ")}`);

  const healthStatus = {};

  const results = await Promise.allSettled(
    enabled.map(async (key) => {
      const result = await fetchPlatform(key);
      healthStatus[key] = {
        platform: PLATFORMS[key].name,
        success: !!result.success,
        host: result.host || null,
        error: result.error || "",
        timestamp: Date.now(),
      };
      return result;
    })
  );

  const successCount = results.filter((r) => r.status === "fulfilled" && r.value?.success).length;
  const failCount = enabled.length - successCount;

  console.log("\n📊 ========== 执行结果统计 ==========");
  console.log(`✅ 成功: ${successCount} 个平台`);
  console.log(`❌ 失败: ${failCount} 个平台`);

  console.log("\n🏥 接口健康状态(原始):");
  Object.keys(healthStatus).forEach((key) => {
    const status = healthStatus[key];
    const icon = status.success ? "✅" : "❌";
    const host = status.host ? ` (${hostShort(status.host)})` : "";
    console.log(`  ${icon} ${status.platform}${host}`);
  });

  // 中文总结版，方便快速看懂原因
  console.log("\n📋 ========== 中文执行总结 ==========");
  enabled.forEach((key) => {
    const st = healthStatus[key];
    if (!st) return;
    if (st.success) {
      const host = st.host ? `，来源：${hostShort(st.host)}` : "";
      console.log(`✅ ${st.platform}：成功${host}`);
    } else {
      const reason = getErrorSummary(st.error);
      console.log(`❌ ${st.platform}：${reason}`);
    }
  });

  console.log("\n✅ ========== 多平台热榜监控完成 ==========");
  $done();
})();

function hostShort(host) {
  if (!host) return "";
  try {
    return String(host).replace(/^www\./, "");
  } catch (_) {
    return host;
  }
}
