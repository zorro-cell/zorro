/*
 * 多平台热榜监控 - Loon 专属版
 * 
 * @author 心事全在脸上
 * @homepage  https://t.me/Santiagocell
 * @version 7.2
 * @date 2025-12-10
 */

// ==================== 配置解析 ====================
const $config = {};

if (typeof $argument !== 'undefined' && typeof $argument === 'object') {
  Object.keys($argument).forEach(key => {
    const val = $argument[key];
    if (val !== undefined && val !== null && val !== '') {
      $config[key] = val;
    }
  });
}

function getConfig(key, type, defaultValue) {
  let value = $config[key];
  if (value === undefined || value === null || value === '') return defaultValue;
  
  switch (type) {
    case 'bool':
      return String(value).toLowerCase() === 'true';
    case 'int':
      return parseInt(value, 10) || defaultValue;
    default:
      return String(value);
  }
}

// ==================== 全局配置 ====================
const KEYWORDS_STR = getConfig('hot_keywords', 'string', '');
const KEYWORDS = KEYWORDS_STR.split(/[,，\s]+/).map(k => k.trim()).filter(Boolean);
const PUSH_HOURS_STR = getConfig('hot_push_hours', 'string', '');
const ATTACH_LINK = getConfig('hot_attach_link', 'bool', true);

console.log(`🎯 [配置] 关键词: ${KEYWORDS.length > 0 ? KEYWORDS.join(', ') : '全部'}`);
console.log(`⏰ [配置] 推送时间: ${PUSH_HOURS_STR || '全天'}`);
console.log(`🔗 [配置] 附带链接: ${ATTACH_LINK ? '是' : '否'}`);

// ==================== 平台配置 ====================
const PLATFORMS = {
  weibo: {
    name: '微博热搜',
    home: 'sinaweibo://pageinfo?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot',
    urls: [
      'https://xzdx.top/api/tophub?type=weibo',
      'https://v2.xxapi.cn/api/weibohot',
      'https://api.vvhan.com/api/hotlist?type=weibo',
      'https://tenapi.cn/v2/weibohot',
      'https://api-hot.imsyy.top/weibo'
    ],
    enable: getConfig('hot_weibo_enable', 'bool', true),
    split: getConfig('hot_weibo_split', 'bool', true),
    ignore: getConfig('hot_weibo_ignore', 'bool', true),
    count: getConfig('hot_weibo_count', 'int', 3)
  },
  baidu: {
    name: '百度热搜',
    home: 'baiduboxapp://v1/easybrowse/open?url=https%3A%2F%2Ftop.baidu.com%2Fboard%3Ftab%3Drealtime',
    urls: [
      'https://xzdx.top/api/tophub?type=baidu',
      'https://v2.xxapi.cn/api/baiduhot',
      'https://api.vvhan.com/api/hotlist?type=baiduRD',
      'https://tenapi.cn/v2/baiduhot',
      'https://api-hot.imsyy.top/baidu'
    ],
    enable: getConfig('hot_baidu_enable', 'bool', true),
    split: getConfig('hot_baidu_split', 'bool', true),
    ignore: getConfig('hot_baidu_ignore', 'bool', true),
    count: getConfig('hot_baidu_count', 'int', 3)
  },
  douyin: {
    name: '抖音热榜',
    home: 'snssdk1128://search/trending',
    urls: [
      'https://xzdx.top/api/tophub?type=douyin',
      'https://v2.xxapi.cn/api/douyinhot',
      'https://api.vvhan.com/api/hotlist?type=douyin',
      'https://tenapi.cn/v2/douyinhot',
      'https://api-hot.imsyy.top/douyin'
    ],
    enable: getConfig('hot_douyin_enable', 'bool', true),
    split: getConfig('hot_douyin_split', 'bool', true),
    ignore: getConfig('hot_douyin_ignore', 'bool', true),
    count: getConfig('hot_douyin_count', 'int', 3)
  },
  zhihu: {
    name: '知乎热榜',
    home: 'zhihu://topstory/hot-list',
    urls: [
      'https://xzdx.top/api/tophub?type=zhihu',
      'https://v2.xxapi.cn/api/zhihuhot',
      'https://api.vvhan.com/api/hotlist?type=zhihu',
      'https://tenapi.cn/v2/zhihuhot',
      'https://api-hot.imsyy.top/zhihu'
    ],
    enable: getConfig('hot_zhihu_enable', 'bool', true),
    split: getConfig('hot_zhihu_split', 'bool', true),
    ignore: getConfig('hot_zhihu_ignore', 'bool', true),
    count: getConfig('hot_zhihu_count', 'int', 3)
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
      'https://api-hot.imsyy.top/bilibili'
    ],
    enable: getConfig('hot_bilibili_enable', 'bool', true),
    split: getConfig('hot_bilibili_split', 'bool', true),
    ignore: getConfig('hot_bilibili_ignore', 'bool', true),
    count: getConfig('hot_bilibili_count', 'int', 3)
  },
  kr36: {
    name: '36氪热榜',
    home: 'https://36kr.com/newsflashes',
    urls: [
      'https://xzdx.top/api/tophub?type=36kr',
      'https://v2.xxapi.cn/api/hot36kr',
      'https://api.vvhan.com/api/hotlist?type=36kr',
      'https://tenapi.cn/v2/36krhot',
      'https://api-hot.imsyy.top/36kr'
    ],
    enable: getConfig('hot_36kr_enable', 'bool', false),
    split: getConfig('hot_36kr_split', 'bool', true),
    ignore: getConfig('hot_36kr_ignore', 'bool', true),
    count: getConfig('hot_36kr_count', 'int', 3)
  },
  toutiao: {
    name: '头条热榜',
    home: 'snssdk141://',
    urls: [
      'https://xzdx.top/api/tophub?type=toutiao',
      'https://v2.xxapi.cn/api/toutiaohot',
      'https://api.vvhan.com/api/hotlist?type=toutiao',
      'https://tenapi.cn/v2/toutiaohot',
      'https://api-hot.imsyy.top/toutiao'
    ],
    enable: getConfig('hot_toutiao_enable', 'bool', false),
    split: getConfig('hot_toutiao_split', 'bool', true),
    ignore: getConfig('hot_toutiao_ignore', 'bool', true),
    count: getConfig('hot_toutiao_count', 'int', 3)
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
      'https://api-hot.imsyy.top/xhs'
    ],
    enable: getConfig('hot_xhs_enable', 'bool', false),
    split: getConfig('hot_xhs_split', 'bool', true),
    ignore: getConfig('hot_xhs_ignore', 'bool', true),
    count: getConfig('hot_xhs_count', 'int', 3)
  },
  kuaishou: {
    name: '快手热榜',
    home: 'kwai://home/hot',
    urls: [
      'https://api.suyanw.cn/api/kuaishou_hot_search.php',
      'https://v2.xxapi.cn/api/kuaishouhot',
      'https://tenapi.cn/v2/kuaishouhot',
      'https://api.vvhan.com/api/hotlist?type=ks',
      'https://api-hot.imsyy.top/kuaishou'
    ],
    enable: getConfig('hot_kuaishou_enable', 'bool', false),
    split: getConfig('hot_kuaishou_split', 'bool', true),
    ignore: getConfig('hot_kuaishou_ignore', 'bool', true),
    count: getConfig('hot_kuaishou_count', 'int', 3)
  }
};

// ==================== 工具函数 ====================
const USER_AGENT = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  'Referer': 'https://www.baidu.com'
};

function notify(title, subtitle, body, url) {
  try {
    if (url && ATTACH_LINK) {
      $notification.post(title, subtitle, body, url);
    } else {
      $notification.post(title, subtitle, body);
    }
  } catch (error) {
    console.log(`❌ [通知失败] ${title}: ${error}`);
  }
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get(
      { 
        url: url, 
        headers: USER_AGENT, 
        timeout: 20000  // 20 秒超时（单位 ms）
      },
      (error, response, data) => {
        if (error) {
          reject(error);
          return;
        }
        
        try {
          if (typeof data === 'string' && data.trim().startsWith('<')) {
            resolve(data);
            return;
          }
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      }
    );
  });
}

function isInPushTime() {
  if (!PUSH_HOURS_STR) return true;
  
  const currentHour = new Date().getHours();
  const allowedHours = PUSH_HOURS_STR
    .split(/[,，]/)
    .map(h => parseInt(h.trim(), 10))
    .filter(h => !isNaN(h) && h >= 0 && h <= 23);
  
  if (allowedHours.includes(currentHour)) return true;
  
  console.log(`⏰ 当前 ${currentHour} 点不在推送时间,跳过`);
  return false;
}

// ==================== 数据处理 ====================
function normalizeData(platformName, rawData) {
  if (!rawData) return null;
  
  let items = [];
  
  if (Array.isArray(rawData)) {
    items = rawData.map(item => ({
      title: item.title || item.word || item.name || item.desc || '',
      url: item.url || item.link || ''
    }));
  }
  else if (typeof rawData === 'string') {
    const lower = rawData.trim().toLowerCase();
    if (lower.startsWith('<') || lower.includes('<html')) return null;
    
    items = rawData
      .split(/[、,，]/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(title => ({ title, url: '' }));
  }
  else if (typeof rawData === 'object') {
    const dataArray = rawData.data || rawData.result?.data || [];
    
    if (platformName === '36氪热榜') {
      items = (rawData.data?.itemList || []).map(item => ({
        title: item.templateMaterial?.widgetTitle || item.title || '',
        url: 'https://36kr.com/hot-list-m'
      }));
    } else if (platformName === 'B站热门') {
      items = (rawData.data?.list || []).map(item => ({
        title: item.title || '',
        url: item.short_link || ''
      }));
    } else if (platformName === '知乎热榜') {
      items = dataArray.map(item => ({
        title: item.target?.title || item.title || '',
        url: item.target?.url || ''
      }));
    } else if (platformName === '微博热搜') {
      items = (rawData.realtime || []).map(item => ({
        title: item.word_scheme || item.word || '',
        url: ''
      }));
    } else if (platformName === '抖音热榜') {
      items = (rawData.word_list || []).map(item => ({
        title: item.word || '',
        url: ''
      }));
    } else {
      items = dataArray.map(item => ({
        title: item.title || '',
        url: item.url || ''
      }));
    }
  }
  
  items = items.filter(item => item.title);
  if (items.length === 0) return null;
  
  // 生成 URL Scheme
  items = items.map(item => {
    const encodedTitle = encodeURIComponent(item.title);
    let url = item.url;
    
    if (platformName === '微博热搜') {
      url = `sinaweibo://searchall?q=${encodedTitle}`;
    } else if (platformName === '抖音热榜') {
      url = `snssdk1128://search?keyword=${encodedTitle}`;
    } else if (platformName === '头条热榜') {
      url = `snssdk141://search?keyword=${encodedTitle}`;
    } else if (platformName === '快手热榜') {
      url = `kwai://search?keyword=${item.title}`;
    } else if (platformName === '小红书热榜') {
      url = `xhsdiscover://search/result?keyword=${encodedTitle}`;
    } else if (platformName === '百度热搜') {
      url = `baiduboxapp://search?word=${encodedTitle}`;
    } else if (platformName === 'B站热门' && !url.includes('bilibili://')) {
      url = `bilibili://search?keyword=${encodedTitle}`;
    } else if (platformName === '知乎热榜' && url) {
      url = url.replace('https://api.zhihu.com/questions', 'zhihu://questions');
    }
    
    return { ...item, url };
  });
  
  // 关键词过滤
  let filtered = [];
  if (KEYWORDS.length > 0) {
    filtered = items.filter(item =>
      KEYWORDS.some(keyword => item.title.includes(keyword))
    );
    
    if (filtered.length > 0) {
      console.log(`✅ [${platformName}] 命中关键词 ${filtered.length} 条`);
    }
  }
  
  if (filtered.length === 0) {
    const platformKey = Object.keys(PLATFORMS).find(
      key => PLATFORMS[key].name === platformName
    );
    const platform = PLATFORMS[platformKey];
    
    if (platform?.ignore || KEYWORDS.length === 0) {
      filtered = items;
    } else {
      console.log(`⛔ [${platformName}] 无关键词匹配且未开启推新,跳过`);
      return null;
    }
  }
  
  return filtered;
}

// ==================== 抓取函数 ====================
async function fetchPlatform(platformKey) {
  const platform = PLATFORMS[platformKey];
  if (!platform.enable) return;
  
  console.log(`📡 [${platform.name}] 开始抓取...`);
  
  for (const apiUrl of platform.urls) {
    try {
      const rawData = await httpGet(apiUrl);
      let listData;
      
      if (Array.isArray(rawData)) {
        listData = rawData;
      } else if (rawData?.data) {
        listData = Array.isArray(rawData.data) ? rawData.data : rawData;
      } else if (rawData?.result?.data) {
        listData = rawData.result.data;
      } else {
        listData = rawData;
      }
      
      const items = normalizeData(platform.name, listData);
      
      if (items && items.length > 0) {
        const finalItems = items.slice(0, platform.count);
        
        if (platform.split) {
          finalItems.forEach((item, index) => {
            notify(
              `${platform.name} Top${index + 1}`,
              '',
              item.title,
              item.url
            );
          });
        } else {
          const body = finalItems
            .map((item, index) => `${index + 1}. ${item.title}`)
            .join('\n');
          notify(
            `${platform.name}`,
            `Top ${finalItems.length}`,
            body,
            platform.home
          );
        }
        
        console.log(`✅ [${platform.name}] 推送成功 ${finalItems.length} 条`);
        return;
      }
    } catch (error) {
      console.log(`⚠️ [${platform.name}] 接口失败: ${error.message || error}`);
      continue;
    }
  }
  
  console.log(`❌ [${platform.name}] 所有接口均失败`);
}

// ==================== 主程序 ====================
(async () => {
  console.log('🚀 ========== 多平台热榜监控启动 ==========');
  
  if (!isInPushTime()) {
    $done();
    return;
  }
  
  const enabledPlatforms = Object.keys(PLATFORMS).filter(
    key => PLATFORMS[key].enable
  );
  
  console.log(`📊 已启用平台: ${enabledPlatforms.map(k => PLATFORMS[k].name).join(', ')}`);
  
  await Promise.all(
    enabledPlatforms.map(key => fetchPlatform(key))
  );
  
  console.log('✅ ========== 多平台热榜监控完成 ==========');
  $done();
})();
