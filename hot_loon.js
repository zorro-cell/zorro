/*******************************
 * 多平台热榜 - Loon 专用修复版
 * 核心逻辑：严谨读取 Loon $argument
 *******************************/

// ============================================
// 1. 参数解析 (最关键的一步)
// ============================================

const $config = {};

// 打印原始参数，用于调试（请在日志中查看这一行）
if (typeof $argument !== "undefined") {
    console.log("🟢 [原始参数]: " + $argument);
    
    // 解析逻辑：处理 & 分隔，处理 = 分隔，去除引号，去除空格
    $argument.split("&").forEach((item) => {
        const parts = item.split("=");
        if (parts.length >= 2) {
            const key = parts[0].trim();
            let val = parts.slice(1).join("=").trim();
            // 去除可能存在的首尾引号
            val = val.replace(/^["']|["']$/g, '');
            try { val = decodeURIComponent(val); } catch(e) {}
            $config[key] = val;
        }
    });
} else {
    console.log("🔴 [警告] 未接收到 Loon 参数，$argument 为空！");
}

// 辅助函数：从 $config 中读取配置
function getConf(key, type, defVal) {
    let val = $config[key];
    
    if (val === undefined || val === null) {
        return defVal;
    }

    if (type === "bool") {
        const s = String(val).toLowerCase();
        return s === "true" || s === "1" || s === "on" || s === "yes";
    }
    
    if (type === "int") {
        const n = parseInt(val, 10);
        return isNaN(n) ? defVal : n;
    }
    
    return String(val);
}

// ============================================
// 2. 全局配置初始化
// ============================================

const KEYWORDS_STR = getConf("hot_keywords", "string", "");
const KEYWORDS = KEYWORDS_STR.split(/[,，\s]/).map(x => x.trim()).filter(Boolean);
const PUSH_HOURS_STR = getConf("hot_push_hours", "string", "");
const ATTACH_LINK = getConf("hot_attach_link", "bool", true);

// 调试打印解析后的关键配置
console.log(`🔵 [配置解析]: 
- 关键词: ${KEYWORDS.length > 0 ? KEYWORDS : "无"}
- 推送时间: ${PUSH_HOURS_STR || "全天"}
- 附带链接: ${ATTACH_LINK}`);

const CFG = {
    weibo:    { name: "微博热搜", url: "https://v2.xxapi.cn/api/weibohot", enable: getConf("hot_weibo_enable", "bool", true), split: getConf("hot_weibo_split", "bool", true), ignore: getConf("hot_weibo_ignore", "bool", true), count: getConf("hot_weibo_count", "int", 3) },
    baidu:    { name: "百度热搜", url: "https://v2.xxapi.cn/api/baiduhot", enable: getConf("hot_baidu_enable", "bool", true), split: getConf("hot_baidu_split", "bool", true), ignore: getConf("hot_baidu_ignore", "bool", true), count: getConf("hot_baidu_count", "int", 3) },
    douyin:   { name: "抖音热榜", url: "https://v2.xxapi.cn/api/douyinhot", enable: getConf("hot_douyin_enable", "bool", true), split: getConf("hot_douyin_split", "bool", true), ignore: getConf("hot_douyin_ignore", "bool", true), count: getConf("hot_douyin_count", "int", 3) },
    zhihu:    { name: "知乎热榜", url: "https://api.pearktrue.cn/api/dailyhot/?title=知乎", enable: getConf("hot_zhihu_enable", "bool", false), split: getConf("hot_zhihu_split", "bool", false), ignore: getConf("hot_zhihu_ignore", "bool", false), count: getConf("hot_zhihu_count", "int", 3) },
    bilibili: { name: "B站热门",  url: "https://api.pearktrue.cn/api/dailyhot/?title=哔哩哔哩", enable: getConf("hot_bilibili_enable", "bool", false), split: getConf("hot_bilibili_split", "bool", false), ignore: getConf("hot_bilibili_ignore", "bool", false), count: getConf("hot_bilibili_count", "int", 3) },
    kr36:     { name: "36氪热榜", url: "https://v2.xxapi.cn/api/hot36kr", enable: getConf("hot_36kr_enable", "bool", false), split: getConf("hot_36kr_split", "bool", false), ignore: getConf("hot_36kr_ignore", "bool", false), count: getConf("hot_36kr_count", "int", 3) },
    toutiao:  { name: "头条热榜", url: "https://api.pearktrue.cn/api/dailyhot/?title=今日头条", enable: getConf("hot_toutiao_enable", "bool", false), split: getConf("hot_toutiao_split", "bool", false), ignore: getConf("hot_toutiao_ignore", "bool", false), count: getConf("hot_toutiao_count", "int", 3) },
    xhs:      { name: "小红书",   url: "https://api.pearktrue.cn/api/dailyhot/?title=小红书", enable: getConf("hot_xhs_enable", "bool", false), split: getConf("hot_xhs_split", "bool", false), ignore: getConf("hot_xhs_ignore", "bool", false), count: getConf("hot_xhs_count", "int", 3) },
    kuaishou: { name: "快手热榜", enable: getConf("hot_kuaishou_enable", "bool", false), split: getConf("hot_kuaishou_split", "bool", false), ignore: getConf("hot_kuaishou_ignore", "bool", false), count: getConf("hot_kuaishou_count", "int", 3) }
};

// ============================================
// 3. 工具函数
// ============================================

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
        $httpClient.get({ url: url, headers: UA, timeout: 5000 }, (err, resp, body) => {
            if (err) return reject(err);
            try {
                const json = JSON.parse(body);
                resolve(json);
            } catch (e) {
                reject("JSON解析失败");
            }
        });
    });
}

function checkTime() {
    if (!PUSH_HOURS_STR) return true;
    const h = new Date().getHours();
    const allowed = PUSH_HOURS_STR.split(/[,，]/).map(n => parseInt(n)).filter(n => !isNaN(n));
    if (allowed.includes(h)) return true;
    console.log(`[时间限制] 当前 ${h} 点不在推送列表中 ${JSON.stringify(allowed)}`);
    return false;
}

// 统一的数据筛选逻辑
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

    // 2. 逻辑补救：如果没有命中关键词
    if (filtered.length === 0) {
        // 如果用户开启了“无词推新” OR 用户根本没设置关键词
        // 强制逻辑：没设置关键词 = 全部是关键词
        if (cfg.ignore || KEYWORDS.length === 0) {
            filtered = items;
        } else {
            console.log(`⛔ ${cfg.name}: 无关键词匹配且未开启推新，跳过`);
            return null;
        }
    }

    // 3. 截取数量
    return filtered.slice(0, cfg.count);
}

function getTitle(item) {
    if (typeof item === "string") return item;
    return item.title || item.word || item.keyword || item.name || item.hot_word || "";
}

function getUrl(item, name) {
    // 简单粗暴的 URL 匹配，保留你之前的逻辑
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

// ============================================
// 4. 抓取逻辑
// ============================================

async function fetchCommon(key) {
    const cfg = CFG[key];
    if (!cfg.enable) return;

    try {
        console.log(`🚀 开始抓取: ${cfg.name}`);
        const json = await httpGet(cfg.url);
        
        // 适配不同的数据结构
        let list = [];
        if (Array.isArray(json.data)) list = json.data;
        else if (json.data && Array.isArray(json.data.list)) list = json.data.list;
        else if (Array.isArray(json)) list = json; // 部分接口直接返回数组

        const finalItems = processItems(list, cfg);
        
        if (finalItems && finalItems.length > 0) {
            if (cfg.split) {
                // 单条推送
                finalItems.forEach((item, idx) => {
                    const title = `${cfg.name} Top${idx+1}`;
                    const body = getTitle(item);
                    const url = getUrl(item, cfg.name);
                    notify(title, body, ATTACH_LINK ? url : "");
                });
            } else {
                // 合并推送
                const title = `${cfg.name} Top${finalItems.length}`;
                const body = finalItems.map((i, idx) => `${idx+1}. ${getTitle(i)}`).join("\n");
                notify(title, body, "");
            }
        }
    } catch (e) {
        console.log(`❌ ${cfg.name} 失败: ${e}`);
        // 失败也发个通知（调试用，稳定后可注释）
        // notify(`${cfg.name} 获取失败`, String(e)); 
    }
}

// 快手单独处理 (因为是双保险)
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
                return; // 成功就退出
            }
        } catch (e) {}
    }
    console.log(`❌ 快手所有接口均失败`);
}

// ============================================
// 5. 执行入口
// ============================================

!(async () => {
    if (!checkTime()) {
        $done();
        return;
    }

    // 并发执行所有启用的任务
    await Promise.all([
        fetchCommon("weibo"),
        fetchCommon("baidu"),
        fetchCommon("douyin"),
        fetchCommon("zhihu"),
        fetchCommon("bilibili"),
        fetchCommon("kr36"),
        fetchCommon("toutiao"),
        fetchCommon("xhs"),
        fetchKuaishou()
    ]);
    
    console.log("🏁 脚本执行完毕");
    $done();
})();
