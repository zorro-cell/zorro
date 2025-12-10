// 多平台热榜监控 - Loon 版

// ========== 参数解析 ==========
const $config = {};

// 兼容：Loon 对象参数 & "a=1&b=2" 字符串参数
if (typeof $argument !== 'undefined') {
  if (typeof $argument === 'object') {
    Object.keys($argument).forEach((key) => {
      const val = $argument[key];
      if (val !== undefined && val !== null && val !== '') {
        $config[key] = val;
      }
    });
  } else if (typeof $argument === 'string') {
    $argument
      .split('&')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((kv) => {
        const [k, v = ''] = kv.split('=');
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
  if (v === undefined || v === null || v === '') return defVal;
  if (type === 'bool') return String(v).toLowerCase() === 'true';
  if (type === 'int') return parseInt(v, 10) || defVal;
  return String(v);
}

// ========== 全局配置 ==========
const KEYWORDS_STR   = getConfig('hot_keywords', 'string', '');
const KEYWORDS       = KEYWORDS_STR.split(/[,，\s]+/).map((k) => k.trim()).filter(Boolean);
const PUSH_HOURS_STR = getConfig('hot_push_hours', 'string', '');
const ATTACH_LINK    = getConfig('hot_attach_link', 'bool', true);

console.log(`🎯 [配置] 关键词: ${KEYWORDS.length ? KEYWORDS.join(', ') : '全部'}`);
console.log(`⏰ [配置] 推送时间: ${PUSH_HOURS_STR || '全天'}`);
console.log(`🔗 [配置] 附带链接: ${ATTACH_LINK ? '是' : '否'}`);

// ========== 平台配置 ==========
const PLATFORMS = {
  weibo: {
    name: '微博热搜',
    home: 'sinaweibo://pageinfo?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot',
    urls: [
      'https://xzdx.top/api/tophub?type=weibo',
      'https://v2.xxapi.cn/api/weibohot',
      'https://api.vvhan.com/api/hotlist?type=weibo',
      'https://tenapi.cn/v2/weibohot',
      'https://api-hot.imsyy.top/weibo',
    ],
    enable: getConfig('hot_weibo_enable', 'bool', true),
    split:  getConfig('hot_weibo_split',  'bool', true),
    ignore: getConfig('hot_weibo_ignore', 'bool', true),
    count:  getConfig('hot_weibo_count',  'int',  3),
  },
  baidu: {
    name: '百度热搜',
    home: 'baiduboxapp://v1/easybrowse/open?url=https%3A%2F%2Ftop.baidu.com%2Fboard%3Ftab%3Drealtime',
    urls: [
      'https://xzdx.top/api/tophub?type=baidu',
      'https://v2.xxapi.cn/api/baiduhot',
      'https://api.vvhan.com/api/hotlist?type=baiduRD',
      'https://tenapi.cn/v2/baiduhot',
      'https://api-hot.imsyy.top/baidu',
    ],
    enable: getConfig('hot_baidu_enable', 'bool', true),
    split:  getConfig('hot_baidu_split',  'bool', true),
    ignore: getConfig('hot_baidu_ignore', 'bool', true),
    count:  getConfig('hot_baidu_count',  'int',  3),
  },
  douyin: {
    name: '抖音热榜',
    home: 'snssdk1128://search/trending',
    urls: [
      'https://xzdx.top/api/tophub?type=douyin',
      'https://v2.xxapi.cn/api/douyinhot',
      'https://api.vvhan.com/api/hotlist?type=douyin',
      'https://tenapi.cn/v2/douyinhot',
      'https://api-hot.imsyy.top/douyin',
    ],
    enable: getConfig('hot_douyin_enable', 'bool', true),
    split:  getConfig('hot_douyin_split',  'bool', true),
    ignore: getConfig('hot_douyin_ignore', 'bool', true),
    count:  getConfig('hot_douyin_count',  'int',  3),
  },
  zhihu: {
    name: '知乎热榜',
    home: 'zhihu://topstory/hot-list',
    // 对齐旧脚本，增加 guole + 官方接口兜底 :contentReference[oaicite:1]{index=1}
    urls: [
      'https://xzdx.top/api/tophub?type=zhihu',
      'https://v2.xxapi.cn/api/zhihuhot',
      'https://api.vvhan.com/api/hotlist?type=zhihu',
      'https://tenapi.cn/v2/zhihuhot',
      'https://api-hot.imsyy.top/zhihu',
      'https://api.guole.fun/zhihu',
      'https://api.zhihu.com/topstory/hot-lists/total?limit=50',
    ],
    enable: getConfig('hot_zhihu_enable', 'bool', true),
    split:  getConfig('hot_zhihu_split',  'bool', true),
    ignore: getConfig('hot_zhihu_ignore', 'bool', true),
    count:  getConfig('hot_zhihu_count',  'int',  3),
  },
  bilibili: {
    name: 'B站热门',
    home: 'bilibili://browser?url=https%3A%2F%2Fwww.bilibili.com%2Fblackboard%2Factivity-trending-topic.html',
    urls: [
      'https://xzdx.top/api/tophub?type=bilihot',
      'https://v.api.aa1.cn/api/bilibili-rs/',
      'https://v2.xxapi.cn/api/bilibilihot',
      'https://api.vvhan.com/api/hotlist?type=bilibili',
      'https://tenapi.cn/v2/bilihot',
      'https://api-hot.imsyy.top/bilibili',
    ],
    enable: getConfig('hot_bilibili_enable', 'bool', true),
    split:  getConfig('hot_bilibili_split',  'bool', true),
    ignore: getConfig('hot_bilibili_ignore', 'bool', true),
    count:  getConfig('hot_bilibili_count',  'int',  3),
  },
  kr36: {
    name: '36氪热榜',
    home: 'https://36kr.com/newsflashes',
    urls: [
      'https://xzdx.top/api/tophub?type=36kr',
      'https://v2.xxapi.cn/api/hot36kr',
      'https://api.vvhan.com/api/hotlist?type=36kr',
      'https://tenapi.cn/v2/36krhot',
      'https://api-hot.imsyy.top/36kr',
    ],
    enable: getConfig('hot_36kr_enable', 'bool', true),
    split:  getConfig('hot_36kr_split',  'bool', true),
    ignore: getConfig('hot_36kr_ignore', 'bool', true),
    count:  getConfig('hot_36kr_count',  'int',  3),
  },
  toutiao: {
    name: '头条热榜',
    home: 'snssdk141://',
    // 对齐旧脚本，增加 guole + lolimi :contentReference[oaicite:2]{index=2}
    urls: [
      'https://xzdx.top/api/tophub?type=toutiao',
      'https://v2.xxapi.cn/api/toutiaohot',
      'https://api.vvhan.com/api/hotlist?type=toutiao',
      'https://tenapi.cn/v2/toutiaohot',
      'https://api-hot.imsyy.top/toutiao',
      'https://api.guole.fun/toutiao',
      'https://api.lolimi.cn/API/jhrb/?hot=%E4%BB%8A%E6%97%A5%E5%A4%B4%E6%9D%A1',
    ],
    enable: getConfig('hot_toutiao_enable', 'bool', true),
    split:  getConfig('hot_toutiao_split',  'bool', true),
    ignore: getConfig('hot_toutiao_ignore', 'bool', true),
    count:  getConfig('hot_toutiao_count',  'int',  3),
  },
  xhs: {
    name: '小红书热榜',
    home: 'xhsdiscover://home/explore',
    urls: [
      'https://api.itapi.cn/api/hotnews/xiaohongshu?key=8BheThaS4E4msRqzttdh6JzaKO',
      'https://xzdx.top/api/tophub?type=xhs',
      'https://v2.xxapi.cn/api/xhshot',
      'https://api.vvhan.com/api/hotlist?type=xhs',
      'https://tenapi.cn/v2/xhshot',
      'https://api-hot.imsyy.top/xhs',
    ],
    enable: getConfig('hot_xhs_enable', 'bool', true),
    split:  getConfig('hot_xhs_split',  'bool', true),
    ignore: getConfig('hot_xhs_ignore', 'bool', true),
    count:  getConfig('hot_xhs_count',  'int',  3),
  },
  kuaishou: {
    name: '快手热榜',
    home: 'kwai://home/hot',
    // 对齐旧脚本，增加 lolimi + guole :contentReference[oaicite:3]{index=3}
    urls: [
      'https://api.suyanw.cn/api/kuaishou_hot_search.php',
      'https://v2.xxapi.cn/api/kuaishouhot',
      'https://tenapi.cn/v2/kuaishouhot',
      'https://api.vvhan.com/api/hotlist?type=ks',
      'https://api-hot.imsyy.top/kuaishou',
      'https://api.lolimi.cn/API/jhrb/?hot=%E5%BF%AB%E6%89%8B',
      'https://api.guole.fun/kuaishou',
    ],
    enable: getConfig('hot_kuaishou_enable', 'bool', true),
    split:  getConfig('hot_kuaishou_split',  'bool', true),
    ignore: getConfig('hot_kuaishou_ignore', 'bool', true),
    count:  getConfig('hot_kuaishou_count',  'int',  3),
  },
};

// ========== 工具函数 ==========
const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  Referer: 'https://www.baidu.com',
};

function notify(title, body, url) {
  try {
    if (url && ATTACH_LINK) {
      $notification.post(title || '', '', body || '', url);
    } else {
      $notification.post(title || '', '', body || '');
    }
  } catch (e) {
    console.log(`❌ [通知失败] ${title}: ${e}`);
  }
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get(
      {
        url,
        headers: COMMON_HEADERS,
        timeout: 20000, // 20 秒，Loon 文档里 timeout 单位为 ms
      },
      (err, resp, data) => {
        if (err) return reject(err);
        try {
          if (typeof data === 'string' && data.trim().startsWith('<')) {
            resolve(data);
          } else {
            resolve(JSON.parse(data));
          }
        } catch (_) {
          resolve(data);
        }
      },
    );
  });
}

function inPushTime() {
  if (!PUSH_HOURS_STR) return true;
  const h = new Date().getHours();
  const hours = PUSH_HOURS_STR.split(/[,，]/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 0 && n <= 23);
  if (hours.includes(h)) return true;
  console.log(`⏰ 当前 ${h} 点不在推送时间 ${hours.join(',')}，跳过本次`);
  return false;
}

// ========== 数据标准化 ==========
function normalizeList(platformName, rawData) {
  if (!rawData) return null;
  let items = [];

  // 快手：有一类接口返回整段文本
  if (platformName === '快手热榜' && typeof rawData === 'string') {
    const lines = rawData
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    if (lines.length && lines[0].includes('快手热搜')) {
      lines.shift();
    }

    items = lines.map((line) => {
      const m = line.match(/^\d+[:：.、]\s*(.*)$/);
      const title = m ? m[1] : line;
      return { title, url: '' };
    });
  } else if (Array.isArray(rawData)) {
    items = rawData.map((x) => ({
      title: x.title || x.word || x.name || x.desc || '',
      url:   x.url   || x.link || '',
    }));
  } else if (typeof rawData === 'string') {
    const lower = rawData.trim().toLowerCase();
    if (lower.startsWith('<') || lower.includes('<html')) return null;
    items = rawData
      .split(/[、,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((title) => ({ title, url: '' }));
  } else if (typeof rawData === 'object') {
    const dataArray = rawData.data || rawData.result?.data || [];

    if (platformName === '36氪热榜') {
      const arr = rawData.data?.itemList || [];
      items = arr.map((x) => ({
        title: x.templateMaterial?.widgetTitle || x.title || '',
        url:   'https://36kr.com/hot-list-m',
      }));
    } else if (platformName === 'B站热门') {
      const arr = rawData.data?.list || [];
      items = arr.map((x) => ({
        title: x.title || '',
        url:   x.short_link || '',
      }));
    } else if (platformName === '知乎热榜') {
      items = dataArray.map((x) => {
        const title = x.target?.title || x.title || '';
        let url = x.target?.url || '';
        if (url) {
          url = url.replace('https://api.zhihu.com/questions', 'zhihu://questions');
        }
        return { title, url };
      });
    } else if (platformName === '微博热搜') {
      const arr = rawData.realtime || [];
      items = arr.map((x) => ({
        title: x.word_scheme || x.word || '',
        url:   '',
      }));
    } else if (platformName === '抖音热榜') {
      const arr = rawData.word_list || [];
      items = arr.map((x) => ({
        title: x.word || '',
        url:   '',
      }));
    } else {
      items = dataArray.map((x) => ({
        title: x.title || '',
        url:   x.url   || '',
      }));
    }
  }

  items = items.filter((x) => x.title);
  if (!items.length) return null;

  // URL Scheme 统一补全
  items = items.map((item) => {
    const t = item.title;
    const enc = encodeURIComponent(t);
    let url = item.url || '';

    if (platformName === '微博热搜') {
      url = `sinaweibo://searchall?q=${enc}`;
    } else if (platformName === '抖音热榜') {
      url = `snssdk1128://search?keyword=${enc}`;
    } else if (platformName === '头条热榜') {
      url = `snssdk141://search?keyword=${enc}`;
    } else if (platformName === '快手热榜') {
      url = `kwai://search?keyword=${t}`;
    } else if (platformName === '小红书热榜') {
      url = `xhsdiscover://search/result?keyword=${enc}`;
    } else if (platformName === '百度热搜') {
      url = `baiduboxapp://search?word=${enc}`;
    } else if (platformName === 'B站热门' && !url.includes('bilibili://')) {
      url = `bilibili://search?keyword=${enc}`;
    } else if (platformName === '知乎热榜' && url) {
      url = url.replace('https://api.zhihu.com/questions', 'zhihu://questions');
    }

    return { title: t, url };
  });

  // 关键词过滤
  let filtered = [];
  if (KEYWORDS.length) {
    filtered = items.filter((it) =>
      KEYWORDS.some((k) => it.title.includes(k)),
    );
    if (filtered.length) {
      console.log(`✅ [${platformName}] 命中关键词 ${filtered.length} 条`);
    }
  }

  if (!filtered.length) {
    const key = Object.keys(PLATFORMS).find(
      (k) => PLATFORMS[k].name === platformName,
    );
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
  if (!cfg || !cfg.enable) return;

  console.log(`📡 [${cfg.name}] 开始抓取...`);
  let lastError = null;

  for (const url of cfg.urls || []) {
    try {
      const raw = await httpGet(url);

      let list;
      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw && typeof raw === 'object') {
        if (Array.isArray(raw.data)) {
          list = raw.data;
        } else if (raw.result && Array.isArray(raw.result.data)) {
          list = raw.result.data;
        } else {
          list = raw;
        }
      } else {
        list = raw;
      }

      const items = normalizeList(cfg.name, list);
      if (items && items.length) {
        const finalItems = items.slice(0, cfg.count);

        if (cfg.split) {
          finalItems.forEach((item, idx) => {
            notify(
              `${cfg.name} Top${idx + 1}`,
              item.title,
              item.url,
            );
          });
        } else {
          const body = finalItems
            .map((item, idx) => `${idx + 1}. ${item.title}`)
            .join('\n');
          notify(
            `${cfg.name} Top${finalItems.length}`,
            body,
            cfg.home,
          );
        }

        console.log(`✅ [${cfg.name}] 推送成功 ${finalItems.length} 条`);
        return;
      }
    } catch (e) {
      lastError = e;
      console.log(
        `⚠️ [${cfg.name}] 接口失败: ${url} -> ${
          e && e.message ? e.message : String(e)
        }`,
      );
    }
  }

  if (lastError) {
    console.log(
      `❌ [${cfg.name}] 所有接口均失败，最后一次错误: ${
        lastError && lastError.message ? lastError.message : String(lastError)
      }`,
    );
  } else {
    console.log(`❌ [${cfg.name}] 所有接口均失败，未获取到有效数据`);
  }
}

// ========== 主流程 ==========
(async () => {
  console.log('🚀 ========== 多平台热榜监控启动 ==========');

  if (!inPushTime()) {
    $done();
    return;
  }

  const enabled = Object.keys(PLATFORMS).filter((k) => PLATFORMS[k].enable);
  console.log(
    `📊 已启用平台: ${enabled
      .map((k) => PLATFORMS[k].name)
      .join(', ')}`,
  );

  await Promise.all(enabled.map((k) => fetchPlatform(k)));

  console.log('✅ ========== 多平台热榜监控完成 ==========');
  $done();
})();
