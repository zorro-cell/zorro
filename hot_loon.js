/*******************************
 * 多平台热榜 - Loon 官方接口稳定版 V6.0
 * 修复：参数传递、接口地址、推送逻辑
 *******************************/

const $config = {};

// ========== 1. 参数解析 (自动处理 Loon 传入的参数) ==========
if (typeof $argument !== "undefined") {
    console.log("🟢 [原始参数]: " + $argument);
    $argument.split("&").forEach((item) => {
        const parts = item.split("=");
        if (parts.length >= 2) {
            const key = parts[0].trim();
            let val = parts.slice(1).join("=").trim();
            // 去除可能存在的引号
            val = val.replace(/^["']|["']$/g, '');
            try { val = decodeURIComponent(val); } catch(e) {}
            
            // 如果参数未被 Loon 替换(仍是占位符)，则忽略，使用默认值
            if (!val.startsWith("{")) {
                $config[key] = val;
            }
        }
    });
}

function getConf(key, type, defVal) {
    let val = $config[key];
    if (val === undefined || val === null) return defVal;
    if (type === "bool") return String(val).toLowerCase() === "true";
    if (type === "int") return parseInt(val, 10) || defVal;
    return String(val);
}

// ========== 2. 初始化配置 ==========
const KEYWORDS_STR = getConf("hot_keywords", "string", "");
const KEYWORDS = KEYWORDS_STR.split(/[,，\s]/).map(x => x.trim()).filter(Boolean);
const PUSH_HOURS_STR = getConf("hot_push_hours", "string", "");
const ATTACH_LINK = getConf("hot_attach_link", "bool", true);

console.log(`🔵 [配置生效]: 关键词[${KEYWORDS}], 时间[${PUSH_HOURS_STR || "全天"}]`);

// 接口地址配置 (使用官方或高可用接口)
const CFG = {
    weibo:    { name: "微博热搜", url: "https://weibo.com/ajax/side/hotSearch", enable: getConf("hot_weibo_enable", "bool", true), split: getConf("hot_weibo_split", "bool", true), ignore: getConf("hot_weibo_ignore", "bool", true), count: getConf("hot_weibo_count", "int", 3) },
    baidu:    { name: "百度热搜", url: "https://top.baidu.com/board?tab=realtime", enable: getConf("hot_baidu_enable", "bool", true), split: getConf("hot_baidu_split", "bool", true), ignore: getConf("hot_baidu_ignore", "bool", true), count: getConf("hot_baidu_count", "int", 3) },
    douyin:   { name: "抖音热榜", url: "https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/", enable: getConf("hot_douyin_enable", "bool", true), split: getConf("hot_douyin_split", "bool", true), ignore: getConf("hot_douyin_ignore", "bool", true), count: getConf("hot_douyin_count", "int", 3) },
    zhihu:    { name: "知乎热榜", url: "https://api.zhihu.com/topstory/hot-list?limit=50&desktop=true", enable: getConf("hot_zhihu_enable", "bool", true), split: getConf("hot_zhihu_split", "bool", true), ignore: getConf("hot_zhihu_ignore", "bool", true), count: getConf("hot_zhihu_count", "int", 3) },
    bilibili: { name: "B站热门",  url: "https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all", enable: getConf("hot_bilibili_enable", "bool", true), split: getConf("hot_bilibili_split", "bool", true), ignore: getConf("hot_bilibili_ignore", "bool", true), count: getConf("hot_bilibili_count", "int", 3) },
    kr36:     { name: "36氪热榜", url: "https://gateway.36kr.com/api/mis/nav/newsflash/flow", enable: getConf("hot_36kr_enable", "bool", true), split: getConf("hot_36kr_split", "bool", true), ignore: getConf("hot_36kr_ignore", "bool", true), count: getConf("hot_36kr_count", "int", 3) },
    toutiao:  { name: "头条热榜", url: "https://api.vvhan.com/api/hotlist?type=toutiao", enable: getConf("hot_toutiao_enable", "bool", true), split: getConf("hot_toutiao_split", "bool", true), ignore: getConf("hot_toutiao_ignore", "bool", true), count: getConf("hot_toutiao_count", "int", 3) },
    xhs:      { name: "小红书",   url: "https://api.vvhan.com/api/hotlist?type=xhs", enable: getConf("hot_xhs_enable", "bool", true), split: getConf("hot_xhs_split", "bool", true), ignore: getConf("hot_xhs_ignore", "bool", true), count: getConf("hot_xhs_count", "int", 3) },
    kuaishou: { name: "快手热榜", enable: getConf("hot_kuaishou_enable", "bool", true), split: getConf("hot_kuaishou_split", "bool", true), ignore: getConf("hot_kuaishou_ignore", "bool", true), count: getConf("hot_kuaishou_count", "int", 3) }
};

// ========== 3. 辅助函数 ==========
const UA = { 
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    "Referer": "https://www.baidu.com"
};

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
            try { 
                if (url.includes("baidu") && body.includes("<html")) {
                    resolve(body); // 百度 HTML 特殊处理
                } else {
                    resolve(JSON.parse(body));
                }
            } catch (e) { 
                reject("JSON解析失败"); 
            }
        });
    });
}

function checkTime() {
    if (!PUSH_HOURS_STR) return true;
    const h = new Date().getHours();
    const allowed = PUSH_HOURS_STR.split(/[,，]/).map(n => {
        let val = parseInt(n);
        if (val === 24) val = 0;
        return val;
    }).filter(n => !isNaN(n));
    
    if (allowed.includes(h)) return true;
    console.log(`⏰ 当前 ${h} 点不在推送时间 ${JSON.stringify(allowed)}，跳过`);
    return false;
}

// 统一数据处理
function processList(name, list, cfg) {
    if (!list) return null;
    let items = [];

    // 数据标准化
    if (name === "微博热搜") {
        items = (list.realtime || []).map(x => ({ title: x.word_scheme, url: `sinaweibo://searchall?q=${encodeURIComponent(x.word_scheme)}` }));
    } else if (name === "抖音热榜") {
        items = (list.word_list || []).map(x => ({ title: x.word, url: `snssdk1128://search?keyword=${encodeURIComponent(x.word)}` }));
    } else if (name === "百度热搜") {
        if (typeof list === "string") {
            const matches = [...list.matchAll(/<div class="c-single-text-ellipsis">\s*(.*?)\s*<\/div>/g)];
            items = matches.map(m => ({ title: m[1].trim(), url: `baiduboxapp://search?word=${encodeURIComponent(m[1].trim())}` }));
        }
    } else if (name === "知乎热榜") {
        items = (list.data || []).map(x => {
            const t = x.target.title;
            const u = x.target.url.replace("https://api.zhihu.com/questions", "zhihu://questions");
            return { title: t, url: u };
        });
    } else if (name === "B站热门") {
        items = (list.data?.list || []).map(x => ({ title: x.title, url: x.short_link?.replace("https://b23.tv", "bilibili://video") || "" }));
    } else if (name === "36氪热榜") {
        items = (list.data?.itemList || []).map(x => ({ title: x.templateMaterial?.widgetTitle, url: "https://36kr.com/newsflashes" }));
    } else {
        // VVhan 等通用接口
        items = (list.data || []).map(x => ({ title: x.title, url: x.url }));
    }

    // 过滤无效数据
    items = items.filter(x => x.title);
    if (items.length === 0) return null;

    // 1. 关键词过滤
    let filtered = [];
    if (KEYWORDS.length > 0) {
        filtered = items.filter(item => KEYWORDS.some(k => item.title.includes(k)));
        if (filtered.length > 0) console.log(`✅ ${name}: 命中关键词 ${filtered.length} 条`);
    }

    // 2. 无词推新逻辑
    if (filtered.length === 0) {
        // 如果开启了忽略（无词推新） OR 用户本来就没填关键词 => 推送全部里的前几条
        if (cfg.ignore || KEYWORDS.length === 0) {
            filtered = items;
        } else {
            console.log(`⛔ ${name}: 无关键词匹配且未开启推新，跳过`);
            return null;
        }
    }

    return filtered.slice(0, cfg.count);
}

// ========== 4. 抓取逻辑 ==========
async function fetchCommon(key) {
    const cfg = CFG[key];
    if (!cfg.enable) return;

    try {
        console.log(`🚀 开始抓取: ${cfg.name}`);
        const data = await httpGet(cfg.url);
        const finalItems = processList(cfg.name, data, cfg);
        
        if (finalItems && finalItems.length > 0) {
            if (cfg.split) {
                finalItems.forEach((item, idx) => notify(`${cfg.name} Top${idx+1}`, item.title, ATTACH_LINK ? item.url : ""));
            } else {
                const body = finalItems.map((i, idx) => `${idx+1}. ${i.title}`).join("\n");
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
    const urls = ["https://tenapi.cn/v2/kuaishouhot", "https://api.vvhan.com/api/hotlist?type=ks"];
    for (let url of urls) {
        try {
            console.log(`🚀 开始抓取: 快手`);
            const json = await httpGet(url);
            let list = json.data || (json.result ? json.result.data : []);
            const finalItems = processList("快手热榜", list, cfg);
            if (finalItems) {
                if (cfg.split) finalItems.forEach((item, idx) => notify(`快手热榜 Top${idx+1}`, item.title, item.url));
                else notify(`快手热榜 Top${finalItems.length}`, finalItems.map((i, idx) => `${idx+1}. ${i.title}`).join("\n"), "");
                return;
            }
        } catch (e) {}
    }
    console.log(`❌ 快手失败`);
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
