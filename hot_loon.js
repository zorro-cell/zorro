/*
 * 多平台热榜 - Loon 参数化版本（新版）
 *
 * 修改版：为了提高可靠性，新增了额外的备用接口，确保快手、知乎、今日头条等热榜在原接口失效时仍可抓取。
 * 新增的接口包括:
 *   - 知乎：api.guole.fun 和知乎官方接口
 *   - 今日头条：api.guole.fun 和 lolimi 的聚合接口
 *   - 快手：lolimi 和 guole 的聚合接口
 * 其它逻辑保持不变。
 * 更新日期：2025‑12‑06
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
    // 默认跳转地址：微博热搜榜首页
    home: 'sinaweibo://pageinfo?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot',
    urls: [
      'https://xzdx.top/api/tophub?type=weibo',
      'https://v2.xxapi.cn/api/weibohot',
      'https://api.vvhan.com/api/hotlist?type=weibo',
      'https://tenapi.cn/v2/weibohot',
      'https://api-hot.imsyy.top/weibo'
    ],
    enable: getConf('hot_weibo_enable', 'bool', true),
    split: getConf('hot_weibo_split', 'bool', true),
    ignore: getConf('hot_weibo_ignore', 'bool', true),
    count: getConf('hot_weibo_count', 'int', 3),
  },
  baidu: {
    name: '百度热搜',
    // 默认跳转地址：百度热榜首页
    // baiduboxapp 跳转地址需要编码后的链接；此处直接填入编码后的 URL
    home: 'baiduboxapp://v1/easybrowse/open?url=https%3A%2F%2Ftop.baidu.com%2Fboard%3Ftab%3Drealtime',
    urls: [
      'https://xzdx.top/api/tophub?type=baidu',
      'https://v2.xxapi.cn/api/baiduhot',
      'https://api.vvhan.com/api/hotlist?type=baiduRD',
      'https://tenapi.cn/v2/baiduhot',
      'https://api-hot.imsyy.top/baidu'
    ],
    enable: getConf('hot_baidu_enable', 'bool', true),
    split: getConf('hot_baidu_split', 'bool', true),
    ignore: getConf('hot_baidu_ignore', 'bool', true),
    count: getConf('hot_baidu_count', 'int', 3),
  },
  douyin: {
    name: '抖音热榜',
    // 默认跳转地址：抖音热榜页
    home: 'snssdk1128://search/trending',
    urls: [
      'https://xzdx.top/api/tophub?type=douyin',
      'https://v2.xxapi.cn/api/douyinhot',
      'https://api.vvhan.com/api/hotlist?type=douyin',
      'https://tenapi.cn/v2/douyinhot',
      'https://api-hot.imsyy.top/douyin'
    ],
    enable: getConf('hot_douyin_enable', 'bool', true),
    split: getConf('hot_douyin_split', 'bool', true),
    ignore: getConf('hot_douyin_ignore', 'bool', true),
    count: getConf('hot_douyin_count', 'int', 3),
  },
  zhihu: {
    name: '知乎热榜',
    // 默认跳转地址：知乎热榜页
    home: 'zhihu://topstory/hot-list',
    urls: [
      // 新增 api.guole.fun 和知乎官方接口，提高稳定性
      'https://xzdx.top/api/tophub?type=zhihu',
      'https://v2.xxapi.cn/api/zhihuhot',
      'https://api.vvhan.com/api/hotlist?type=zhihu',
      'https://tenapi.cn/v2/zhihuhot',
      'https://api-hot.imsyy.top/zhihu',
      'https://api.guole.fun/zhihu',
      'https://api.zhihu.com/topstory/hot-lists/total?limit=50'
    ],
    enable: getConf('hot_zhihu_enable', 'bool', true),
    split: getConf('hot_zhihu_split', 'bool', true),
    ignore: getConf('hot_zhihu_ignore', 'bool', true),
    count: getConf('hot_zhihu_count', 'int', 3),
  },
  bilibili: {
    name: 'B站热门',
    // 默认跳转地址：B 站热门/热搜页面。通过 bilibili 内置浏览器 Scheme 打开官方 H5 热搜榜，
    // 避免使用短链导致 Loon 识别失败。使用浏览器形式可直接加载活动页而不会出现搜索框：
    // bilibili://browser?url=URLENCODE("https://www.bilibili.com/blackboard/activity-trending-topic.html")
    // 其中 https://www.bilibili.com/blackboard/activity-trending-topic.html 为 B 站官方热搜榜 H5 页面，
    // 已经按 URL 编码编码成参数。
    home: 'bilibili://browser?url=https%3A%2F%2Fwww.bilibili.com%2Fblackboard%2Factivity-trending-topic.html',
    urls: [
      'https://xzdx.top/api/tophub?type=bilihot',
      'https://v.api.aa1.cn/api/bilibili-rs/',
      'https://v2.xxapi.cn/api/bilibilihot',
      'https://api.vvhan.com/api/hotlist?type=bilibili',
      'https://tenapi.cn/v2/bilihot',
      'https://api-hot.imsyy.top/bilibili'
    ],
    enable: getConf('hot_bilibili_enable', 'bool', true),
    split: getConf('hot_bilibili_split', 'bool', true),
    ignore: getConf('hot_bilibili_ignore', 'bool', true),
    count: getConf('hot_bilibili_count', 'int', 3),
  },
  kr36: {
    name: '36氪热榜',
    // 默认跳转地址：36氪热榜 H5 页。此页面展示 36 氪实时热榜，使用官方移动端路径。
    home: 'https://36kr.com/hot-list-m?channel=copy_url',
    urls: [
      'https://xzdx.top/api/tophub?type=36kr',
      'https://v2.xxapi.cn/api/hot36kr',
      'https://api.vvhan.com/api/hotlist?type=36kr',
      'https://tenapi.cn/v2/36krhot',
      'https://api-hot.imsyy.top/36kr'
    ],
    enable: getConf('hot_36kr_enable', 'bool', true),
    split: getConf('hot_36kr_split', 'bool', true),
    ignore: getConf('hot_36kr_ignore', 'bool', true),
    count: getConf('hot_36kr_count', 'int', 3),
  },
  toutiao: {
    name: '头条热榜',
    // 默认跳转地址：今日头条首页（热榜暂无公开 scheme）
    home: 'snssdk141://',
    urls: [
      // 新增 guole 与 lolimi 提供的头条热榜
      'https://xzdx.top/api/tophub?type=toutiao',
      'https://v2.xxapi.cn/api/toutiaohot',
      'https://api.vvhan.com/api/hotlist?type=toutiao',
      'https://tenapi.cn/v2/toutiaohot',
      'https://api-hot.imsyy.top/toutiao',
      'https://api.guole.fun/toutiao',
      'https://api.lolimi.cn/API/jhrb/?hot=%E4%BB%8A%E6%97%A5%E5%A4%B4%E6%9D%A1'
    ],
    enable: getConf('hot_toutiao_enable', 'bool', true),
    split: getConf('hot_toutiao_split', 'bool', true),
    ignore: getConf('hot_toutiao_ignore', 'bool', true),
    count: getConf('hot_toutiao_count', 'int', 3),
  },
  xhs: {
    // 修改名称为小红书热榜，并在接口列表首位加入顺为数据提供的热点接口
    name: '小红书热榜',
    // 默认跳转地址：小红书发现页（探索推荐）
    home: 'xhsdiscover://home/explore',
    urls: [
      // 顺为数据小红书热点接口，需填写用户key。免费额度有限，如需长期使用请自行购买套餐。
      'https://api.itapi.cn/api/hotnews/xiaohongshu?key=8BheThaS4E4msRqzttdh6JzaKO',
      'https://xzdx.top/api/tophub?type=xhs',
      'https://v2.xxapi.cn/api/xhshot',
      'https://api.vvhan.com/api/hotlist?type=xhs',
      'https://tenapi.cn/v2/xhshot',
      'https://api-hot.imsyy.top/xhs'
    ],
    enable: getConf('hot_xhs_enable', 'bool', true),
    split: getConf('hot_xhs_split', 'bool', true),
    ignore: getConf('hot_xhs_ignore', 'bool', true),
    count: getConf('hot_xhs_count', 'int', 3),
  },
  kuaishou: {
    name: '快手热榜',
    // 默认跳转地址：快手热搜页
    // 使用原版脚本中的跳转地址，通过 kwai://search/topicRank 打开快手热榜页
    home: 'kwai://search/topicRank',
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
  // 统一构建通知选项，默认仅使用 open-url 字段以兼容 Loon/Surge/Quantumult X 等客户端。
  // 根据 Loon 官方脚本说明，点击通知时所打开的链接需放在 open-url 字段中。
  const opts = {};
  if (url) {
    // 仅设置 open-url，一个字段即可兼容大部分客户端，避免混淆。
    opts['open-url'] = url;
  }
  // 优先调用 $notify，如果不存在则退回到 $notification.post。两者使用相同的参数结构。
  if (typeof $notify === 'function') {
    try {
      $notify(title || '', '', body || '', opts);
      return;
    } catch (e) {
      // 如果调用失败则继续使用 $notification.post
    }
  }
  if (typeof $notification !== 'undefined' && typeof $notification.post === 'function') {
    try {
      $notification.post(title || '', '', body || '', opts);
      return;
    } catch (e) {
      // 忽略通知异常
    }
  }
  // 如果脚本环境不支持通知，则在控制台输出日志
  console.log(`[推送] ${title}: ${body} ${url || ''}`);
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
          // 36氪：使用热榜 H5 页面作为跳转地址
          url = 'https://36kr.com/hot-list-m?channel=copy_url';
        } else if (name === '头条热榜') {
          url = `snssdk1128://search?keyword=${encodeURIComponent(title)}`;
        } else if (name === '小红书') {
          url = `xhsdiscover://search?query=${encodeURIComponent(title)}`;
        }
      }
      return { title, url };
    });
  } else if (typeof list === 'string') {
    // 如果字符串包含 HTML 标签，则视为无效（比如接口返回了 HTML 错误页），直接返回 null
    const lower = list.trim().toLowerCase();
    if (lower.startsWith('<') || lower.includes('<html') || lower.includes('<head') || lower.includes('<!doctype')) {
      return null;
    }
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
        // 使用热榜 H5 页面作为跳转地址
        url: 'https://36kr.com/hot-list-m?channel=copy_url',
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

  // 根据平台覆盖 item.url 为 App 内搜索地址，以便单条推送能直接跳转至对应的热搜词界面
  try {
    items = items.map((it) => {
      const t = it.title || '';
      // 默认使用现有 url
      let newUrl = it.url || '';
      // 微博：使用微博搜索 Scheme
      if (name === '微博热搜') {
        newUrl = `sinaweibo://searchall?q=${encodeURIComponent(t)}`;
      }
      // 抖音：使用抖音搜索 Scheme
      else if (name === '抖音热榜') {
        newUrl = `snssdk1128://search?keyword=${encodeURIComponent(t)}`;
      }
      // 头条：使用今日头条搜索 Scheme
      else if (name === '头条热榜') {
        newUrl = `snssdk141://search?keyword=${encodeURIComponent(t)}`;
      }
      // 快手：使用快手搜索 Scheme
      else if (name === '快手热榜') {
        // 快手搜索 URL Scheme 经测试对中文关键字无需编码，直接传递原始标题可以正确跳转。
        // 编码后的关键字（%E9%85%B8%EF%BC%8C%E7%94%BB%E7%89%87等）有时会导致快手无法识别，因此这里不进行 encodeURIComponent 处理。
        newUrl = `kwai://search?keyword=${t}`;
      }
      // 小红书：使用小红书搜索结果页 Scheme
      else if (name === '小红书热榜' || name === '小红书') {
        newUrl = `xhsdiscover://search/result?keyword=${encodeURIComponent(t)}`;
      }
      // 百度：使用百度 App 搜索 Scheme
      else if (name === '百度热搜') {
        newUrl = `baiduboxapp://search?word=${encodeURIComponent(t)}`;
      }
      // B站：使用 B站搜索 Scheme
      else if (name === 'B站热门') {
        newUrl = `bilibili://search?keyword=${encodeURIComponent(t)}`;
      }
      // 36氪：无深度链接，保留原链接
      it.url = newUrl;
      return it;
    });
  } catch (ex) {
    console.log('⚠️ URL override error:', ex);
  }
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
          // 单条推送：若开启附带链接，则使用每条的 URL，否则留空
          finalItems.forEach((item, idx) => notify(`${cfg.name} Top${idx + 1}`, item.title, ATTACH_LINK ? item.url : ''));
        } else {
          // 合集推送：使用平台默认跳转地址（home）
          const body = finalItems.map((i, idx) => `${idx + 1}. ${i.title}`).join('\n');
          const homeUrl = cfg.home || '';
          notify(`${cfg.name} Top${finalItems.length}`, body, ATTACH_LINK ? homeUrl : '');
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
    // 新增 suyanw 快手热榜接口（返回文本格式）
    'https://api.suyanw.cn/api/kuaishou_hot_search.php',
    // 其他聚合接口
    'https://v2.xxapi.cn/api/kuaishouhot',
    'https://tenapi.cn/v2/kuaishouhot',
    'https://api.vvhan.com/api/hotlist?type=ks',
    'https://api-hot.imsyy.top/kuaishou',
    'https://api.lolimi.cn/API/jhrb/?hot=%E5%BF%AB%E6%89%8B',
    'https://api.guole.fun/kuaishou'
  ];
  for (const url of urls) {
    try {
      console.log(' 开始抓取: 快手');
      const res = await httpGet(url);
      // 如果返回的是 HTML（包含 <html> 或 <head>），直接跳过，避免解析错误
      if (typeof res === 'string') {
        const lower = res.toLowerCase();
        if (lower.includes('<html') || lower.includes('<head') || lower.includes('<!doctype')) {
          console.log(`⚠️ 快手接口返回 HTML，跳过 ${url}`);
          continue;
        }
      }
        // 当 suyanw 返回纯文本形式（包含"---快手热搜榜---"）时，按行解析
        let parsedItems = null;
        if (typeof res === 'string' && res.includes('快手热搜榜')) {
          const lines = res.split('\n');
          const titles = [];
          for (const ln of lines) {
            const m = ln.trim().match(/^[0-9]+[:：]\s*(.+)$/);
            if (m) {
              titles.push(m[1]);
            }
          }
          if (titles.length > 0) {
            parsedItems = titles.map((t) => ({ title: t, url: '' }));
          }
        }
        let list;
        if (res) {
          if (Array.isArray(res.data)) list = res.data;
          else if (Array.isArray(res)) list = res;
          else if (res.result && Array.isArray(res.result.data)) list = res.result.data;
          else list = res;
        }
        let items;
        if (parsedItems) {
          // 对文本解析出的列表再次调用 normalizeItems，以统一 URL 构建逻辑
          items = normalizeItems('快手热榜', parsedItems);
        } else {
          items = normalizeItems('快手热榜', list);
        }
        if (items && items.length > 0) {
          const finalItems = items.slice(0, cfg.count);
          if (cfg.split) {
            // 单条推送：附带每条 URL（如果设置了 ATTACH_LINK），否则留空
            finalItems.forEach((item, idx) => {
              notify(`快手热榜 Top${idx + 1}`, item.title, ATTACH_LINK ? item.url : '');
            });
          } else {
            // 合集推送：使用平台默认跳转地址
            const body = finalItems
              .map((i, idx) => `${idx + 1}. ${i.title}`)
              .join('\n');
            const homeUrl = cfg.home || '';
            notify(`快手热榜 Top${finalItems.length}`, body, ATTACH_LINK ? homeUrl : '');
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
