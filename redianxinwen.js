// ---------- 主流程 ----------
const arg = typeof $argument === "object" && $argument.time ? String($argument.time) : "8,12,20";
const hours = arg.split(",").map(h => parseInt(h.trim(), 10)).filter(h => !isNaN(h) && h>=0 && h<24);
const nowH = new Date().getHours();
if (!hours.includes(nowH)) {
  console.log(`⏰ 当前 ${nowH} 点，不在推送时段 [${hours.join(",")}]`);
  $done(); return;
}

// 推送通知，不响应点击
Promise.all([fetchWB(), fetchDY()]).then(([wb, dy]) => {
  $notification.post("📰 微博热搜 Top5", "", wb, { "open-url": "" });
  $notification.post("📱 抖音热搜 Top5", "", dy, { "open-url": "" });
  $done();
}).catch(e => {
  $notification.post("热榜脚本异常", "", String(e), { "open-url": "" });
  $done();
});
