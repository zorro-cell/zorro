// redianxinwen.js — 微博 + 抖音热榜通知，点击跳转对应App热榜页

const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" };
const WB_API = "https://api.vvhan.com/api/hotlist/wbHot";
const DY_API = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";

// 时间过滤逻辑
const arg = (typeof $argument === "object" && $argument.time) ? $argument.time : "8,12,20";
const hours = arg.replace(/，/g, ",").split(",")
  .map(h => parseInt(h.trim(), 10)).filter(h => !isNaN(h) && h >= 0 && h < 24);
const nowH = new Date().getHours();

if (!hours.includes(nowH)) {
  console.log(`⏰ 当前 ${nowH} 点，不在推送时段 [${hours.join(",")}]`);
  $done();
  return;
}

// 主流程
Promise.all([getWB(), getDY()]).then(([wb, dy]) => {
  // 微博热榜通知 - 尝试网页跳转方式（兼容性更好）
  const wbAttach = {
    // 以下链接请逐个测试，找到可用的一个
    "openUrl": "sinaweibo://browser?url=https%3A%2F%2Fm.weibo.cn%2Fhotsearch%2Fhome"
    // 备选1: "openUrl": "weibo://https://m.weibo.cn/hotsearch"
    // 备选2: "openUrl": "sinaweibo://webview?url=https://s.weibo.com/top/summary"
    // 备选3: "openUrl": "weibo://page/100808543233cdf5c8925105a0d34a914"
    // 备选4: "openUrl": "sinaweibo://deeplink?id=hotsearch"
  };
  $notification.post("📰 微博热搜 Top5", "", wb, wbAttach);
  
  // 抖音热榜通知 - 已确认可跳转
  const dyAttach = {
    "openUrl": "snssdk1128://search/trending"
  };
  $notification.post("🎵 抖音热榜 Top5", "", dy, dyAttach);
  
  $done();
}).catch(e => {
  const errorAttach = {
    "openUrl": ""
  };
  $notification.post("热榜脚本异常", "", String(e), errorAttach);
  $done();
});

// 获取微博Top5
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

// 获取抖音Top5
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

