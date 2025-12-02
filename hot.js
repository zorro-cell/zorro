/*******************************
 * 多平台热榜 - hot.js (修复版 V3)
 * 支持的榜单：
 *  - 微博热搜
 *  - 知乎热榜
 *  - 百度热搜
 *  - B站热门
 *  - 抖音热榜
 *  - 36氪热榜
 *  - 今日头条热榜
 *  - 快手热榜 (双源备份：TenAPI + 韩小韩)
 *  - 小红书热门话题
 *******************************/

// ========== 通用存储读写 ==========

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

const KEYWORD_STRING = readStore("hot_keywords", "");
const KEYWORDS = KEYWORD_STRING.split(/[,，\s\n]/)
  .map((x) => x.trim())
  .filter(Boolean);

const ATTACH_LINK = readBool("hot_attach_link", true);

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
    enable: readBool("
