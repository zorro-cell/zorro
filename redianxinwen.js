/*
 * redianxinwen.js — 微博 + 抖音各 5 条热榜，只发送通知，不跳转
 */

const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" };
const WB_API = "https://api.vvhan.com/api/hotlist/wbHot";
const DY_API = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";

// 读取 argument 参数中的 time 参数配置
const arg = (typeof $argument === "object" && $argument.time) ? $argument.time : "8,12,20";
const hours = arg.replace(/，/g, ",").split(",")
  .map(h => parseInt(h, 10)).filter(h => !isNaN(h) && h >= 0 && h < 24);
const nowH = new Date().getHours();
if (!hours.includes(nowH)) {
  console.log(`⏰ 当前 ${nowH} 点，不在推送时段 [${hours}]`);
  $done(); return;
}

Promise.all([getWB(), getDY()]).then(([wb, dy]) => {
  $notification.post("📰 微博热搜 Top5", "", wb);
  $notification.post("🎶 抖音热榜 Top5", "", dy);
  $done();
}).catch(err => {
  $notification.post("热榜脚本异常", "", String(err));
  $done();
});

function getWB(){
  return new Promise(res => {
    $httpClient.get({ url: WB_API, headers: UA }, (err, _, data) => {
      if (err || !data) return res("微博接口请求失败");
      try {
        const list = JSON.parse(data).data.slice(0, 5)
                      .map((item, i) => `${i + 1}. ${item.title}`);
        res(list.join("\n") || "微博列表为空");
      } catch {
        res("微博数据解析失败");
      }
    });
  });
}

function getDY(){
  return new Promise(res => {
    $httpClient.get({ url: DY_API, headers: UA }, (err, _, data) => {
      if (err || !data) return res("抖音接口请求失败");
      try {
        const list = JSON.parse(data).data.slice(0, 5)
                      .map((item, i) => `${i + 1}. ${item.title || item.name}`);
        res(list.join("\n") || "抖音列表为空");
      } catch {
        res("抖音数据解析失败");
      }
    });
  });
}
