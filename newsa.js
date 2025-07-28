// == 配置常量 ==
const CONFIG = {
    WEIBO_API: "https://v2.xxapi.cn/api/weibohot",
    BING_API: "https://www.bing.com/news/search?q=world+news&nv%20aug=%5Bnews%20vertical+category%3D%22rt_world%22%5D&form=nsba",
    USER_AGENT: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    MAX_RETRIES: 1,          // 每轮最多重试1次（因高频执行）
    TIMEOUT: 5000,           // 5秒超时
    WEIBO_LIMIT: 5,          // 微博热搜数量
    BING_LIMIT: 5            // 国际新闻数量
};

// == 工具函数 ==
function log(message) {
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

function showNotification(title, subtitle, body) {
    $notification.post(title, subtitle, body);
}

// == 微博热搜获取函数 ==
function fetchWeibo(callback) {
    const startTime = Date.now();
    log("开始获取微博热搜...");

    const timeoutId = setTimeout(() => {
        log("微博请求超时");
        callback(["微博热搜获取失败：请求超时"]);
    }, CONFIG.TIMEOUT);

    $httpClient.get({
        url: CONFIG.WEIBO_API,
        headers: {
            "User-Agent": CONFIG.USER_AGENT,
            "Accept": "application/json"
        }
    }, (err, resp, data) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        log(`微博请求耗时: ${duration}ms`);

        if (err) {
            log(`微博请求错误: ${JSON.stringify(err)}`);
            callback(["微博热搜获取失败：网络错误"]);
            return;
        }

        try {
            const json = JSON.parse(data);
            
            if (!json || json.code !== 200 || !json.data || !Array.isArray(json.data)) {
                log(`微博API返回异常: ${JSON.stringify(json)}`);
                callback([`微博热搜获取失败：API返回异常`]);
                return;
            }

            const hotItems = json.data.slice(0, CONFIG.WEIBO_LIMIT);
            const result = hotItems.map((item, index) => 
                `${index + 1}. 微博热搜：${item.title} (${item.hot || '未知热度'})`
            );
            
            log(`微博热搜获取成功，共${result.length}条`);
            callback(result);
        } catch (e) {
            log(`微博数据解析失败: ${e.message}`);
            callback([`微博热搜解析失败：${e.message}`]);
        }
    });
}

// == 国际新闻获取函数 ==
function fetchBing(callback) {
    const startTime = Date.now();
    log("开始获取国际新闻...");

    const timeoutId = setTimeout(() => {
        log("Bing请求超时");
        callback(["国际新闻获取失败：请求超时"]);
    }, CONFIG.TIMEOUT);

    $httpClient.get({
        url: CONFIG.BING_API,
        headers: {
            "User-Agent": CONFIG.USER_AGENT,
            "Accept": "application/rss+xml, application/xml"
        }
    }, (err, resp, data) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        log(`Bing请求耗时: ${duration}ms`);

        if (err) {
            log(`Bing请求错误: ${JSON.stringify(err)}`);
            callback(["国际新闻获取失败：网络错误"]);
            return;
        }

        try {
            // 增强型标题提取正则
            const titleRegex = /<title[^>]*>([\s\S]*?)<\/title>/gi;
            const matches = [];
            let match;
            
            while ((match = titleRegex.exec(data)) !== null) {
                const title = match[1].replace(/\s+/g, ' ').trim();
                if (title && title.length > 5) { // 过滤过短标题
                    matches.push(title);
                }
            }
            
            if (!matches || matches.length < 2) {
                log("未找到足够的标题匹配项");
                callback(["国际新闻解析失败：未找到标题"]);
                return;
            }

            // 提取新闻标题（跳过第一条Bing自身标题）
            const newsTitles = matches.slice(1, CONFIG.BING_LIMIT + 1);
            const result = newsTitles.map((title, index) => 
                `${index + CONFIG.WEIBO_LIMIT + 1}. 国际新闻：${title}`
            );
            
            log(`国际新闻获取成功，共${result.length}条`);
            callback(result);
        } catch (e) {
            log(`国际新闻解析失败: ${e.message}`);
            callback([`国际新闻解析失败：${e.message}`]);
        }
    });
}

// == 主执行流程 ==
function main() {
    const executionId = Date.now().toString().slice(-6); // 生成短执行ID用于日志追踪
    log(`===== 开始执行新闻获取任务 [ID: ${executionId}] =====`);

    let retryCount = 0;
    
    function execute() {
        fetchWeibo((wbList) => {
            fetchBing((bnList) => {
                const allItems = [...wbList, ...bnList];
                const validItems = allItems.filter(item => !item.includes("失败"));
                const lines = validItems.slice(0, CONFIG.WEIBO_LIMIT + CONFIG.BING_LIMIT);

                // 记录结果统计
                log(`结果统计: 总条目=${allItems.length}, 有效条目=${validItems.length}`);
                
                if (lines.length === 0 && retryCount < CONFIG.MAX_RETRIES) {
                    retryCount++;
                    log(`所有新闻源获取失败，正在进行第${retryCount}次重试...`);
                    setTimeout(execute, 2000); // 2秒后重试
                    return;
                }

                if (lines.length === 0) {
                    log("❌ 所有新闻源获取失败");
                    showNotification("📰 新闻获取失败", "无法获取内容", "请检查网络连接或API可用性");
                    $done({ 
                        status: "error", 
                        message: "所有新闻源获取失败",
                        executionId: executionId
                    });
                    return;
                }

                // 构建通知内容
                const msg = lines.join("\n");
                const successMsg = `成功获取${lines.length}条新闻 (微博${wbList.length}, 国际${bnList.length})`;
                
                log("✅ 任务执行成功:\n" + msg);
                showNotification("📰 新闻更新", successMsg, msg.substring(0, 100) + "...");
                
                $done({ 
                    status: "success", 
                    count: lines.length,
                    executionId: executionId,
                    list: lines
                });
            });
        });
    }

    // 开始执行
    execute();
}

// 启动主流程
main();
