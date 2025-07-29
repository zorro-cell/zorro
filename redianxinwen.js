/*
 * hot_separate_arg.js
 * 微博 + 抖音各 5 条；推送小时由 argument=time=8,12,20 控制
 * Cron 固定整点运行 0 * * * *
 */

const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" };
const WB_API = "https://api.vvhan.com/api/hotlist/wbHot";
const DY_API = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";

/* ---------- 读取推送时间 ---------- */
let arg = typeof $argument === "string" ? $argument.trim() : "";
if (arg.startsWith("time=")) arg = arg.slice(5);
arg = arg.replace(/，/g, ",");                     // 全角逗号→半角
const hours = arg ? arg.split(",")
                   .map(h => parseInt(h.trim(), 10))
                   .filter(h => !Number.isNaN(h) && h >= 0 && h < 24)
                 : [8, 12, 20];
const nowH = new Date().getHours();
if (!hours.includes(nowH)) {
  console.log(`⏰  当前 ${nowH} 点，不在推送时段 [${hours}]`);
  $done();
  return;
}

/* ---------- 主流程 ---------- */
Promise.all([fetchWB(), fetchDY()]).then(([wb, dy]) => {
  $notification.post("📰 微博热搜 Top5", "", wb, { "open-url": "about:blank" });
  $notification.post("🎶 抖音热榜 Top5", "", dy, { "open-url": "about:blank" });
  $done();
}).catch(err => {
  $notification.post("热榜脚本异常", "", String(err), { "open-url": "about:blank" });
  $done();
});

/* ---------- 请求函数 ---------- */
function fetchWB() {
  return new Promise(res => {
    $httpClient.get({ url: WB_API, headers: UA }, (e, _, d) => {
      if (e || !d) return res("微博接口请求失败");
      try {
        const list = JSON.parse(d).data.slice(0, 5)
                     .map((x, i) => `${i + 1}. ${x.title}`);
        res(list.join("\n") || "微博列表为空");
      } catch { res("微博数据解析失败"); }
    });
  });
}

function fetchDY() {
  return new Promise(res => {
    $httpClient.get({ url: DY_API, headers: UA }, (e, _, d) => {
      if (e || !d) return res("抖音接口请求失败");
      try {
        const list = JSON.parse(d).data.slice(0, 5)
                     .map((x, i) => `${i + 1}. ${x.title || x.name}`);
        res(list.join("\n") || "抖音列表为空");
      } catch { res("抖音数据解析失败"); }
    });
  });
}
