/*******************************
 多平台热榜 - hot.js 新接口 + BoxJs 版
*******************************/

// ========== BoxJs 配置读取 ==========

// 读取字符串
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

// 读取布尔
function readBool(key, defVal = false) {
  const v = readStore(key, defVal ? "true" : "false");
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  return s === "true" || s === "1" || s === "on";
}

// 读取整数
function readInt(key, defVal = 3) {
  const v = parseInt(readStore(key, String(defVal)), 10);
  return isNaN(v) ? defVal : v;
}

// 全局关键词（所有榜单共用）
const KEYWORD_STRING = readStore("hot_keywords", "");
const KEYWORDS = KEYWORD_STRING.split(/[,，\s\n]/).map(x => x.trim()).filter(Boolean);

// 每个榜单配置（默认值尽量贴近你截图里的习惯）
const CFG = {
  weibo: {
    enable: readBool("hot_weibo_enable", true),           // 微博热搜：默认开
    ignorePushLatest: readBool("hot_weibo_ignore", true), // 默认：没命中也推最新
    count: readInt("hot_weibo_count", 3)
  },
  zhihu: {
    enable: readBool("hot_zhihu_enable", false),
    ignorePushLatest: readBool("hot_zhihu_ignore", false),
    count: readInt("hot_zhihu_count", 3)
  },
  baidu: {
    enable: readBool("hot_baidu_enable", true),
    ignorePushLatest: readBool("hot_baidu_ignore", true),
    count: readInt("hot_baidu_count", 3)
  },
  bilibili: {
    enable: readBool("hot_bilibili_enable", false),
    ignorePushLatest: readBool("hot_bilibili_ignore", false),
    count: readInt("hot_bilibili_count", 3)
  },
  douyin: {
    enable: readBool("hot_douyin_enable", true),
    ignorePushLatest: readBool("hot_douyin_ignore", true),
    count: readInt("hot_douyin_count", 3)
  },
  kr36: {
    enable: readBool("hot_36kr_enable", false),
    ignorePushLatest: readBool("hot_36kr_ignore", false),
    count: readInt("hot_36kr_count", 3)
  }
};

// ========== 通用配置 ==========

const DEBUG_LOG = true;

function log(msg) {
  if (DEBUG_LOG) console.log(`[HotSearch] ${msg}`);
}

const UA = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
};

// 从一条记录里尽量抽标题
function pickTitle(item) {
  if (!item) return "";
  if (typeof item === "string") return item.trim();

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
  if (typeof item.id === "string" && item.id.length <= 40) return item.id;
  try {
    return JSON.stringify(item).slice(0, 50);
  } catch (e) {
    return "";
  }
}

// 安全 JSON 解析（防止返回 HTML）
function parseJSON(body, label) {
  if (!body) throw new Error(`${label} 返回为空`);
  if (typeof body !== "string") return body;

  const trimmed = body.trim();
  if (!trimmed) throw new Error(`${label} 返回空字符串`);

  if (trimmed[0] === "<") {
    throw new Error(`${label} 返回的是 HTML（疑似 403/404/安全验证页面）`);
  }
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    throw new Error(`${label} JSON 解析失败：${e.message || e}`);
  }
}

// 根据关键词 & 配置，决定推哪些条目
function selectItems(boardName, rawList, cfg) {
  if (!Array.isArray(rawList) || rawList.length === 0) return null;

  const count = Math.max(1, cfg.count || 3);
  const list = rawList.slice(); // copy

  // 没设置关键词
  if (KEYWORDS.length === 0) {
    if (!cfg.ignorePushLatest) {
      log(`${boardName}：未设置关键词且未开启“忽略关键词推送最新内容”，跳过`);
      return null;
    }
    log(`${boardName}：未设置关键词，直接推最新 ${count} 条`);
    return list.slice(0, count);
  }

  // 有关键词：先过滤命中的
  const matched = list.filter(item => {
    const title = pickTitle(item);
    return title && KEYWORDS.some(k => title.includes(k));
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

  log(`${boardName}：未命中关键词且未开启“忽略关键词推送最新内容”，跳过`);
  return null;
}

// ========== 各榜单获取函数 ==========

// 1. 微博热搜（xxapi）
async function fetchWeibo() {
  const name = "微博热搜";
  const cfg = CFG.weibo;
  log(`开始获取 ${name}…`);

  try {
    const resp = await $task.fetch({
      url: "https://v2.xxapi.cn/api/weibohot",
      headers: UA
    });
    const json = parseJSON(resp.body, name);

    if (json.code !== 200 || !Array.isArray(json.data)) {
      throw new Error(`接口返回异常：${json.msg || json.message || "未知错误"}`);
    }

    const used = selectItems(name, json.data, cfg);
    if (!used) return { ok: false, title: name, skip: true };

    const lines = used.map((item, idx) => {
      const title = pickTitle(item) || "无标题";
      const hot = item.hot || item.hotValue || item.hot_value;
      const hotStr = hot ? `（${hot}）` : "";
      return `${idx + 1}. ${title}${hotStr}`;
    });

    return {
      ok: true,
      title: `${name} Top${used.length}`,
      text: lines.join("\n"),
      openUrl:
        "sinaweibo://pageinfo?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot"
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
  log(`开始获取 ${name}…`);

  try {
    const resp = await $task.fetch({
      url: "https://v2.xxapi.cn/api/douyinhot",
      headers: UA
    });
    const json = parseJSON(resp.body, name);

    if (json.code !== 200 || !Array.isArray(json.data)) {
      throw new Error(`接口返回异常：${json.msg || json.message || "未知错误"}`);
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
      openUrl: "snssdk1128://search/trending"
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
  log(`开始获取 ${name}…`);

  try {
    const resp = await $task.fetch({
      url: "https://v2.xxapi.cn/api/baiduhot",
      headers: UA
    });
    const json = parseJSON(resp.body, name);

    if (json.code !== 200 || !Array.isArray(json.data)) {
      throw new Error(`接口返回异常：${json.msg || json.message || "未知错误"}`);
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
      openUrl: "https://top.baidu.com/board?tab=realtime"
    };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 4. 36 氪热榜（xxapi）
async function fetch36Kr() {
  const name = "36氪热榜";
  const cfg = CFG.kr36;
  log(`开始获取 ${name}…`);

  try {
    const resp = await $task.fetch({
      url: "https://v2.xxapi.cn/api/hot36kr",
      headers: UA
    });
    const json = parseJSON(resp.body, name);

    if (json.code !== 200 || !Array.isArray(json.data)) {
      throw new Error(`接口返回异常：${json.msg || json.message || "未知错误"}`);
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
      openUrl: "https://36kr.com/hot-list/catalog"
    };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 5. 知乎热榜（今日热榜：title=知乎）
async function fetchZhihu() {
  const name = "知乎热榜";
  const cfg = CFG.zhihu;
  log(`开始获取 ${name}…`);

  try {
    const url =
      "https://api.pearktrue.cn/api/dailyhot/?title=" +
      encodeURIComponent("知乎");
    const resp = await $task.fetch({ url, headers: UA });
    const json = parseJSON(resp.body, name);

    if (json.code !== 200 || !Array.isArray(json.data)) {
      throw new Error(`接口返回异常：${json.msg || json.message || "未知错误"}`);
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
      openUrl: "zhihu://zhihu.com/hot"
    };
  } catch (e) {
    log(`${name} 获取失败：${e.message || e}`);
    return { ok: false, title: name, err: e.message || String(e) };
  }
}

// 6. B 站热门（今日热榜：title=哔哩哔哩）
async function fetchBilibili() {
  const name = "B站热门";
  const cfg = CFG.bilibili;
  log(`开始获取 ${name}…`);

  try {
    const url =
      "https://api.pearktrue.cn/api/dailyhot/?title=" +
      encodeURIComponent("哔哩哔哩");
    const resp = await $task.fetch({ url, headers: UA });
    const json = parseJSON(resp.body, name);

    if (json.code !== 200 || !Array.isArray(json.data)) {
      throw new Error(`接口返回异常：${json.msg || json.message || "未知错误"}`);
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
      openUrl: "bilibili://popular"
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

  if (tasks.length === 0) {
    log("所有榜单都被关闭，脚本退出");
    $done();
    return;
  }

  const results = await Promise.all(tasks);

  results.forEach(res => {
    if (!res) return;
    if (res.ok) {
      $notify(res.title, "", res.text, { "open-url": res.openUrl || "" });
    } else if (!res.skip) {
      // 真报错再推通知，没匹配到关键词那种直接略过
      $notify(`${res.title} 获取失败`, "", String(res.err || "未知错误"));
    }
  });

  $done();
})().catch(e => {
  log(`脚本运行异常：${e.message || e}`);
  $notify("热榜脚本异常", "", String(e));
  $done();
});
