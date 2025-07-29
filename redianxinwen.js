function fetchHot(callback) {
    const url = "https://api.vvhan.com/api/hotlist/all";
    const headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)"
    };
    console.log("🔍 开始获取微博 + 抖音热榜...");
    $httpClient.get({ url, headers }, (err, resp, data) => {
        if (err || !data) {
            console.log("❌ 热榜请求失败:", err);
            return callback(["热榜请求失败：网络错误"]);
        }
        try {
            const json = JSON.parse(data);
            const wbList = json?.data?.weibo?.slice(0, 5) || [];
            const dyList = json?.data?.douyin?.slice(0, 5) || [];

            const weibo = wbList.map((item, i) => `${i + 1}. 微博热搜：${item.title}`);
            const douyin = dyList.map((item, i) => `${i + 6}. 抖音热榜：${item.title}`);
            console.log("✅ 微博 + 抖音获取成功");
            callback([...weibo, ...douyin]);
        } catch (e) {
            console.log("❌ 热榜解析失败:", e.message);
            callback([`热榜解析失败：${e.message}`]);
        }
    });
}

function main() {
    fetchHot((list) => {
        const msg = list.join("\n");
        console.log("📢 简讯内容：\n" + msg);
        $notification.post("📈 每日热榜简讯", "微博 + 抖音 Top10", msg);
        $done({ body: JSON.stringify({ list }) });
    });
}

main();