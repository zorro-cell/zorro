/*
 * redianxinwen.js  — 微博 + 抖音各 5 条
 * Cron 0 * * * *  整点执行；只在 $argument.time 指定的小时推送
 */

const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" };
const WB_API = "https://api.vvhan.com/api/hotlist/wbHot";
const DY_API = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";

/* ---------- 读取用户设定 ---------- */
let timeStr = (typeof $argument === "object" && $argument.time) ? $argument.time : "8,12,20";
timeStr = timeStr.replace(/，/g, ",");                       // 全角逗号→半角
const hours = timeStr.split(",")
                     .map(h => parseInt(h.trim(), 10))
                     .filter(h => !Number.isNaN(h) && h >= 0 && h < 24);
console.log("推送时段 →", hours.join(","));

const nowH = new Date().getHours();
if (!hours.includes(nowH)) {
  console.log(`⏰ 当前 ${nowH} 点，不在推送时段`);
  $done();
  return;
}

/* ---------- 主流程 ---------- */
Promise.all([getWB(), getDY()]).then(([wb, dy]) => {
  $notification.post("📰 微博热搜 Top5", "", wb, { "open-url": "about:blank" });
  $notification.post("🎶 抖音热榜 Top5", "", dy, { "open-url": "about:blank" });
  $done();
}).catch(err => {
  $notification.post("热榜脚本异常", "", String(err), { "open-url": "about:blank" });
  $done();
});

/* ---------- 抓微博 ---------- */
function getWB() {
  return new Promise(res => {
    $httpClient.get({ url: WB_API, headers: UA }, (e, _, d) => {
      if (e || !d) return res("微博接口请求失败");
      try {
        const list = JSON.parse(d).data.slice(0, 5).map((x, i) => `${i + 1}. ${x.title}`);
        res(list.join("\n") || "微博列表为空");
      } catch { res("微博数据解析失败"); }
    });
  });
}

/* ---------- 抓抖音 ---------- */
function getDY() {
  return new Promise(res => {
    $httpClient.get({ url: DY_API, headers: UA }, (e, _, d) => {
      if (e || !d) return res("抖音接口请求失败");
      try {
        const list = JSON.parse(d).data.slice(0, 5).map((x, i) => `${i + 1}. ${x.title || x.name}`);
        res(list.join("\n") || "抖音列表为空");
      } catch { res("抖音数据解析失败"); }
    });
  });
}
