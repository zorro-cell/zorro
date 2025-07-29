function fetchHot(callback) {
    const url = "https://api.vvhan.com/api/hotlist/all";
    const headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)"
    };
    console.log("🔍 开始获取微博 + 抖音热榜...");
    $httpClient.get({ url, headers }, (err, resp, data) => {
        if (err || !data) {
            console.log("❌ 请求失败:", err);
            return callback(["🔥 热榜获取失败：网络错误"]);
        }
        try {
            const json = JSON.parse(data);
            const wb = json?.data?.weibo?.slice(0, 5) || [];
            const dy = json?.data?.douyin?.slice(0, 5) || [];

            if (wb.length === 0 && dy.length === 0) {
                return callback(["🔥 接口数据为空：可能被限流"]);
            }

            const weibo = wb.map((item, i) => `${i + 1}. 微博：${item.title}`);
            const douyin = dy.map((item, i) => `${i + 6}. 抖音：${item.title}`);
            callback([...weibo, ...douyin]);
        } catch (e) {
            callback([`🔥 JSON 解析失败：${e.message}`]);
        }
    });
}

function main() {
    fetchHot((list) => {
        const msg = list.join("\n");
        if (list.length === 0 || list[0].includes("失败") || list[0].includes("为空")) {
            $notification.post("📉 热榜拉取失败", "可能是接口被限流或数据结构变更", list[0]);
        } else {
            $notification.post("📈 每日热榜简讯", "微博 + 抖音 Top10", msg);
        }
        $done({ body: JSON.stringify({ list }) });
    });
}
main();
