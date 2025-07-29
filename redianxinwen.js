// redianxinwen.js — 微博 + 抖音各5条热榜，点击通知跳 App 热榜页

// 推送时间由 UI 参数控制（默认 8,12,20）

const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" };

const WB_API = "https://api.vvhan.com/api/hotlist/wbHot";
const DY_API = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";

// 读取用户设置小时参数
const arg = (typeof $argument === "object" && $argument.time) ? $argument.time : "8,12,20";
const hours = arg.replace(/，/g, ",").split(",")
  .map(h => parseInt(h.trim(), 10)).filter(h => !isNaN(h) && h >= 0 && h < 24);
const nowH = new Date().getHours();

if (!hours.includes(nowH)) {
  console.log(`⏰ 当前 ${nowH} 点，不在推送时段 [${hours.join(",")}]`);
  $done();
  return;
}

// 主流程：微博 + 抖音通知，并跳转 App
Promise.all([getWB(), getDY()]).then(([wb, dy]) => {
  // 微博热榜 - 使用Loon特定的跳转参数
  $notification.post("📰 微博热搜 Top5", "", wb, {
    "url": "sinaweibo://hotsearch",  // Loon中使用"url"参数而非"open-url"
    "open-with-app": true            // 强制使用应用打开
  });
  
  // 抖音热榜 - 使用Loon特定的跳转参数
  $notification.post("🎵 抖音热榜 Top5", "", dy, {
    "url": "snssdk1128://hotsearch",
    "open-with-app": true
  });
  
  $done();
}).catch(e => {
  $notification.post("热榜脚本异常", "", String(e), {
    "url": ""
  });
  $done();
});

// 获取微博 Top5
function getWB() {
  return new Promise(res => {
    $httpClient.get({ url: WB_API, headers: UA }, (err, _, data) => {
      if (err || !data) return res("微博接口请求失败");
      try {
        const list = JSON.parse(data).data.slice(0, 5)
          .map((x, i) => `${i + 1}. ${x.title}`);
        res(list.join("\n") || "微博列表为空");
      } catch {
        res("微博数据解析失败");
      }
    });
  });
}

// 获取抖音 Top5
function getDY() {
  return new Promise(res => {
    $httpClient.get({ url: DY_API, headers: UA }, (err, _, data) => {
      if (err || !data) return res("抖音接口请求失败");
      try {
        const list = JSON.parse(data).data.slice(0, 5)
          .map((x, i) => `${i + 1}. ${x.title || x.name}`);
        res(list.join("\n") || "抖音列表为空");
      } catch {
        res("抖音数据解析失败");
      }
    });
  });
}
