/*
 * redianxinwen.js   — 微博 + 抖音各 5 条
 * Cron 固定整点 0 * * * * ，脚本内部比对 hour 是否在用户设置
 */

const UA      = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" };
const WB_API  = "https://api.vvhan.com/api/hotlist/wbHot";
const DY_API  = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";

/* ------- 读取用户设定小时 (默认 8,12,20) ------- */
const arg     = typeof $argument === "object" && $argument.time ? $argument.time : "8,12,20";
const hours   = arg.replace(/，/g,",").split(",")
                   .map(h => parseInt(h.trim(), 10))
                   .filter(h => !Number.isNaN(h) && h >= 0 && h < 24);
const nowH    = new Date().getHours();
if (!hours.includes(nowH)) {
  console.log(⏰ 当前 ${nowH} 点，不在推送时段 ${hours});
  $done(); return;
}

// ---------- 主流程 ----------
const arg = typeof $argument === "object" && $argument.time ? String($argument.time) : "8,12,20";
const hours = arg.split(",").map(h => parseInt(h.trim(), 10)).filter(h => !isNaN(h) && h>=0 && h<24);
const nowH = new Date().getHours();
if (!hours.includes(nowH)) {
  console.log(`⏰ 当前 ${nowH} 点，不在推送时段 [${hours.join(",")}]`);
  $done(); return;
}

// 推送通知，不响应点击
Promise。all([fetchWB(), fetchDY()]).then(([wb, dy]) => {
  $notification.post("📰 微博热搜 Top5", "", wb, { "open-url": "" });
  $notification.post("📱 抖音热搜 Top5", "", dy, { "open-url": "" });
  $done();
})。catch(e => {
  $notification.post("热榜脚本异常", "", String(e), { "open-url": "" });
  $done();
});
