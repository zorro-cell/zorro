/*
 * 多平台热榜 - Loon 参数化版本（修复版）
 *
 * 说明：
 *   原始脚本直接调用各大平台的官方接口（例如新浪微博、知乎、抖音等），在部分运行环境下会因为
 *   TLS 握手失败、证书问题或网络限制导致请求超时或 JSON 解析失败。为提高稳定性，本版本
 *   使用第三方聚合热榜服务作为数据源，支持多个接口容错。优先调用 vvhan 提供的接口，失败
 *   时自动切换至 TenAPI 和 DailyHot 等备份接口。
 *
 * 更新日期：2025‑12‑04
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
          try {
            val = decodeURIComponent(val);
          } catch (_) {}
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
const KEYWORDS = KEYWORDS_STR.split(/[,，\s]+/)
  .map((x) => x.trim())
  .filter(Boolean);
// 推送时间字符串（0‑23，用逗号分隔）
const PUSH_HOURS_STR = getConf('hot_push_hours', 'string', '');
// 是否在通知中带上跳转链接
const ATTACH_LINK = getConf('hot_attach_link', 'bool', true);

console.log(`🔵 [配置生效]: 关键词[${KEYWORDS}], 时间[${PUSH_HOURS_STR || '全天'}]`);

// ========== 3. 各平台接口配置 ==========
//
// 每个平台包含：
//   name  ‑ 显示名称
//   urls  ‑ 数据源列表（按优先级顺序）。支持 vvhan、TenAPI、DailyHot 等聚合接口。
//   enable/split/ignore/count ‑ 来自插件参数的开关设置。
//
const CFG = {
  weibo: {
    name: '微博热搜',
    urls: [
      'https://api.vvhan.com/api/hotlist?type=weibo',
      'https://tenapi.cn/v2/weibohot',
      'https://api-hot.imsyy.top/weibo',
    ],
    enable: getConf('hot_weibo_enable', 'bool', true),
    split: getConf('hot_weibo_split', 'bool', true),
    ignore: getConf('hot_weibo_ignore', 'bool', true),
    count: getConf('hot_weibo_count', 'int', 3),
  },
  baidu: {
    name: '百度热搜',
    urls: [
      'https://api.vvhan.com/api/hotlist?type=baiduRD',
      'https://tenapi.cn/v2/baiduhot',
      'https://api-hot.imsyy.top/baidu',
    ],
    enable: getConf('hot_baidu_enable', 'bool', true),
    split: getConf('hot_baidu_split', 'bool', true),
    ignore: getConf('hot_baidu_ignore', 'bool', true),
    count: getConf('hot_baidu_count', 'int', 3),
  },
  douyin: {
    name: '抖音热榜',
    urls: [
      'https://api.vvhan.com/api/hotlist?type=douyin',
      'https://tenapi.cn/v2/douyinhot',
      'https://api-hot.imsyy.top/douyin',
    ],
    enable: getConf('hot_douyin_enable', 'bool', true),
    split: getConf('hot_douyin_split', 'bool', true),
    ignore: getConf('hot_douyin_ignore', 'bool', true),
    count: getConf('hot_douyin_count', 'int', 3),
  },
  zhihu: {
    name: '知乎热榜',
    urls: [
      'https://api.vvhan.com/api/hotlist?type=zhihu',
      'https://tenapi.cn/v2/zhihuhot',
      'https://api-hot.imsyy.top/zhihu',
    ],
    enable: getConf('hot_zhihu_enable', 'bool', true),
    split: getConf('hot_zhihu_split', 'bool', true),
    ignore: getConf('hot_zhihu_ignore', 'bool', true),
    count: getConf('hot_zhihu_count', 'int', 3),
  },
  bilibili: {
    name: 'B站热门',
    urls: [
      'https://api.vvhan.com/api/hotlist?type=bilibili',
      'https://tenapi.cn/v2/bilihot',
      'https://api-hot.imsyy.top/bilibili',
    ],
    enable: getConf('hot_bilibili_enable', 'bool', true),
    split: getConf('hot_bilibili_split', 'bool', true),
    ignore: getConf('hot_bilibili_ignore', 'bool', true),
    count: getConf('hot_bilibili_count', 'int', 3),
  },
  kr36: {
    name: '36氪热榜',
    urls: [
      'https://api.vvhan.com/api/hotlist?type=36kr',
      'https://tenapi.cn/v2/36krhot',
      'https://api-hot.imsyy.top/36kr',
    ],
    enable: getConf('hot_36kr_enable', 'bool', true),
    split: getConf('hot_36kr_split', 'bool', true),
    ignore: getConf('hot_36kr_ignore', 'bool', true),
    count: getConf('hot_36kr_count', 'int', 3),
  },
  toutiao: {
    name: '头条热榜',
    urls: [
      'https://api.vvhan.com/api/hotlist?type=toutiao',
      'https://tenapi.cn/v2/toutiaohot',
      'https://api-hot.imsyy.top/toutiao',
    ],
    enable: getConf('hot_toutiao_enable', 'bool', true),
    split: getConf('hot_toutiao_split', 'bool', true),
    ignore: getConf('hot_toutiao_ignore', 'bool', true),
    count: getConf('hot_toutiao_count', 'int', 3),
  },
  xhs: {
    name: '小红书',
    urls: [
      'https://api.vvhan.com/api/hotlist?type=xhs',
      'https://tenapi.cn/v2/xhshot',
      'https://api-hot.imsyy.top/xhs',
    ],
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

// ========== 4. HTTP 工具与通知 ==========
const UA = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  Referer: 'https://www.baidu.com',
};

function notify(title, body, url) {
  if (typeof $notification !== 'undefined') {
    $notification.post(title, '', body, url || '');
  } else {
    console.log(`[推送] ${title}: ${body}`);
  }
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url: url, headers: UA, timeout: 8000 }, (err, resp, body) => {
      if (err) return reject(err);
      try {
        // 有些接口直接返回 HTML（如百度等），原样返回供后续正则解析
        if (typeof body === 'string' && body.startsWith('<')) {
          return resolve(body);
        }
        resolve(JSON.parse(body));
      } catch (e) {
        reject('JSON解析失败');
      }
    });
  });
}

// 判断是否在允许的推送小时
function checkTime() {
  if (!PUSH_HOURS_STR) return true;
  const h = new Date().getHours();
  const allowed = PUSH_HOURS_STR.split(/[,，]/)
    .map((n) => {
      let val = parseInt(n, 10);
      if (val === 24) val = 0;
      return val;
    })
    .filter((n) => !isNaN(n));
  if (allowed.includes(h)) return true;
  console.log(`⏰ 当前 ${h} 点不在推送时间 ${JSON.stringify(allowed)}，跳过`);
  return false;
}

// 标准化各接口返回的数据
function processList(name, list, cfg) {
  if (!list) return null;
  let items = [];
  // 如果 list 是数组（聚合接口返回的数据数组）
  if (Array.isArray(list)) {
    items = list.map((x) => ({ title: x.title, url: x.url }));
  } else if (name === '微博热搜') {
    items = (list.realtime || []).map((x) => ({
      title: x.word_scheme,
      url: `sinaweibo://searchall?q=${encodeURIComponent(x.word_scheme)}`,
    }));
  } else if (name === '抖音热榜') {
    items = (list.word_list || []).map((x) => ({
      title: x.word,
      url: `snssdk1128://search?keyword=${encodeURIComponent(x.word)}`,
    }));
  } else if (name === '百度热搜') {
    if (typeof list === 'string') {
      const matches = [...list.matchAll(/<div class="c-single-text-ellipsis">\s*(.*?)\s*<\/div>/g)];
      items = matches.map((m) => ({
        title: m[1].trim(),
        url: `baiduboxapp://search?word=${encodeURIComponent(m[1].trim())}`,
      }));
    }
  } else if (name === '知乎热榜') {
    items = (list.data || []).map((x) => {
      const t = x.target.title;
      const u = x.target.url.replace('https://api.zhihu.com/questions', 'zhihu://questions');
      return { title: t, url: u };
    });
  } else if (name === 'B站热门') {
    items = (list.data?.list || []).map((x) => ({
      title: x.title,
      url: x.short_link?.replace('https://b23.tv', 'bilibili://video') || '',
    }));
  } else if (name === '36氪热榜') {
    items = (list.data?.itemList || []).map((x) => ({
      title: x.templateMaterial?.widgetTitle,
      url: 'https://36kr.com/newsflashes',
    }));
  } else {
    // 通用接口格式（如 VVhan、TenAPI、DailyHot）
    items = (list.data || []).map((x) => ({ title: x.title, url: x.url }));
  }
  // 过滤无效标题
  items = items.filter((x) => x.title);
  if (items.length === 0) return null;
  // 按关键词过滤
  let filtered = [];
  if (KEYWORDS.length > 0) {
    filtered = items.filter((item) => KEYWORDS.some((k) => item.title.includes(k)));
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
  const urls = cfg.urls || (cfg.url ? [cfg.url] : []);
  for (const url of urls) {
    try {
      console.log(`🚀 开始抓取: ${cfg.name}`);
      const json = await httpGet(url);
      // 聚合接口返回格式可能有 data 或 result.data
      let list;
      if (json) {
        if (Array.isArray(json.data)) {
          list = json.data;
        } else if (Array.isArray(json)) {
          list = json;
        } else if (json.result && Array.isArray(json.result.data)) {
          list = json.result.data;
        } else {
          list = json;
        }
      }
      const finalItems = processList(cfg.name, list, cfg);
      if (finalItems && finalItems.length > 0) {
        if (cfg.split) {
          finalItems.forEach((item, idx) =>
            notify(`${cfg.name} Top${idx + 1}`, item.title, ATTACH_LINK ? item.url : ''),
          );
        } else {
          const body = finalItems.map((i, idx) => `${idx + 1}. ${i.title}`).join('\n');
          notify(`${cfg.name} Top${finalItems.length}`, body, '');
        }
        return; // 成功则退出，不再尝试后续接口
      }
    } catch (e) {
      console.log(`⚠️ ${cfg.name} 调用接口失败 ${url}: ${e}`);
    }
  }
  console.log(`❌ ${cfg.name} 全部接口失败`);
}

// 快手需要多接口容错
async function fetchKuaishou() {
  const cfg = CFG.kuaishou;
  if (!cfg.enable) return;
  const urls = [
    'https://tenapi.cn/v2/kuaishouhot',
    'https://api.vvhan.com/api/hotlist?type=ks',
    'https://api-hot.imsyy.top/kuaishou',
  ];
  for (const url of urls) {
    try {
      console.log('🚀 开始抓取: 快手');
      const json = await httpGet(url);
      let list;
      if (json) {
        if (Array.isArray(json.data)) {
          list = json.data;
        } else if (Array.isArray(json)) {
          list = json;
        } else if (json.result && Array.isArray(json.result.data)) {
          list = json.result.data;
        } else {
          list = json;
        }
      }
      const finalItems = processList('快手热榜', list, cfg);
      if (finalItems) {
        if (cfg.split)
          finalItems.forEach((item, idx) =>
            notify(`快手热榜 Top${idx + 1}`, item.title, ATTACH_LINK ? item.url : ''),
          );
        else
          notify(
            `快手热榜 Top${finalItems.length}`,
            finalItems.map((i, idx) => `${idx + 1}. ${i.title}`).join('\n'),
            '',
          );
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
  if (!checkTime()) {
    $done();
    return;
  }
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
