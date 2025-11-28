/***********************************

Zorro 热榜监控 hot.js

说明：
1. 依赖 BoxJs 配置，前缀统一为 zorro_hot_
2. 支持平台（使用聚合热榜接口）：
   - 微博热搜
   - 知乎热榜
   - 百度热搜
   - 哔哩哔哩热门
   - 抖音热榜
   - 今日头条热榜
   - 36 氪热榜
   - 快手热榜
   - 小红书热门话题（接口不稳定时会自动跳过）

接口来源：聚合热榜（公益接口，偶尔抽风属于正常现象）
  https://api.lolimi.cn/API/jhrb/?hot=平台名

Quantumult X 任务示例：
[task_local]
0 8-23/2 * * * https://raw.githubusercontent.com/zorro-cell/zorro/main/hot.js, tag=Zorro 热榜监控, img-url=https://raw.githubusercontent.com/zorro-cell/zorro/main/icon_hot.png, enabled=true

***********************************/

const $ = new Env("Zorro 热榜监控");

// BoxJs key 前缀
const CONFIG_PREFIX = "zorro_hot_";

// 聚合热榜接口
const JHRB_API = "https://api.lolimi.cn/API/jhrb/?hot=";

// 支持的平台配置
const BOARDS = [
  { id: "weibo",    key: "weibo",    hot: "微博",       name: "微博热搜" },
  { id: "zhihu",    key: "zhihu",    hot: "知乎",       name: "知乎热榜" },
  { id: "baidu",    key: "baidu",    hot: "百度",       name: "百度热搜" },
  { id: "bilibili", key: "bilibili", hot: "哔哩哔哩",   name: "B站热门" },
  { id: "douyin",   key: "douyin",   hot: "抖音",       name: "抖音热榜" },
  { id: "toutiao",  key: "toutiao",  hot: "今日头条",   name: "今日头条热榜" },
  { id: "36kr",     key: "36kr",     hot: "36氪",       name: "36氪热榜" },
  { id: "kuaishou", key: "kuaishou", hot: "快手",       name: "快手热榜" },
  { id: "xhs",      key: "xhs",      hot: "小红书",     name: "小红书热门话题" }
];

// 主逻辑
!(async () => {
  if (!readBool("enable", true)) {
    $.log("🔕 已在 BoxJs 关闭，总开关 enable=false，直接退出");
    return;
  }

  const keywords = parseKeywords(readStr("keywords", ""));
  const pushLimit = readNum("pushLimit", 5);
  const ignoreKeywordPushLatest = readBool("ignoreKeywordPushLatest", true);

  $.log(`关键词: ${keywords.length ? keywords.join(", ") : "（未设置，按平台 TOP 推送）"}`);
  $.log(`每个平台推送条数: ${pushLimit}`);
  $.log(`未命中关键词是否仍推送: ${ignoreKeywordPushLatest}`);

  const tasks = [];

  for (const board of BOARDS) {
    const defaultEnable = defaultBoardEnabled(board.key);
    if (!readBool(board.key, defaultEnable)) {
      $.log(`⏭ 已关闭 ${board.name}`);
      continue;
    }
    tasks.push(handleBoard(board, { keywords, pushLimit, ignoreKeywordPushLatest }));
  }

  if (tasks.length === 0) {
    $.msg("Zorro 热榜监控", "", "未开启任何平台，请到 BoxJs 中打开需要的榜单");
    return;
  }

  await Promise.all(tasks);
})()
  .catch((err) => $.log(`❌ 脚本运行异常：${err}`))
  .finally(() => $.done());

// 默认哪些榜单是“开”的（第一次没有 BoxJs 配置时用这个）
function defaultBoardEnabled(key) {
  switch (key) {
    case "weibo":
    case "zhihu":
      return true; // 默认开 微博 / 知乎
    default:
      return false;
  }
}

// 单个平台处理逻辑
async function handleBoard(board, globalCfg) {
  const { keywords, pushLimit, ignoreKeywordPushLatest } = globalCfg;
  const list = await fetchHot(board);

  if (!list || list.length === 0) {
    $.log(`⚠️ ${board.name} 无返回数据`);
    return;
  }

  const hits = filterByKeywords(list, keywords);

  let toPush = [];
  let subtitle = "";

  if (hits.length > 0) {
    toPush = hits.slice(0, pushLimit);
    subtitle = `命中关键词：${collectHitKeywords(toPush).join(" / ")}`;
  } else if (ignoreKeywordPushLatest || keywords.length === 0) {
    toPush = list.slice(0, pushLimit);
    subtitle = keywords.length ? `未命中关键词，推送 TOP${pushLimit}` : `推送 TOP${pushLimit}`;
  } else {
    $.log(`ℹ️ ${board.name} 未命中关键词，且设置为不推送`);
    return;
  }

  const body = toPush
    .map((item, idx) => {
      const hotStr = item.hot ? `（热度：${item.hot}）` : "";
      const kwStr =
        item.hitKeywords && item.hitKeywords.length
          ? `【命中：${item.hitKeywords.join(" / ")}】`
          : "";
      return `${idx + 1}. ${item.title}${hotStr}${kwStr}`;
    })
    .join("\n");

  const openUrl = buildOpenUrl(board, toPush[0]);

  $.msg(`Zorro 热榜 | ${board.name}`, subtitle, body, {
    "open-url": openUrl,
    "media-url": ""
  });
}

// 调接口拿榜单数据
function fetchHot(board) {
  const url = `${JHRB_API}${encodeURIComponent(board.hot)}`;
  const req = {
    url,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
    }
  };

  return new Promise((resolve) => {
    $.get(req, (err, resp, data) => {
      if (err) {
        $.log(`❌ ${board.name} 请求失败: ${err}`);
        return resolve([]);
      }
      if (!data) {
        $.log(`❌ ${board.name} 返回空数据`);
        return resolve([]);
      }
      try {
        const json = JSON.parse(data);
        if (json.code !== 200) {
          $.log(
            `❌ ${board.name} 接口 code=${json.code}, message=${json.message || json.msg || ""}`
          );
          return resolve([]);
        }
        const arr = Array.isArray(json.data) ? json.data : [];
        const list = arr
          .map((it, idx) => {
            const title = it.title || it.name || "";
            if (!title) return null;
            const hot =
              it.hot ||
              it.hotValue ||
              it.hot_num ||
              (it.data && (it.data.view || it.data.hot)) ||
              "";
            const mobileUrl = it.mobileUrl || it.mobile_url || "";
            const url2 = mobileUrl || it.url || "";
            return {
              title,
              hot,
              url: url2,
              mobileUrl,
              rawUrl: it.url || "",
              index: idx + 1
            };
          })
          .filter(Boolean);

        return resolve(list);
      } catch (e) {
        $.log(`❌ ${board.name} 解析失败: ${e}`);
        return resolve([]);
      }
    });
  });
}

// 根据标题做关键词过滤
function filterByKeywords(list, keywords) {
  if (!keywords || keywords.length === 0) return [];
  return list.reduce((acc, item) => {
    const titleLower = (item.title || "").toLowerCase();
    const hits = keywords.filter((k) => titleLower.includes(k.toLowerCase()));
    if (hits.length) {
      acc.push(Object.assign({}, item, { hitKeywords: hits }));
    }
    return acc;
  }, []);
}

// 收集这次命中的所有关键词，用来展示在副标题
function collectHitKeywords(list) {
  const set = new Set();
  list.forEach((item) => {
    (item.hitKeywords || []).forEach((k) => set.add(k));
  });
  return Array.from(set);
}

// 关键词字符串 → 数组（支持 换行/中英文逗号/顿号）
function parseKeywords(str) {
  if (!str) return [];
  return str
    .split(/[\n,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 不同平台的“打开方式”
function buildOpenUrl(board, item) {
  if (!item) return "";
  const title = item.title || "";
  const fallback = item.url || item.mobileUrl || item.rawUrl || "";

  switch (board.id) {
    case "weibo":
      // 直接在微博里搜索这条热搜标题
      return `sinaweibo://searchall?q=${encodeURIComponent(title)}`;
    case "douyin":
      // 抖音关键词搜索
      return `snssdk1128://search?keyword=${encodeURIComponent(title)}`;
    case "kuaishou":
      // 快手关键词搜索（部分版本支持，如果不支持会自动回退到浏览器）
      return `kwai://search?keyword=${encodeURIComponent(title)}`;
    case "xhs":
      // 小红书搜索话题
      return `xhsdiscover://search/result?keyword=${encodeURIComponent(title)}`;
    case "bilibili":
      // B 站：优先走链接，系统会自动尝试用 App 打开
      return fallback || `bilibili://browser?url=${encodeURIComponent(item.rawUrl || "")}`;
    default:
      // 其它的直接用接口返回的链接（很多 App 支持通用链接唤起）
      return fallback;
  }
}

/**************** 工具函数：读配置 ****************/

function readStr(name, def = "") {
  const v = $.getdata(CONFIG_PREFIX + name);
  if (v === undefined || v === null || v === "") return def;
  return v;
}

function readNum(name, def = 0) {
  const v = $.getdata(CONFIG_PREFIX + name);
  if (v === undefined || v === null || v === "") return def;
  const n = Number(v);
  return isNaN(n) ? def : n;
}

function readBool(name, def = false) {
  const v = $.getdata(CONFIG_PREFIX + name);
  if (v === undefined || v === null || v === "") return def;
  if (typeof v === "boolean") return v;
  return v === "true" || v === "1" || v === 1;
}

/**************** Env 封装（支持 QX / Surge / Loon / Node） ****************/

function Env(name) {
  this.name = name;
  this.logs = [];
  this.startTime = new Date().getTime();

  this.isSurge = () =>
    typeof $httpClient !== "undefined" && typeof $loon === "undefined";
  this.isLoon = () => typeof $loon !== "undefined";
  this.isQuanX = () => typeof $task !== "undefined";
  this.isNode = () =>
    typeof module !== "undefined" && !!module.exports;

  this.log = (...args) => {
    this.logs.push(...args);
    console.log(...args.join(" "));
  };

  this.msg = (title = this.name, subtitle = "", body = "", options) => {
    if (this.isSurge() || this.isLoon()) {
      $notification.post(title, subtitle, body, options);
    } else if (this.isQuanX()) {
      let opts = {};
      if (typeof options === "string") {
        opts = { "open-url": options };
      } else if (options) {
        opts = options;
      }
      $notify(title, subtitle, body, opts);
    } else {
      console.log(`\n🔔${this.name}\n${title}\n${subtitle}\n${body}`);
    }
  };

  this.getdata = (key) => {
    if (this.isSurge() || this.isLoon()) return $persistentStore.read(key);
    if (this.isQuanX()) return $prefs.valueForKey(key);
    if (this.isNode()) {
      this.data = this.data || this.loaddata() || {};
      return this.data[key];
    }
    return null;
  };

  this.setdata = (val, key) => {
    if (this.isSurge() || this.isLoon()) return $persistentStore.write(val, key);
    if (this.isQuanX()) return $prefs.setValueForKey(val, key);
    if (this.isNode()) {
      this.data = this.data || this.loaddata() || {};
      this.data[key] = val;
      this.writedata();
      return true;
    }
    return false;
  };

  this.loaddata = () => {
    if (!this.isNode()) return {};
    const fs = require("fs");
    const path = require("path");
    const file = path.resolve("box.dat");
    if (!fs.existsSync(file)) return {};
    try {
      return JSON.parse(fs.readFileSync(file));
    } catch {
      return {};
    }
  };

  this.writedata = () => {
    if (!this.isNode()) return;
    const fs = require("fs");
    const path = require("path");
    const file = path.resolve("box.dat");
    fs.writeFileSync(file, JSON.stringify(this.data));
  };

  this.get = (opts, cb) => {
    if (this.isSurge() || this.isLoon()) {
      $httpClient.get(opts, (err, resp, body) => {
        if (!err) {
          resp.body = body;
        }
        cb(err, resp, body);
      });
    } else if (this.isQuanX()) {
      if (typeof opts === "string") opts = { url: opts };
      opts.method = "GET";
      $task.fetch(opts).then(
        (resp) => {
          cb(
            null,
            {
              status: resp.statusCode,
              headers: resp.headers,
              body: resp.body
            },
            resp.body
          );
        },
        (err) => cb(err)
      );
    } else if (this.isNode()) {
      const axios = require("axios");
      axios
        .get(opts.url, { headers: opts.headers })
        .then((res) =>
          cb(
            null,
            { status: res.status, headers: res.headers, body: res.data },
            res.data
          )
        )
        .catch((err) => cb(err));
    }
  };

  this.done = (val = {}) => {
    const end = new Date().getTime();
    const cost = ((end - this.startTime) / 1000).toFixed(2);
    this.log(`🔚 ${this.name} 结束，耗时 ${cost}s`);
    if (this.isSurge() || this.isLoon() || this.isQuanX()) $done(val);
  };
}
