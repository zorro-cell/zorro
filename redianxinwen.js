function fetchWeibo(callback) {
    const url = "https://api.vvhan.com/api/hotlist/all";
    const headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)"
    };
    $httpClient.get({ url, headers }, (err, resp, data) => {
        if (err || !data) {
            return callback(["微博热搜请求失败"]);
        }
        try {
            const json = JSON.parse(data);
            const wb = json?.data?.weibo?.slice(0, 5) || [];
            const weibo = wb.map((item, i) => `${i + 1}. 微博：${item.title}`);
            callback(weibo);
        } catch (e) {
            callback([`微博热搜解析失败：${e.message}`]);
        }
    });
}

function fetchDouyin(callback) {
    const url = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";
    const headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)"
    };
    $httpClient.get({ url, headers }, (err, resp, data) => {
        if (err || !data) {
            return callback(["抖音热榜请求失败"]);
        }
        try {
            const json = JSON.parse(data);
            const dy = json?.data?.slice(0, 5) || [];
            const douyin = dy.map((item, i) => `${i + 6}. 抖音：${item.title}`);
            callback(douyin);
        } catch (e) {
            callback([`抖音热榜解析失败：${e.message}`]);
        }
    });
}

function main() {
    fetchWeibo((wbList) => {
        fetchDouyin((dyList) => {
            const all = wbList.concat(dyList);
            const msg = all.join("\n");
            const hasError = all.some(x => x.includes("失败"));
            if (hasError) {
                $notifica
