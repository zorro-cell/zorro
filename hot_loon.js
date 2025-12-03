/*******************************
 * 多平台热榜 - Loon 终极修复版
 * 修复：参数传递、界面显示、关键词逻辑
 *******************************/

const $config = {};

// 1. 参数解析 (增强版)
if (typeof $argument !== "undefined") {
    // 调试日志：查看 Loon 到底传了什么进来
    console.log("🟢 [原始参数]: " + $argument);
    
    $argument.split("&").forEach((item) => {
        const parts = item.split("=");
        if (parts.length >= 2) {
            const key = parts[0].trim();
            // 兼容处理：值可能包含引号，需要去除
            let val = parts.slice(1).join("=").trim();
            val = val.replace(/^["']|["']$/g, '');
            try { val = decodeURIComponent(val); } catch(e) {}
            $config[key] = val;
        }
    });
} else {
    console.log("🔴 [严重错误] 脚本未接收到参数！请检查 .plugin 文件中的 argument 字段。");
}

function getConf(key, type, defVal) {
    let val = $config[key];
    if (val === undefined || val === null) return defVal;
    if (type === "bool") return String(val).toLowerCase() === "true";
    if (type === "int") return parseInt(val, 10) || defVal;
    return String(val);
}

// 2. 初始化配置
const KEYWORDS_STR = getConf("hot_keywords", "string", "");
const KEYWORDS = KEYWORDS_STR.split(/[,，\s]/).map(x => x.trim()).filter(Boolean);
const PUSH_HOURS_STR = getConf("hot_push_hours", "string", "");
const ATTACH_LINK = getConf("hot_attach_link", "bool", true);

console.log(`🔵 [配置生效]: 关键词[${KEYWORDS}], 时间[${PUSH_HOURS_STR || "全天"}]`);

const CFG = {
    weibo:    { name: "微博热搜", url: "https://v2.xxapi.cn/api/weibohot", enable: getConf("hot_weibo_enable", "bool", true), split: getConf("hot_weibo_split", "bool", true), ignore: getConf("hot_weibo_ignore", "bool", true), count: getConf("hot_weibo_count", "int", 3) },
    baidu:    { name: "百度热搜", url: "https://v2.xxapi.cn/api/baiduhot", enable: getConf("hot_baidu_enable", "bool", true), split: getConf("hot_baidu_split", "bool", true), ignore: getConf("hot_baidu_ignore", "bool", true), count: getConf("hot_baidu_count", "int", 3) },
    douyin:   { name: "抖音热榜", url: "https://v2.xxapi.cn/api/douyinhot", enable: getConf("hot_douyin_enable", "bool", true), split: getConf("hot_douyin_split", "bool", true), ignore: getConf("hot_douyin_ignore", "bool", true), count: getConf("hot_douyin_count", "int", 3) },
    zhihu:    { name: "知乎热榜", url: "https://api.pearktrue.cn/api/dailyhot/?title=知乎", enable: getConf("hot_zhihu_enable", "bool", true), split: getConf("hot_zhihu_split", "bool", true), ignore: getConf("hot_zhihu_ignore", "bool", true), count: getConf("hot_zhihu_count", "int", 3) },
    bilibili: { name: "B站热门",  url: "https://api.pearktrue.cn/api/dailyhot/?title=哔哩哔哩", enable: getConf("hot_bilibili_enable", "bool", true), split: getConf("hot_bilibili_split", "bool", true), ignore: getConf("hot_bilibili_ignore", "bool", true), count: getConf("hot_bilibili_count", "int", 3) },
    kr36:     { name: "36氪热榜", url: "https://v2.xxapi.cn/api/hot36kr", enable: getConf("hot_36kr_enable", "bool", true), split: getConf("hot_36kr_split", "bool", true), ignore: getConf("hot_36kr_ignore", "bool", true), count: getConf("hot_36kr_count", "int", 3) },
    toutiao:  { name: "头条热榜", url: "https://api.pearktrue.cn/api/dailyhot/?title=今日头条", enable: getConf("hot_toutiao_enable", "bool", true), split: getConf("hot_toutiao_split", "bool", true), ignore: getConf("hot_toutiao_ignore", "bool", true), count: getConf("hot_toutiao_count", "int", 3) },
    xhs:      { name: "小红书",   url: "https://api.pearktrue.cn/api/dailyhot/?title=小红书", enable: getConf("hot_xhs_enable", "bool", true), split: getConf("hot_xhs_split", "bool", true), ignore: getConf("hot_xhs_ignore", "bool", true), count: getConf("hot_xhs_count", "int", 3) },
    kuaishou: { name: "快手热榜", enable: getConf("hot_kuaishou_enable", "bool", true), split: getConf("hot_kuaishou_split", "bool", true), ignore: getConf("hot_kuaishou_ignore", "bool", true), count: getConf("hot_kuaishou_count", "int", 3) }
};

// 3. 辅助函数
const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1" };

function notify(title, body, url) {
    if (typeof $notification !== "undefined") {
        $notification.post(title, "", body, url || "");
    } else {
        console.log(`[推送] ${title}: ${body}`);
    }
}

function httpGet(url) {
    return new Promise((resolve, reject) => {
        $httpClient.get({ url: url, headers: UA, timeout: 8000 }, (err, resp, body) => {
            if (err) return reject(err);
            try { resolve(JSON.parse(body)); } catch (e) { reject("JSON解析错误"); }
        });
    });
}

function checkTime() {
    if (!PUSH_HOURS_STR) return true;
    const h = new Date().getHours();
    const allowed = PUSH_HOURS_STR.split(/[,，]/).map(n => parseInt(n)).filter(n => !isNaN(n));
    if (allowed.includes(h)) return true;
    console.log(`⏰ 当前 ${h} 点不在推送时间 ${JSON.stringify(allowed)}，跳过`);
    return false;
}

function getTitle(item) {
    if (typeof item === "string") return item;
    return item.title || item.word || item.keyword || item.name || item.hot_word || "";
}

function getUrl(item, name) {
    const raw = item.url || item.link || item.scheme || item.href || "";
    const title = getTitle(item);
    const enc = encodeURIComponent(title);
    if (name.includes("微博")) return `sinaweibo://searchall?q=${enc}`;
    if (name.includes("抖音")) return `snssdk1128://search?keyword=${enc}`;
    if (name.includes("百度")) return `baiduboxapp://search?word=${enc}`;
    if (name.includes("知乎")) return raw.includes("question") ? raw.replace("https://www.zhihu.com/question", "zhihu://questions") : `zhihu://search?type=content&q=${enc}`;
    if (name.includes("B站")) return `bilibili://search?keyword=${enc}`;
    if (name.includes("头条")) return `snssdk141://search?keyword=${enc}`;
    if (name.includes("快手")) return `kwai://search?keyword=${enc}`;
    if (name.includes("红书")) return `xhsdiscover://search?keyword=${enc}`;
    return raw;
}

function processItems(items, cfg) {
    if (!Array.isArray(items) || items.length === 0) return null;
    
    // 1. 关键词过滤
    let filtered = [];
    if (KEYWORDS.length > 0) {
        filtered = items.filter(item => {
            const t = getTitle(item);
            return KEYWORDS.some(k => t.includes(k));
        });
        if (filtered.length > 0) console.log(`✅ ${cfg.name}: 命中关键词 ${filtered.length} 条`);
    }

    // 2. 如果没命中关键词
    if (filtered.length === 0) {
        // 关键修复：如果ignore=true（无词推新）或者 用户没填关键词，则推最新
        if (cfg.ignore || KEYWORDS.length === 0) {
            filtered = items;
        } else {
            console.log(`⛔ ${cfg.name}: 无关键词匹配且未开启推新，跳过`);
            return null;
        }
    }
    return filtered.slice(0, cfg.count);
}

// 4. 抓取逻辑
async function fetchCommon(key) {
    const cfg = CFG[key];
    if (!cfg.enable) return;

    try {
        console.log(`🚀 开始抓取: ${cfg.name}`);
        const json = await httpGet(cfg.url);
        let list = [];
        if (Array.isArray(json.data)) list = json.data;
        else if (json.data && Array.isArray(json.data.list)) list = json.data.list;
        else if (Array.isArray(json)) list = json; 

        const finalItems = processItems(list, cfg);
        if (finalItems && finalItems.length > 0) {
            if (cfg.split) {
                finalItems.forEach((item, idx) => notify(`${cfg.name} Top${idx+1}`, getTitle(item), ATTACH_LINK ? getUrl(item, cfg.name) : ""));
            } else {
                const body = finalItems.map((i, idx) => `${idx+1}. ${getTitle(i)}`).join("\n");
                notify(`${cfg.name} Top${finalItems.length}`, body, "");
            }
        }
    } catch (e) {
        console.log(`❌ ${cfg.name} 错误: ${e}`);
    }
}

async function fetchKuaishou() {
    const cfg = CFG.kuaishou;
    if (!cfg.enable) return;
    const urls = ["https://tenapi.cn/v2/kuaishouhot", "https://api.oioweb.cn/api/common/kuaishou"];
    for (let url of urls) {
        try {
            console.log(`🚀 开始抓取: 快手 (${url})`);
            const json = await httpGet(url);
            let list = json.data || (json.result ? json.result.data : []);
            const finalItems = processItems(list, cfg);
            if (finalItems) {
                if (cfg.split) {
                    finalItems.forEach((item, idx) => notify(`快手热榜 Top${idx+1}`, getTitle(item), ""));
                } else {
                    notify(`快手热榜 Top${finalItems.length}`, finalItems.map((i, idx) => `${idx+1}. ${getTitle(i)}`).join("\n"), "");
                }
                return;
            }
        } catch (e) {}
    }
    console.log(`❌ 快手接口全部失败`);
}

!(async () => {
    if (!checkTime()) { $done(); return; }
    await Promise.all([
        fetchCommon("weibo"), fetchCommon("baidu"), fetchCommon("douyin"),
        fetchCommon("zhihu"), fetchCommon("bilibili"), fetchCommon("kr36"),
        fetchCommon("toutiao"), fetchCommon("xhs"), fetchKuaishou()
    ]);
    $done();
})();
