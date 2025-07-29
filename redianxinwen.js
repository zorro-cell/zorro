$httpClient.get("https://news-api.kikiapi.top/hot10", (err, resp, data) => {
  if (err) {
    $notification.post("热榜获取失败", "", err.toString());
    return $done();
  }
  try {
    const json = JSON.parse(data);
    const msg = (json.list || []).join("\n") || "无数据";
    $notification.post("📌 每日热榜简讯", "微博 + 抖音 Top10", msg);
    $done();
  } catch (e) {
    $notification.post("解析失败", "", e.message);
    $done();
  }
});


