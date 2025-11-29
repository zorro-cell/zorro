/*******************************
 * 多平台热榜 - hot.js（xxapi + 今日热榜 + BoxJs）
 * 支持的榜单：
 *  - 微博热搜（xxapi）
 *  - 知乎热榜（PearAPI / 今日热榜）
 *  - 百度热搜（xxapi）
 *  - B站热门（PearAPI / 今日热榜）
 *  - 抖音热榜（xxapi）
 *  - 36氪热榜（xxapi）
 *  - 今日头条热榜（PearAPI / 今日热榜）
 *  - 快手热榜（cunyuapi）
 *  - 小红书热门话题（需自备接口，默认关闭）
 *
 * BoxJs 配套 keys：
 *  - hot_keywords                     全局关键词（逗号/空格/换行分隔）
 *  - hot_weibo_enable / hot_weibo_ignore / hot_weibo_count
 *  - hot_zhihu_enable / hot_zhihu_ignore / hot_zhihu_count
 *  - hot_baidu_enable / hot_baidu_ignore / hot_baidu_count
 *  - hot_bilibili_enable / hot_bilibili_ignore / hot_bilibili_count
 *  - hot_douyin_enable / hot_douyin_ignore / hot_douyin_count
 *  - hot_36kr_enable / hot_36kr_ignore / hot_36kr_count
 *  - hot_toutiao_enable / hot_toutiao_ignore / hot_toutiao_count
 *  - hot_kuaishou_enable / hot_kuaishou_ignore / hot_kuaishou_count
 *  - hot_xhs_enable / hot_xhs_ignore / hot_xhs_count / hot_xhs_api
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

// 每个榜单的 BoxJs 配置
const CFG = {
  weibo: {
    enable: readBool("hot_weibo_enable", true),
    ignorePushLatest: readBool("hot_weibo_ignore", true),
    count: readInt("hot_weibo_count", 3),
  },
  zhihu: {
    enable: readBool("hot_zhihu_enable", false),
    ignorePushLatest: readBool("hot_zhihu_ignore", false),
    count: readInt("hot_zhihu_count", 3),
  },
  baidu: {
    enable: readBool("hot_baidu_enable", true),
    ignorePushLatest: readBool("hot_baidu_ignore", true),
    count: readInt("hot_baidu_count", 3),
  },
  bilibili: {
    enable: readBool("hot_bilibili_enable", false),
    ignorePushLatest: readBool("hot_bilibili_ignore", false),
    count: readInt("hot_bilibili_count", 3),
  },
  douyin: {
    enable: readBool("hot_douyin_enable", true),
    ignorePushLatest: readBool("hot_douyin_ignore", true),
    count: readInt("hot_douyin_count", 3),
  },
  kr36: {
    enable: readBool("hot_36kr_enable", false),
    ignorePushLatest: readBool("hot_36kr_ignore", false),
    count: readInt("hot_36kr_count", 3),
  },
  // 新增：今日头条
  toutiao: {
    enable: readBool("hot_toutiao_enable", false),
    ignorePushLatest: readBool("hot_toutiao_ignore", false),
    count: readInt("hot_toutiao_count", 3),
  },
  // 新增：快手
  kuaishou: {
    enable: readBool("hot_kuaishou_enable", false),
    ignorePushLatest: readBool("hot_kuaishou_ignore", false),
    count: readInt("hot_kuaishou_count", 3),
  },
  // 新增：小红书（需自备接口）
  xhs: {
    enable: readBool("hot_xhs_enable", false),
    ignorePushLatest: readBool("hot_xhs_ignore", false),
    count: readInt("hot_xhs_count", 3),
  },
};

// 是否输出日志
const DEBUG_LOG = true;
function log(msg) {
  if (DEBUG_LOG) console.log(`[HotSearch] ${msg}`);
}

// 通用 UA
const UA = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
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
// 已经兼容 36 氪的 templateMaterial.widgetTitle
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
    "content",
  ];
  for (const k of keys) {
    if (item[k] && typeof item[k] === "string") return item[k].trim();
  }

  // ✅ 兼容 36 氪：标题在 templateMaterial.widgetTitle
  if (
    item.templateMaterial &&
    typeof item.templateMaterial.widgetTitle === "string"
  ) {
    return item.templateMaterial.widgetTitle.trim();
  }

  // 再不行就把整条 JSON 截一下当标题（防止通知里是一大坨）
  try {
    return JSON.stringify(item).slice(0, 80);
  } catch (e) {
    return "";
  }
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

// 简单封装 GET
function httpGet(url, headers = UA) {
  return $task.fetch({
    url,
    method: "GET",
    headers,
  });
}

// ========== 各平台获取函数 ==========

// 1. 微博热搜（xxapi）
async function fetchWeibo() {
  const name = "微博热搜";
  const cfg = CFG.weibo;
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
      // 有的接口会给热度 hot / hotValue 等，这里尽量兼容
      const hot = item.hot || item.hotValue || item.hot_value;
      const hotStr = hot ? `【热度：${hot}】` : "";
      return `${idx + 1}. ${title}${hotStr}`;
    });

    return {
      ok: true,
      title: `${name} Top${used.length}`,
      text: lines.join("\n"),
      // 这个链接可能因客户端版本有差异，如果不生效最多就是打开微博首页
      openUrl:
        "sinaweibo://pageinfo?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot",
    };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 2. 抖音热榜（xxapi）
async function fetchDouyin() {
  const name = "抖音热榜";
  const cfg = CFG.douyin;
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

    return {
      ok: true,
      title: `${name} Top${used.length}`,
      text: lines.join("\n"),
      // 抖音热搜页
      openUrl: "snssdk1128://search/trending",
    };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 3. 百度热搜（xxapi）
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

    return {
      ok: true,
      title: `${name} Top${used.length}`,
      text: lines.join("\n"),
      openUrl: "https://top.baidu.com/board?tab=realtime",
    };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 4. 36 氪热榜（xxapi）
async function fetch36Kr() {
  const name = "36 氪热榜";
  const cfg = CFG.kr36;
  log(`开始获取  ${name}…`);

  try {
    const resp = await httpGet("https://v2.xxapi.cn/api/hot36kr");
    const json = parseJSON(resp.body, name);

    if (json.code !== 200 || !Array.isArray(json.data)) {
      throw new Error(json.msg || json.message || "接口返回格式异常");
    }

    // 利用上面改过的 pickTitle，从 templateMaterial.widgetTitle 里拿标题
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

    return {
      ok: true,
      title: `${name} Top${used.length}`,
      text: lines.join("\n"),
      // 稳定一点的 36 氪榜单网页
      openUrl: "https://rebang.today/?tab=36kr",
    };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 5. 知乎热榜（今日热榜 / PearAPI）
async function fetchZhihu() {
  const name = "知乎热榜";
  const cfg = CFG.zhihu;
  log(`开始获取  ${name}…`);

  try {
    const url =
      "https://api.pearktrue.cn/api/dailyhot/?title=" +
      encodeURIComponent("知乎");
    const resp = await httpGet(url);
    const json = parseJSON(resp.body, name);

    // dailyhot：code=200, data 为数组或 data.list
    const data = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.data?.list)
      ? json.data.list
      : null;
    if (!Array.isArray(data)) {
      throw new Error(json.msg || json.message || "接口返回格式异常");
    }

    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };

    const lines = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      return `${idx + 1}. ${title}`;
    });

    return {
      ok: true,
      title: `${name} Top${used.length}`,
      text: lines.join("\n"),
      openUrl: "zhihu://zhihu.com/hot",
    };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 6. B 站热门（今日热榜 / PearAPI）
async function fetchBilibili() {
  const name = "B站热门";
  const cfg = CFG.bilibili;
  log(`开始获取  ${name}…`);

  try {
    const url =
      "https://api.pearktrue.cn/api/dailyhot/?title=" +
      encodeURIComponent("哔哩哔哩");
    const resp = await httpGet(url);
    const json = parseJSON(resp.body, name);

    const data = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.data?.list)
      ? json.data.list
      : null;
    if (!Array.isArray(data)) {
      throw new Error(json.msg || json.message || "接口返回格式异常");
    }

    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };

    const lines = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      return `${idx + 1}. ${title}`;
    });

    return {
      ok: true,
      title: `${name} Top${used.length}`,
      text: lines.join("\n"),
      openUrl: "bilibili://popular",
    };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 7. 今日头条热榜（今日热榜 / PearAPI）
async function fetchToutiao() {
  const name = "今日头条热榜";
  const cfg = CFG.toutiao;
  log(`开始获取  ${name}…`);

  try {
    const url =
      "https://api.pearktrue.cn/api/dailyhot/?title=" +
      encodeURIComponent("今日头条");
    const resp = await httpGet(url);
    const json = parseJSON(resp.body, name);

    const data = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.data?.list)
      ? json.data.list
      : null;
    if (!Array.isArray(data)) {
      throw new Error(json.msg || json.message || "接口返回格式异常");
    }

    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };

    const lines = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      return `${idx + 1}. ${title}`;
    });

    return {
      ok: true,
      title: `${name} Top${used.length}`,
      text: lines.join("\n"),
      // 官方热榜网页，点击通知至少能看榜单
      openUrl: "https://www.toutiao.com/hot-event/hot-board/",
    };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 8. 快手热榜（新接口：icofun）
async function fetchKuaishou() {
  const name = "快手热榜";
  const cfg = CFG.kuaishou;
  log(`开始获取  ${name}…`);

  try {
    // 使用 icofun 的快手热搜接口，请求 JSON 格式
    const resp = await httpGet(
      "https://api.icofun.cn/api/kuaishou_hot_search.php?type=json"
    );
    const json = parseJSON(resp.body, name);

    // 尽量兼容各种返回结构
    let data = null;
    if (Array.isArray(json)) {
      data = json;
    } else if (Array.isArray(json.data)) {
      data = json.data;
    } else if (Array.isArray(json.list)) {
      data = json.list;
    } else if (Array.isArray(json.result)) {
      data = json.result;
    } else {
      throw new Error("接口返回格式异常");
    }

    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };

    const lines = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      return `${idx + 1}. ${title}`;
    });

    return {
      ok: true,
      title: `${name} Top${used.length}`,
      text: lines.join("\n"),

      // 🔗 打开快手：如果下面这个 scheme 在你那边打不开
      // 可以自行改成 H5，比如 "https://www.kuaishou.com"
      openUrl: "kwai://home/hot"
    };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}


// 9. 小红书热门话题（需自备接口）
// 默认不会请求任何网络，只要你在 BoxJs 里填写 hot_xhs_api 并且打开开关才会生效
async function fetchXhs() {
  const name = "小红书热门话题";
  const cfg = CFG.xhs;
  log(`开始获取  ${name}…`);

  const apiUrl = (readStore("hot_xhs_api", "") || "").trim();
  if (!apiUrl) {
    log(`${name}：未配置 hot_xhs_api，跳过`);
    return { ok: false, title: name, skip: true };
  }

  try {
    const resp = await httpGet(apiUrl);
    const json = parseJSON(resp.body, name);

    // 尽量兼容各种结构
    let data = null;
    if (Array.isArray(json)) data = json;
    else if (Array.isArray(json.data)) data = json.data;
    else if (Array.isArray(json.data?.list)) data = json.data.list;
    else if (Array.isArray(json.result)) data = json.result;
    else if (Array.isArray(json.items)) data = json.items;

    if (!Array.isArray(data)) {
      throw new Error("接口返回格式异常（请检查你填的 API 返回格式）");
    }

    const used = selectItems(name, data, cfg);
    if (!used) return { ok: false, title: name, skip: true };

    const lines = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      return `${idx + 1}. ${title}`;
    });

    return {
      ok: true,
      title: `${name} Top${used.length}`,
      text: lines.join("\n"),
      // 常见的小红书唤起 scheme，有些系统上能直接拉起 App
      openUrl: "xhsdiscover://",
    };
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
  if (CFG.xhs.enable) tasks.push(fetchXhs());

  if (tasks.length === 0) {
    log("所有榜单都被关闭，脚本直接结束");
    $done();
    return;
  }

  const results = await Promise.all(tasks);

  results.forEach((res) => {
    if (!res) return;
    if (res.ok) {
      $notify(res.title, "", res.text, {
        "open-url": res.openUrl || "",
      });
    } else if (!res.skip) {
      // 真报错（网络 / 接口挂了）才提示
      $notify(`${res.title} 获取失败`, "", String(res.err || "未知错误"));
    }
  });

  $done();
})().catch((e) => {
  log(`脚本运行异常：${e.message || e}`);
  $notify("热榜脚本异常", "", String(e));
  $done();
});
