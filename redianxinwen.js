// redianxinwen.js — 微博 + 抖音热榜通知（Loon 专用修复版）

const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" };
const WB_API = "https://api.vvhan.com/api/hotlist/wbHot";
const DY_API = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";

// 1. 时间过滤（保持原有逻辑）
const arg = (typeof $argument === "object" && $argument.time) ? $argument.time : "8,12,20";
const hours = arg.replace(/，/g, ",").split(",").map(h => parseInt(h.trim(), 10)).filter(h => !isNaN(h) && h >= 0 && h < 24);
const nowH = new Date().getHours();
if (!hours.includes(nowH)) {
  console.log(`⏰ 当前 ${nowH} 点，不在推送时段 [${hours.join(",")}]`);
  $done();
  return;
}

// 2. 主流程：严格按 Loon 通知格式传参
Promise.all([getWB(), getDY()]).then(([wb, dy]) => {
  // 微博通知：使用标准 URL Scheme
  $notification.post(
    "📰 微博热搜 Top5",  // 标题
    "",                 // 副标题
    wb,                 // 通知内容
    { url: "sinaweibo://hotsearch" }  // 跳转链接（关键：仅传 url，避免多余参数）
  );

  // 抖音通知：优先测试官方 Scheme
  $notification.post(
    "🎵 抖音热榜 Top5", 
    "", 
    dy, 
    { url: "douyin://hotsearch" }  // 若失效，替换为 snssdk1128://hotsearch
  );

  $done();
}).catch(e => {
  $notification.post("热榜脚本异常", "", String(e), { url: "" });
  $done();
});

// 3. 数据获取函数（保持原有逻辑，增加错误提示）
function getWB() {
  return new Promise(res => {
    $httpClient.get({ url: WB_API, headers: UA }, (err, _, data) => {
      if (err) return res(`微博接口错误：${err.message}`);
      if (!data) return res("微博接口无返回数据");
      try {
        const list = JSON.parse(data).data.slice(0, 5).map((x, i) => `${i + 1}. ${x.title}`);
        res(list.join("\n") || "微博热榜为空");
      } catch (e) {
        res(`微博数据解析失败：${e.message}`);
      }
    });
  });
}

function getDY() {
  return new Promise(res => {
    $httpClient.get({ url: DY_API, headers: UA }, (err, _, data) => {
      if (err) return res(`抖音接口错误：${err.message}`);
      if (!data) return res("抖音接口无返回数据");
      try {
        const list = JSON.parse(data).data.slice(0, 5).map((x, i) => `${i + 1}. ${x.title || x.name}`);
        res(list.join("\n") || "抖音热榜为空");
      } catch (e) {
        res(`抖音数据解析失败：${e.message}`);
      }
    });
  });
}
