/*
 * 多平台热榜 - Loon 参数化版本 V6.1
 *
 * 此脚本用于在 Loon 中抓取微博、百度、抖音、知乎、B站、36氪、今日头条、小红书、快手等平台的热榜。
 * 支持通过插件面板设置关键词过滤、推送时间以及各平台开关。
 *
 * 更新日期：2025-12-04
 */

const $config = {};

// ========== 1. 参数解析 ==========
// Loon 3.2.1+ 会将 argument 列表注入到 $argument 对象中；旧版则可能是字符串。
if (typeof $argument !== 'undefined') {
  try {
    if (typeof $argument === 'string') {
      // 兼容旧格式：一个带 & 的字符串。
      console.log('🟢 [原始参数]: ' + $argument);
      $argument.split('&').forEach((item) => {
        const parts = item.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          let val = parts.slice(1).join('=').trim();
          // 去除可能的引号包裹
          val = val.replace(/^['"]|['"]$/g, '');
          try { val = decodeURIComponent(val); } catch (_) {}
          if (!val.startsWith('{')) {
            $config[key] = val;
          }
        }
      });
    } else if (typeof $argument === 'object') {
      // 新版参数直接是对象，字段名与插件中一致
      console.log('🟢 [参数对象]: ' + JSON.stringify($argument));
      Object.keys($argument).forEach((k) => {
        const v = $argument[k];
        // Loon 的 argument 有可能返回 undefined/null，这里过滤掉
        if (v !== undefined && v !== null && v !== '') {
          $config[k] = v;
        }
      });
    }
  } catch (e) {
    console.log('⚠️ 参数解析错误: ' + e);
  }
}

// 帮助函数：根据类型读取配置，若不存在则返回默认值
function getConf(key, type, defVal) {
  let val = $config[key];
  if (val === undefined || val === null || val === '') return defVal;
  if (type === 'bool') return String(val).toLowerCase() === 'true';
  if (type === 'int') return parseInt(val, 10) || defVal;
  return String(val);
}

// ========== 2. 初始化配置 ==========
// 关键词字符串与数组
const KEYWORDS_STR = getConf('hot_keywords', 'string', '');
const KEYWORDS = KEYWORDS_STR.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean);
// 推送时间字符串（0-23，用逗号分隔）
const PUSH_HOURS_STR = getConf('hot_push_hours', 'string', '');
// 是否在通知中带上跳转链接
const ATTACH_LINK = getConf('hot_attach_link', 'bool', true);

console.log(`🔵 [配置生效]: 关键词[${KEYWORDS}], 时间[${PUSH_HOURS_STR || '全天'}]`);

// ========== 3. 各平台接口配置 ==========
const CFG = {
  weibo: {
    name: '微博热搜',
    // 使用聚合接口，兼容 Loon 抓取环境
    url: 'https://v2.xxapi.cn/api/weibohot',
    enable: getConf('hot_weibo_enable', 'bool', true),
    split: getConf('hot_weibo_split', 'bool', true),
    ignore: getConf('hot_weibo_ignore', 'bool', true),
    count: getConf('hot_weibo_count', 'int', 3),
  },
  baidu: {
    name: '百度热搜',
    // 使用聚合接口
    url: 'https://v2.xxapi.cn/api/baiduhot',
    enable: getConf('hot_baidu_enable', 'bool', true),
    split: getConf('hot_baidu_split', 'bool', true),
    ignore: getConf('hot_baidu_ignore', 'bool', true),
    count: getConf('hot_baidu_count', 'int', 3),
  },
  douyin: {
    name: '抖音热榜',
    // 使用聚合接口
    url: 'https://v2.xxapi.cn/api/douyinhot',
    enable: getConf('hot_douyin_enable', 'bool', true),
    split: getConf('hot_douyin_split', 'bool', true),
    ignore: getConf('hot_douyin_ignore', 'bool', true),
    count: getConf('hot_douyin_count', 'int', 3),
  },
  zhihu: {
    name: '知乎热榜',
    url: 'https://api.zhihu.com/topstory/hot-list?limit=50&desktop=true',
    enable: getConf('hot_zhihu_enable', 'bool', true),
    split: getConf('hot_zhihu_split', 'bool', true),
    ignore: getConf('hot_zhihu_ignore', 'bool', true),
    count: getConf('hot_zhihu_count', 'int', 3),
  },
  bilibili: {
    name: 'B站热门',
    // 使用聚合接口
    url: 'https://api.pearktrue.cn/api/dailyhot/?title=%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9',
    enable: getConf('hot_bilibili_enable', 'bool', true),
    split: getConf('hot_bilibili_split', 'bool', true),
    ignore: getConf('hot_bilibili_ignore', 'bool', true),
    count: getConf('hot_bilibili_count', 'int', 3),
  },
  kr36: {
    name: '36氪热榜',
    // 使用聚合接口
    url: 'https://v2.xxapi.cn/api/hot36kr',
    enable: getConf('hot_36kr_enable', 'bool', true),
    split: getConf('hot_36kr_split', 'bool', true),
    ignore: getConf('hot_36kr_ignore', 'bool', true),
    count: getConf('hot_36kr_count', 'int', 3),
  },
  toutiao: {
    name: '头条热榜',
    // 使用聚合接口
    url: 'https://api.pearktrue.cn/api/dailyhot/?title=%E4%BB%8A%E6%97%A5%E5%A4%B4%E6%9D%A1',
    enable: getConf('hot_toutiao_enable', 'bool', true),
    split: getConf('hot_toutiao_split', 'bool', true),
    ignore: getConf('hot_toutiao_ignore', 'bool', true),
    count: getConf('hot_toutiao_count', 'int', 3),
  },
  xhs: {
    name: '小红书',
    // 使用聚合接口
    url: 'https://api.pearktrue.cn/api/dailyhot/?title=%E5%B0%8F%E7%BA%A2%E4%B9%A6',
    enable: getConf('hot_xhs_enable', 'bool', true),
    split: getConf('hot_xhs_split', 'bool', true),
    ignore: getConf('hot_xhs_ignore', 'bool', true),
    count: getConf('hot_xhs_count', 'int', 3),
  },
  kuaishou: {
    name: '快手热榜',
    // 快手需要多个接口尝试，会在抓取函数中定义 url 列表
    enable: getConf('hot_kuaishou_enable', 'bool', true),
    split: getConf('hot_kuaishou_split', 'bool', true),
    ignore: getConf('hot_kuaishou_ignore', 'bool', true),
    count: getConf('hot_kuaishou_count', 'int', 3),
  },
};

// ========== 标题与链接提取函数 ==========
// 参考 QX hot.js 中的实现，用于从不同接口返回的对象里提取标题和链接
function pickTitle(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item !== 'object') {
    try { return String(item); } catch (_) { return ''; }
  }
  const keys = ['title', 'word', 'name', 'hot_word', 'keyword', 'note', 'desc', 'summary', 'content'];
  for (const k of keys) {
    if (item[k] && typeof item[k] === 'string') return item[k].trim();
  }
  if (item.templateMaterial && typeof item.templateMaterial.widgetTitle === 'string') {
    return item.templateMaterial.widgetTitle.trim();
  }
  try { return JSON.stringify(item).slice(0, 80); } catch (_) { return ''; }
}

function pickUrl(item, fallback) {
  const urls = [];
  function collect(obj) {
    if (!obj || typeof obj !== 'object') return;
    const keys = ['scheme', 'url', 'link', 'href', 'mobileUrl', 'mobile_url', 'appUrl', 'app_url', 'target_url', 'targetUrl', 'jump_url', 'jumpUrl'];
    for (const k of keys) {
      if (typeof obj[k] === 'string') urls.push(obj[k]);
    }
  }
  if (typeof item === 'string') {
    urls.push(item);
  } else if (item && typeof item === 'object') {
    collect(item);
    ['target', 'card', 'object', 'templateMaterial', 'mblog'].forEach((k) => {
      if (item[k] && typeof item[k] === 'object') collect(item[k]);
    });
  }
  for (const raw of urls) {
    const v = String(raw).trim();
    if (!v) continue;
    if (/^https?:\/\//i.test(v)) return v;
    if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(v)) return v;
  }
  return fallback || '';
}

function buildAppUrl(boardName, item, defaultUrl) {
  const title = pickTitle(item);
  const kwRaw = (item && (item.hot_word || item.word || item.keyword || item.name || item.title || item.note)) || title || '';
  const kw = String(kwRaw).trim();
  const encodedKw = kw ? encodeURIComponent(kw) : '';
  const rawUrl = pickUrl(item, '');
  switch (boardName) {
    case '微博热搜':
      return encodedKw ? `sinaweibo://searchall?q=${encodedKw}` : (rawUrl || defaultUrl);
    case '抖音热榜':
      return encodedKw ? `snssdk1128://search?keyword=${encodedKw}` : (rawUrl || defaultUrl);
    case '百度热搜': {
      let target = rawUrl;
      if (!target && encodedKw) target = `https://www.baidu.com/s?wd=${encodedKw}`;
      if (target) return 'baiduboxapp://v1/easybrowse/open?url=' + encodeURIComponent(target);
      return encodedKw ? `baiduboxapp://search?word=${encodedKw}` : defaultUrl;
    }
    case '知乎热榜':
      if (rawUrl && /^https?:\/\/www\.zhihu\.com/i.test(rawUrl)) {
        const m = rawUrl.match(/question\/(\d+)/);
        if (m && m[1]) return `zhihu://questions/${m[1]}`;
      }
      return encodedKw ? `zhihu://search?type=content&q=${encodedKw}` : defaultUrl;
    case 'B站热门':
      if (rawUrl && /^https?:\/\//i.test(rawUrl)) return 'bilibili://browser?url=' + encodeURIComponent(rawUrl);
      return encodedKw ? `bilibili://search?keyword=${encodedKw}` : defaultUrl;
    case '头条热榜':
      if (rawUrl && /^https?:\/\/www\.toutiao\.com/i.test(rawUrl)) return rawUrl;
      return encodedKw ? `snssdk141://search?keyword=${encodedKw}` : defaultUrl;
    case '快手热榜':
      return encodedKw ? `kwai://search?keyword=${encodedKw}` : (rawUrl || defaultUrl);
    case '小红书':
      if (rawUrl && /^https?:\/\/www\.xiaohongshu\.com/i.test(rawUrl)) return rawUrl;
      return defaultUrl;
    case '36氪热榜':
      return rawUrl || defaultUrl;
    default:
      return rawUrl || defaultUrl;
  }
}

// ========== 4. HTTP 工具与通知 ==========
const UA = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  Referer: 'https://www.baidu.com',
};

function notify(title, body, url) {
  if (typeof $notification !== 'undefined') {
    $notification.post(title, '', body, url || '');
  } else {
    console.log(`[推送] ${title}: ${body}`);
  }
}

// HTTP 请求工具：直接返回响应体，不在此解析 JSON。
// 有些接口返回的内容可能是 HTML（如百度），由调用者自行处理或解析。
function httpGet(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url: url, headers: UA, timeout: 8000 }, (err, resp, body) => {
      if (err) return reject(err);
      // 如果 body 为 undefined/null，则返回空字符串
      resolve(body || '');
    });
  });
}

// 判断是否在允许的推送小时
function checkTime() {
  if (!PUSH_HOURS_STR) return true;
  const h = new Date().getHours();
  const allowed = PUSH_HOURS_STR.split(/[,，]/).map((n) => {
    let val = parseInt(n, 10);
    if (val === 24) val = 0;
    return val;
  }).filter((n) => !isNaN(n));
  if (allowed.includes(h)) return true;
  console.log(`⏰ 当前 ${h} 点不在推送时间 ${JSON.stringify(allowed)}，跳过`);
  return false;
}

// 标准化各接口返回的数据
function processList(name, list, cfg) {
  if (!list) return null;
  let items = [];

  // 统一处理聚合接口：如果存在 list.code 且 list.data 为数组，则直接映射
  if (typeof list === 'object' && Array.isArray(list.data)) {
    items = list.data.map((item) => ({ title: pickTitle(item), url: pickUrl(item, '') }));
  }
  // 如果 list 本身就是数组（某些聚合接口直接返回数组），直接映射
  else if (Array.isArray(list)) {
    items = list.map((item) => ({ title: pickTitle(item), url: pickUrl(item, '') }));
  }
  // 特定平台原生格式（早期接口）
  else {
    // 微博格式
    if (name === '微博热搜') {
      items = (list.realtime || []).map((x) => ({ title: x.word_scheme, url: `sinaweibo://searchall?q=${encodeURIComponent(x.word_scheme)}` }));
    } else if (name === '抖音热榜') {
      items = (list.word_list || []).map((x) => ({ title: x.word, url: `snssdk1128://search?keyword=${encodeURIComponent(x.word)}` }));
    } else if (name === '百度热搜') {
      // 百度接口有时返回 HTML
      if (typeof list === 'string') {
        const matches = [...list.matchAll(/<div class="c-single-text-ellipsis">\s*(.*?)\s*<\/div>/g)];
        items = matches.map((m) => ({ title: m[1].trim(), url: `baiduboxapp://search?word=${encodeURIComponent(m[1].trim())}` }));
      } else {
        items = (list.data || []).map((x) => ({ title: x.title, url: x.url }));
      }
    } else if (name === '知乎热榜') {
      items = (list.data || []).map((x) => {
        // 针对知乎原生接口结构
        if (x && x.target && x.target.title) {
          const t = x.target.title;
          const u = x.target.url ? x.target.url.replace('https://api.zhihu.com/questions', 'zhihu://questions') : '';
          return { title: t, url: u };
        }
        return { title: pickTitle(x), url: pickUrl(x, '') };
      });
    } else if (name === 'B站热门') {
      // 老接口格式为 list.data.list
      items = (list.data && Array.isArray(list.data.list) ? list.data.list : []).map((x) => ({ title: x.title, url: x.short_link?.replace('https://b23.tv', 'bilibili://video') || '' }));
    } else if (name === '36氪热榜') {
      // 老接口格式为 list.data.itemList
      items = (list.data && Array.isArray(list.data.itemList) ? list.data.itemList : []).map((x) => ({ title: x.templateMaterial?.widgetTitle, url: 'https://36kr.com/newsflashes' }));
    } else if (name === '头条热榜') {
      // 今日头条原生接口格式（暂不使用）
      items = (list.data || []).map((x) => ({ title: x.title || pickTitle(x), url: x.url || pickUrl(x, '') }));
    } else if (name === '快手热榜') {
      // 快手原生接口已经在 fetchKuaishou 中处理
      items = (Array.isArray(list) ? list : list.data || []).map((x) => ({ title: x.title || pickTitle(x), url: x.url || pickUrl(x, '') }));
    } else {
      // 通用接口格式（如 VVhan）
      items = (list.data || []).map((x) => ({ title: x.title, url: x.url }));
    }
  }
  // 过滤无效标题
  items = items.filter((x) => x && x.title);
  if (items.length === 0) return null;
  // 按关键词过滤
  let filtered = [];
  if (KEYWORDS.length > 0) {
    filtered = items.filter((item) => KEYWORDS.some((k) => (item.title || '').includes(k)));
    if (filtered.length > 0) console.log(`✅ ${name}: 命中关键词 ${filtered.length} 条`);
  }
  // 如果关键词未命中，检查是否允许推新
  if (filtered.length === 0) {
    if (cfg.ignore || KEYWORDS.length === 0) {
      filtered = items;
    } else {
      console.log(`⛔ ${name}: 无关键词匹配且未开启推新，跳过`);
      return null;
    }
  }
  return filtered.slice(0, cfg.count);
}

// ========== 5. 抓取与推送 ==========
async function fetchCommon(key) {
  const cfg = CFG[key];
  if (!cfg.enable) return;
  try {
    console.log(`🚀 开始抓取: ${cfg.name}`);
    // 获取原始响应体
    const raw = await httpGet(cfg.url);
    let data;
    try {
      // 若返回的是字符串，尝试解析为 JSON；解析失败则保留原字符串
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed && trimmed[0] !== '<') {
          data = JSON.parse(trimmed);
        } else {
          // HTML 或空串直接赋值
          data = raw;
        }
      } else {
        data = raw;
      }
    } catch (e) {
      // 解析失败时，将报错信息作为字符串传递
      console.log(`❌ ${cfg.name} 返回内容无法解析为 JSON: ${e}`);
      data = raw;
    }
    const finalItems = processList(cfg.name, data, cfg);
    if (finalItems && finalItems.length > 0) {
      if (cfg.split) {
        finalItems.forEach((item, idx) => notify(`${cfg.name} Top${idx + 1}`, item.title, ATTACH_LINK ? item.url : ''));
      } else {
        const body = finalItems.map((i, idx) => `${idx + 1}. ${i.title}`).join('\n');
        notify(`${cfg.name} Top${finalItems.length}`, body, '');
      }
    }
  } catch (e) {
    console.log(`❌ ${cfg.name} 错误: ${e}`);
  }
}

// 快手需要多接口容错
async function fetchKuaishou() {
  const cfg = CFG.kuaishou;
  if (!cfg.enable) return;
  const urls = ['https://tenapi.cn/v2/kuaishouhot', 'https://api.vvhan.com/api/hotlist?type=ks'];
  for (const url of urls) {
    try {
      console.log('🚀 开始抓取: 快手');
      const json = await httpGet(url);
      const list = json.data || (json.result ? json.result.data : []);
      const finalItems = processList('快手热榜', list, cfg);
      if (finalItems) {
        if (cfg.split) finalItems.forEach((item, idx) => notify(`快手热榜 Top${idx + 1}`, item.title, ATTACH_LINK ? item.url : ''));
        else notify(`快手热榜 Top${finalItems.length}`, finalItems.map((i, idx) => `${idx + 1}. ${i.title}`).join('\n'), '');
        return;
      }
    } catch (_) {
      // 忽略单个接口错误，尝试下一个
    }
  }
  console.log('❌ 快手失败');
}

// 主函数：按配置抓取并推送
!(async () => {
  if (!checkTime()) { $done(); return; }
  await Promise.all([
    fetchCommon('weibo'),
    fetchCommon('baidu'),
    fetchCommon('douyin'),
    fetchCommon('zhihu'),
    fetchCommon('bilibili'),
    fetchCommon('kr36'),
    fetchCommon('toutiao'),
    fetchCommon('xhs'),
    fetchKuaishou(),
  ]);
  $done();
})();
