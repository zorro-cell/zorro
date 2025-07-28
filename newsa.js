function fetchWeibo(callback) {
    const url = "https://cn.apihz.cn/api/xinwen/weibo2.php?id=10006610&key=14d297a15663ed621d18216a677d1c17";
    const headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)"
    };
    console.log("🔍 开始获取微博热搜...");
    $httpClient.get({ url, headers }, (err, resp, data) => {
        if (err) {
            console.log("❌ 微博请求错误:", err);
            callback(["微博热搜获取失败：网络错误"]);
            return;
        }
        try {
            const json = JSON.parse(data);
            if (json.code !== 200 || !json.data || !Array.isArray(json.data)) {
                console.log("❌ 微博API返回错误:", json.msg || "未知错误");
                callback([`微博热搜获取失败：${json.msg || "API返回错误"}`]);
                return;
            }
            const hotItems = json.data.slice(0, 5);
            const result = hotItems.map((item, index) =>
                `${index + 1}. 微博热搜：${item.title} (${item.hot})`
            );
            console.log("✅ 微博热搜获取成功，共", result.length, "条");
            callback(result);
        } catch (e) {
            console.log("❌ 微博数据解析失败:", e.message);
            callback([`微博热搜解析失败：${e.message}`]);
        }
    });
}

function fetchBing(callback) {
    const url = "https://www.bing.com/news/search?q=world+news&form=nsba";
    const headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)",
        "Accept": "application/rss+xml, application/xml"
    };
    console.log("🔍 开始获取国际新闻...");
    $httpClient.get({ url, headers }, (err, resp, data) => {
        if (err) {
            console.log("❌ Bing请求错误:", err);
            callback(["国际新闻获取失败：网络错误"]);
            return;
        }
        try {
            const titleRegex = /<title>([^<]+)<\/title>/g;
            const matches = data.match(titleRegex);
            if (!matches || matches.length < 2) {
                callback(["国际新闻解析失败：未找到标题"]);
                return;
            }
            const newsTitles = matches.slice(1, 6).map(title =>
                title.replace(/<\/?title>/g, "").trim()
            );
            const result = newsTitles.map((title, index) =>
                `${index + 6}. 国际新闻：${title}`
            );
            console.log("✅ 国际新闻获取成功，共", result.length, "条");
            callback(result);
        } catch (e) {
            console.log("❌ 国际新闻解析失败:", e.message);
            callback([`国际新闻解析失败：${e.message}`]);
        }
    });
}

function main() {
    let retryCount = 0;
    const maxRetries = 2;
    function execute() {
        fetchWeibo((wbList) => {
            fetchBing((bnList) => {
                const allItems = [...wbList, ...bnList];
                const validItems = allItems.filter(item => !item.includes("失败"));
                const lines = validItems.slice(0, 10);
                if (lines.length === 0 && retryCount < maxRetries) {
                    retryCount++;
                    console.log(`⚠️ 所有新闻源获取失败，正在进行第${retryCount}次重试...`);
                    setTimeout(execute, 3000);
                    return;
                }
                if (lines.length === 0) {
                    console.log("❌ 所有新闻源获取失败");
                    $notification.post("📰 每日简讯", "获取失败", "无法获取任何新闻内容，请检查网络");
                    $done({ body: JSON.stringify({ error: "所有新闻源获取失败", list: [] }) });
                    return;
                }
                const msg = lines.join("\n");
                console.log("✅ 最终简讯：\n" + msg);
                $notification.post("📰 每日简讯", "微博热搜 + 国际头条", msg);
                $done({ body: JSON.stringify({ list: lines }) });
            });
        });
    }
    execute();
}
main();
