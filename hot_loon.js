/*
 * 多平台热榜 - Loon 参数化版本（新版）
 *
 * 说明：
 *   由于 api.vvhan.com、tenapi.cn 等接口在部分环境下无
 *   法连通，导致请求超时/SSL 握手错误。本版本改用
 *   xxapi.cn 的免费接口作为主要数据源，并保留此前
 *   vvhan/tenapi/imsyy 作为备用。若所有接口均失败，则
 *   不推送该平台热榜。
 *
 * 更新日期：2025‑12‑05
 */
const $config = {};
// 解析 Loon 参数
if (typeof $argument !== 'undefined') {
  try {
    if (typeof $argument === 'string') {
      $argument.split('&').forEach((item) => {
        const parts = item.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          let val = parts.slice(1).join('=').trim();
          val = val.replace(/^['"]|['"]$/g, '');
          try { val = decodeURIComponent(val); } catch (_) {}
          if (!val.startsWith('{')) $config[key] = val;
        }
      });
    } else if (typeof $argument === 'object') {
      Object.keys($argument).forEach((k) => {
        const v = $argument[k];
        if (v !== undefined && v !== null && v !== '') $config[k] = v;
      });
    }
  } catch (e) {
    console.log('⚠️ 参数解析错误: ' + e);
  }
}
function getConf(key, type, defVal) {
  let val = $config[key];
  if (val === undefined || val === null || val === '') return defVal;
  if (type === 'bool') return String(val).toLowerCase() === 'true';
  if (type === 'int') return parseInt(val, 10) || defVal;
  return String(val);
}
// 关键词和推送时间
const KEYWORDS_STR = getConf('hot_keywords', 'string', '');
const KEYWORDS = KEYWORDS_STR.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean);
const PUSH_HOURS_STR = getConf('hot_push_hours', 'string', '');
const ATTACH_LINK = getConf('hot_attach_link', 'bool', true);
console.log(`[配置生效]: 关键词[${KEYWORDS}], 时间[${PUSH_HOURS_STR || '全天'}]`);
// 各平台配置：将 xxapi.cn 放在前面作为主要源
const CFG = {
  weibo: {
    name: '微博热搜',
    urls: [
      'https://v2.xxapi.cn/api/weibohot',
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
      'https://v2.xxapi.cn/api/baiduhot',
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
      'https://v2.xxapi.cn/api/douyinhot',
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
      'https://v2.xxapi.cn/api/zhihuhot',
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
      'https://v2.xxapi.cn/api/bilibilihot',
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
      'https://v2.xxapi.cn/api/hot36kr',
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
      'https://v2.xxapi.cn/api/toutiaohot',
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
      'https://v2.xxapi.cn/api/xhshot',
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
    enable: getConf('hot_kuaishou_enable', 'bool', true),
    split: getConf('hot_kuaishou_split', 'bool', true),
    ignore: getConf('hot_kuaishou_ignore', 'bool', true),
    count: getConf('hot_kuaishou_count', 'int', 3),
  },
};
// User-Agent
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
// HTTP GET with timeout and JSON parse fallback
function httpGet(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url: url, headers: UA, timeout: 8000 }, (err, resp, body) => {
      if (err) return reject(err);
      try {
        // 直接返回字符串用于正则解析
        if (typeof body === 'string' && body.startsWith('<')) return resolve(body);
        const json = JSON.parse(body);
        resolve(json);
      } catch (e) {
        // 若非 JSON 则返回原始文本
        resolve(body);
      }
    });
  });
}
// 判断是否在推送时间
function checkTime() {
  if (!PUSH_HOURS_STR) return true;
  const h = new Date().getHours();
  const allowed = PUSH_HOURS_STR.split(/[,，]/).map((n) => {
    let v = parseInt(n, 10);
    if (v === 24) v = 0;
    return v;
  }).filter((n) => !isNaN(n));
  if (allowed.includes(h)) return true;
  console.log(`⏰ 当前 ${h} 点不在推送时间 ${JSON.stringify(allowed)}，跳过`);
  return false;
}
// 标准化列表数据：兼容 xxapi/vvhan/tenapi/imsyy
function normalizeItems(name, list) {
  if (!list) return null;
  let items = [];
  if (Array.isArray(list)) {
    // xxapi: data array
    items = list.map((x) => {
      let title = x.title || x.word || x.name || x.desc;
      // 对于 36Kr，desc 包含新闻文字
      if (!title && x.templateMaterial) title = x.templateMaterial.widgetTitle;
      let url = x.url || x.link;
      // 当不存在 url 时，根据平台添加搜索链接
      if (!url) {
        if (name === '微博热搜') {
          url = `sinaweibo://searchall?q=${encodeURIComponent(title)}`;
        } else if (name === '抖音热榜') {
          url = `snssdk1128://search?keyword=${encodeURIComponent(title)}`;
        } else if (name === '百度热搜') {
          url = `baiduboxapp://search?word=${encodeURIComponent(title)}`;
        } else if (name === '知乎热榜') {
          url = `zhihu://search?q=${encodeURIComponent(title)}`;
        } else if (name === 'B站热门') {
          url = `bilibili://search?keyword=${encodeURIComponent(title)}`;
        } else if (name === '36氪热榜') {
          url = 'https://36kr.com/newsflashes';
        } else if (name === '头条热榜') {
          url = `snssdk1128://search?keyword=${encodeURIComponent(title)}`;
        } else if (name === '小红书') {
          url = `xhsdiscover://search?query=${encodeURIComponent(title)}`;
        }
      }
      return { title, url };
    });
  } else if (typeof list === 'string') {
    // 比如 bilibili 接口返回字符串用、号分隔
    const parts = list.split(/[、,，]/).map((x) => x.trim()).filter(Boolean);
    items = parts.map((t) => ({
      title: t,
      url: `bilibili://search?keyword=${encodeURIComponent(t)}`,
    }));
  } else {
    // 其他 JSON 格式
    if (name === '36氪热榜') {
      const arr = list.data?.itemList || [];
      items = arr.map((x) => ({
        title: x.templateMaterial?.widgetTitle || x.title,
        url: 'https://36kr.com/newsflashes',
      }));
    } else if (name === 'B站热门') {
      const arr = list.data?.list || [];
      items = arr.map((x) => ({
        title: x.title,
        url: x.short_link?.replace('https://b23.tv', 'bilibili://video') || '',
      }));
    } else if (name === '知乎热榜') {
      const arr = list.data || [];
      items = arr.map((x) => {
        const t = x.target?.title || x.title;
        let u = x.target?.url;
        if (u) u = u.replace('https://api.zhihu.com/questions', 'zhihu://questions');
        return { title: t, url: u || '' };
      });
    } else if (name === '微博热搜') {
      const arr = list.realtime || [];
      items = arr.map((x) => ({
        title: x.word_scheme,
        url: `sinaweibo://searchall?q=${encodeURIComponent(x.word_scheme)}`,
      }));
    } else if (name === '抖音热榜') {
      const arr = list.word_list || [];
      items = arr.map((x) => ({
        title: x.word,
        url: `snssdk1128://search?keyword=${encodeURIComponent(x.word)}`,
      }));
    } else if (name === '百度热搜') {
      // 直接字符串处理
      const matches = [...list.matchAll(/<div class="c-single-text-ellipsis">\s*(.*?)\s*<\/div>/g)];
      items = matches.map((m) => {
        const title = m[1].trim();
        return { title, url: `baiduboxapp://search?word=${encodeURIComponent(title)}` };
      });
    } else {
      // 默认聚合接口格式
      const arr = list.data || [];
      items = arr.map((x) => ({ title: x.title, url: x.url }));
    }
  }
  // 过滤无标题
  items = items.filter((x) => x.title);
  if (items.length === 0) return null;
  // 关键词筛选
  let filtered = [];
  if (KEYWORDS.length > 0) {
    filtered = items.filter((item) => KEYWORDS.some((k) => item.title.includes(k)));
    if (filtered.length > 0) console.log(`✅ ${name}: 命中关键词 ${filtered.length} 条`);
  }
  if (filtered.length === 0) {
    if (CFG[name?.toLowerCase()]?.ignore || KEYWORDS.length === 0) {
      filtered = items;
    } else {
      console.log(`⛔ ${name}: 无关键词匹配且未开启推新，跳过`);
      return null;
    }
  }
  return filtered;
}
// 通用抓取函数
async function fetchCommon(key) {
  const cfg = CFG[key];
  if (!cfg.enable) return;
  const urls = cfg.urls || [];
  for (const url of urls) {
    try {
      console.log(` 开始抓取: ${cfg.name}`);
      const res = await httpGet(url);
      let list;
      if (res) {
        if (Array.isArray(res.data)) {
          list = res.data;
        } else if (Array.isArray(res)) {
          list = res;
        } else if (res.result && Array.isArray(res.result.data)) {
          list = res.result.data;
        } else {
          list = res;
        }
      }
      const items = normalizeItems(cfg.name, list);
      if (items && items.length > 0) {
        const finalItems = items.slice(0, cfg.count);
        if (cfg.split) {
          finalItems.forEach((item, idx) => notify(`${cfg.name} Top${idx + 1}`, item.title, ATTACH_LINK ? item.url : ''));
        } else {
          const body = finalItems.map((i, idx) => `${idx + 1}. ${i.title}`).join('\n');
          notify(`${cfg.name} Top${finalItems.length}`, body, '');
        }
        return;
      }
    } catch (e) {
      console.log(`⚠️ ${cfg.name} 调用接口失败 ${url}: ${e}`);
    }
  }
  console.log(`❌ ${cfg.name} 全部接口失败`);
}
// 快手专用
async function fetchKuaishou() {
  const cfg = CFG.kuaishou;
  if (!cfg.enable) return;
  const urls = [
    'https://v2.xxapi.cn/api/kuaishouhot',
    'https://tenapi.cn/v2/kuaishouhot',
    'https://api.vvhan.com/api/hotlist?type=ks',
    'https://api-hot.imsyy.top/kuaishou',
  ];
  for (const url of urls) {
    try {
      console.log(' 开始抓取: 快手');
      const res = await httpGet(url);
      let list;
      if (res) {
        if (Array.isArray(res.data)) list = res.data;
        else if (Array.isArray(res)) list = res;
        else if (res.result && Array.isArray(res.result.data)) list = res.result.data;
        else list = res;
      }
      const items = normalizeItems('快手热榜', list);
      if (items && items.length > 0) {
        const finalItems = items.slice(0, cfg.count);
        if (cfg.split) {
          finalItems.forEach((item, idx) => notify(`快手热榜 Top${idx + 1}`, item.title, ATTACH_LINK ? item.url : ''));
        } else {
          notify(
            `快手热榜 Top${finalItems.length}`,
            finalItems.map((i, idx) => `${idx + 1}. ${i.title}`).join('\n'),
            '',
          );
        }
        return;
      }
    } catch (_) {}
  }
  console.log('❌ 快手失败');
}
// 主函数
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
