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
  $notification.post("📰 微博热搜 Top5", "", wb, {
    // 微博跳转设置：
    // 请根据你的设备和微博版本，选择一个可以正常跳转的 Scheme。
    // 尝试顺序建议：1 -> 2
    
    // 1. 尝试跳转微博首页（你原来的设置，通常有效）
    "open-url": "sinaweibo://gotohome" 
    
    // 2. 更通用的微博 App Scheme，可能跳转到App主页
    // "open-url": "weibo://" 
  });

  $notification.post("🎵 抖音热榜 Top5", "", dy, {
    // 抖音跳转设置：
    // 请根据你的设备和抖音版本，选择一个可以正常跳转的 Scheme。
    // 尝试顺序建议：1 -> 2 -> 3
    
    // 1. 尝试跳转抖音热榜（你原来的设置，可能不兼容新版本）
    "open-url": "snssdk1128://search/trending" 
    
    // 2. 尝试跳转抖音热点/推荐页
    // "open-url": "snssdk1128://hotsoon/feed" 
    
    // 3. 最通用的抖音 App Scheme，通常跳转到App主页
    // "open-url": "snssdk1128://" 
  });
  $done();
}).catch(e => {
  $notification.post("热榜脚本异常", "", String(e), {
    "open-url": "" // 异常情况不跳转
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
