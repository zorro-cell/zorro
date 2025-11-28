/*
 Seek 多站关键词搜索
 支持平台：抖音 / 快手 / 小红书 / 微博 / B 站 / 知乎 / 今日头条

 使用方法：
 1. 在 BoxJs → 「Seek 多站关键词搜索」里填写关键词（每行一个）；
 2. 在同一个面板勾选要启用的平台开关（抖音/快手/小红书/微博/B站/知乎/今日头条）；
 3. 在 Quantumult X 的 task 里定时、或者手动运行本脚本；
 4. 每个「关键词 × 平台」会生成一条通知，点击即可打开对应搜索结果。

 本脚本：
 - 内部全部使用 seek 前缀（脚本名 / Env 名）；
 - 持久化 key 全是 seek_ 开头；
 - 不会跟你之前的 hot / hot_kw 系列冲突。
*/

// ========== 简易环境封装 ==========

const $ = new SeekEnv('Seek 多站关键词搜索');

// ========== BoxJs KEY 定义（全部 seek_ 开头） ==========

// 关键词列表（多行文本）
const SEEK_KW_LIST_KEY = 'seek_keywords';

// 各平台开关
const SEEK_ENABLE_DOUYIN   = 'seek_enable_douyin';
const SEEK_ENABLE_KUAISHOU = 'seek_enable_kuaishou';
const SEEK_ENABLE_XHS      = 'seek_enable_xhs';
const SEEK_ENABLE_WEIBO    = 'seek_enable_weibo';
const SEEK_ENABLE_BILIBILI = 'seek_enable_bilibili';
const SEEK_ENABLE_ZHIHU    = 'seek_enable_zhihu';
const SEEK_ENABLE_TOUTIAO  = 'seek_enable_toutiao';

// ========== 平台配置 ==========

const SEEK_PLATFORMS = [
  {
    id: 'douyin',
    name: '抖音',
    enableKey: SEEK_ENABLE_DOUYIN,
    // 抖音网页搜索（有机会唤起 App）
    buildUrl(kw) {
      return `https://www.douyin.com/search/${encodeURIComponent(kw)}`;
    }
  },
  {
    id: 'kuaishou',
    name: '快手',
    enableKey: SEEK_ENABLE_KUAISHOU,
    // 快手网页搜索
    buildUrl(kw) {
      return `https://www.kuaishou.com/search/video?searchKey=${encodeURIComponent(kw)}`;
    }
  },
  {
    id: 'xhs',
    name: '小红书',
    enableKey: SEEK_ENABLE_XHS,
    // 小红书搜索结果页
    buildUrl(kw) {
      return `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(kw)}`;
    }
  },
  {
    id: 'weibo',
    name: '微博',
    enableKey: SEEK_ENABLE_WEIBO,
    // 微博搜索（这里用网页，比较通用；想强制走 App 也可以自己改成 sinaweibo://searchall?q=）
    buildUrl(kw) {
      return `https://s.weibo.com/weibo?q=${encodeURIComponent(kw)}`;
    }
  },
  {
    id: 'bilibili',
    name: 'B站',
    enableKey: SEEK_ENABLE_BILIBILI,
    buildUrl(kw) {
      return `https://search.bilibili.com/all?keyword=${encodeURIComponent(kw)}`;
    }
  },
  {
    id: 'zhihu',
    name: '知乎',
    enableKey: SEEK_ENABLE_ZHIHU,
    buildUrl(kw) {
      return `https://www.zhihu.com/search?type=content&q=${encodeURIComponent(kw)}`;
    }
  },
  {
    id: 'toutiao',
    name: '今日头条',
    enableKey: SEEK_ENABLE_TOUTIAO,
    // 今日头条搜索（移动端搜索入口）
    buildUrl(kw) {
      return `https://m.toutiao.com/search?keyword=${encodeURIComponent(kw)}`;
    }
  }
];

// ========== 主逻辑 ==========

!(async () => {
  try {
    const rawKw = $.read(SEEK_KW_LIST_KEY) || '';
    const keywords = parseKeywords(rawKw);

    if (!keywords.length) {
      $.notify(
        'Seek 多站关键词搜索',
        '未配置关键词',
        '请在 BoxJs → Seek 多站关键词搜索 中填写关键词，每行一个。'
      );
      return $.done();
    }

    const enabledPlatforms = SEEK_PLATFORMS.filter(p => readBool(p.enableKey, true));

    if (!enabledPlatforms.length) {
      $.notify(
        'Seek 多站关键词搜索',
        '所有平台都被关闭',
        '请在 BoxJs 中至少打开一个平台开关（抖音/快手/小红书/微博/B站/知乎/今日头条）。'
      );
      return $.done();
    }

    let notifyCount = 0;

    for (const kw of keywords) {
      for (const p of enabledPlatforms) {
        const url = safeUrl(p.buildUrl(kw));
        const title = `${p.name} 搜索`;
        const subtitle = `关键词：${kw}`;
        const body = `点击打开 ${p.name} 中关于「${kw}」的搜索结果`;

        $.notify(title, subtitle, body, {
          'open-url': url,
          'media-url': url
        });

        notifyCount++;
      }
    }

    $.log(
      `本次运行：关键词 ${keywords.length} 个，平台 ${enabledPlatforms.length} 个，共推送 ${notifyCount} 条通知。`
    );
  } catch (e) {
    $.log('脚本运行异常：', e);
    $.notify('Seek 多站关键词搜索', '脚本运行异常', String(e));
  } finally {
    $.done();
  }
})();

// ========== 工具函数 ==========

// 把文本拆成关键词数组：支持 换行 / 逗号 / 分号 / 空格
function parseKeywords(raw) {
  return raw
    .split(/\n|,|，|;|；|\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

// 读取布尔（BoxJs 那些 true/false）
function readBool(key, def = true) {
  const v = $.read(key);
  if (v === undefined || v === null || v === '') return def;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  return ['1', 'true', 'yes', 'on', '打开', '开启'].includes(s);
}

function safeUrl(u) {
  if (!u) return 'https://www.baidu.com';
  return u;
}

// ========== 环境封装：SeekEnv ==========

function SeekEnv(name) {
  this.name = name;
  this.isQuanX = typeof $task !== 'undefined';
  this.isSurge = typeof $httpClient !== 'undefined' && !this.isQuanX;
  this.isLoon = typeof $loon !== 'undefined';
  this.isNode =
    typeof require === 'function' &&
    !this.isQuanX &&
    !this.isSurge &&
    !this.isLoon;

  this.log = (...args) => console.log(`[${this.name}]`, ...args);

  // 读取持久化（BoxJs 存的东西）
  this.read = key => {
    try {
      if (this.isQuanX) return $prefs.valueForKey(key);
      if (this.isSurge || this.isLoon) return $persistentStore.read(key);
      if (this.isNode) {
        const fs = require('fs');
        const path = require('path');
        const file = path.resolve('seek_data.json');
        if (!fs.existsSync(file)) return null;
        const data = JSON.parse(fs.readFileSync(file));
        return data[key];
      }
    } catch (e) {
      this.log('read 出错', e);
    }
    return null;
  };

  // 写入持久化（这里你一般用不到，预留）
  this.write = (value, key) => {
    try {
      if (this.isQuanX) return $prefs.setValueForKey(String(value), key);
      if (this.isSurge || this.isLoon)
        return $persistentStore.write(String(value), key);
      if (this.isNode) {
        const fs = require('fs');
        const path = require('path');
        const file = path.resolve('seek_data.json');
        let data = {};
        if (fs.existsSync(file)) {
          data = JSON.parse(fs.readFileSync(file));
        }
        data[key] = value;
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
        return true;
      }
    } catch (e) {
      this.log('write 出错', e);
    }
    return false;
  };

  // 通知
  this.notify = (title, subtitle, message, options) => {
    try {
      if (this.isQuanX) {
        $notify(title, subtitle, message, options);
      } else if (this.isSurge || this.isLoon) {
        $notification.post(title, subtitle, message, options);
      } else {
        this.log('通知：', title, subtitle, message, options || '');
      }
    } catch (e) {
      this.log('notify 出错', e);
    }
  };

  this.done = (value = {}) => {
    if (this.isQuanX || this.isSurge || this.isLoon) {
      $done(value);
    } else {
      this.log('脚本结束', JSON.stringify(value));
    }
  };
}
