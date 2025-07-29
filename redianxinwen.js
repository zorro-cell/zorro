// ==Plugin==
// @PluginName       微博抖音热榜Top10
// @Author           心事全在脸上
// @Cron             0 8,12,20 * * *
// @TimeOut          15
// ==/Plugin==

function fetchWeibo(cb) {
  const url = "https://api.vvhan.com/api/hotlist/weibo";
  $httpClient.get(url, (err, resp, data) => {
    if (err) return cb(["❌ 微博请求失败"]);
    try {
      const json = JSON.parse(data);
      const list = json.data.slice(0, 5).map((item, i) => `${i + 1}. 微博：${item.title}`);
      cb(list);
    } catch (e) {
      cb(["❌ 微博解析失败"]);
    }
  });
}

function fetchDouyin(cb) {
  const url = "https://api.vvhan.com/api/hotlist/douyin";
  $httpClient.get(url, (err, resp, data) => {
    if (err) return cb(["❌ 抖音请求失败"]);
    try {
      const json = JSON.parse(data);
      const list = json.data.slice(0, 5).map((item, i) => `${i + 6}. 抖音：${item.title}`);
      cb(list);
    } catch (e) {
      cb(["❌ 抖音解析失败"]);
    }
  });
}

function main() {
  console.log("📥 开始获取 微博 + 抖音 热榜...");
  fetchWeibo((wb) => {
    fetchDouyin((dy) => {
      const all = [...wb, ...dy];
      const valid = all.filter(i => !i.includes("失败"));
      if (valid.length === 0) {
        $notification.post("📉 热榜获取失败", "", "微博与抖音均无法访问");
      } else {
        const msg = valid.join("\n");
        $notification.post("📌 每日热榜简讯", "微博 + 抖音 Top10", msg);
      }
      $done();
    });
  });
}

main();

