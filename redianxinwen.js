// 微博+抖音热榜通知（最新接口版）
const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1" };
// 替换为新的微博热榜接口
const WB_API = "https://api.lbbb.cc/api/weibors";
const DY_API = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";

// 时间过滤（默认8,12,20点推送）
const arg = (typeof $argument === "object" && $argument.time) ? $argument.time : "8,12,20";
const hours = arg.replace(/，/g, ",").split(",").map(h => parseInt(h.trim(), 10)).filter(h => !isNaN(h) && h >= 0 && h < 24);
const nowH = new Date().getHours();
if (!hours.includes(nowH)) {
  console.log(`⏰ 当前 ${nowH} 点，不在推送时段 [${hours.join(",")}]`);
  $done();
  return;
}

// 主流程
Promise.all([getWB(), getDY()]).then(([wb, dy]) => {
  // 微博热榜跳转链接（iOS编码优化版）
  $notification.post("📰 微博热搜 Top5", "", wb, {
    "openUrl": "sinaweibo://weibo.com/p/106003type=25%26t=3%26disable_hot=1%26filter_type=realtimehot"
  });
  
  // 抖音热榜（已正常工作）
  $notification.post("🎵 抖音热榜 Top5", "", dy, {
    "openUrl": "snssdk1128://search/trending"
  });
  
  $done();
}).catch(e => {
  $notification.post("热榜脚本异常", "", String(e), { "openUrl": "" });
  $done();
});

// 获取微博Top5（适配新接口）
function getWB() {
  return new Promise(res => {
    $httpClient.get({ url: WB_API, headers: UA }, (err, _, data) => {
      if (err || !data) return res("微博接口请求失败");
      try {
        const result = JSON.parse(data);
        
        // 通用解析逻辑：自动适配常见的热榜数据结构
        // 尝试从不同可能的字段中获取热榜列表
        const hotList = result.list || result.data || result.hotList || [];
        
        if (!Array.isArray(hotList) || hotList.length === 0) {
          return res("微博接口无有效数据");
        }
        
        // 提取Top5热榜，兼容不同的标题字段名
        const list = hotList.slice(0, 5).map((item, i) => {
          const title = item.title || item.name || item.content || "未知标题";
          return `${i + 1}. ${title}`;
        });
        
        res(list.join("\n") || "微博列表为空");
      } catch (e) {
        res(`微博数据解析失败：${e.message}`);
      }
    });
  });
}

// 获取抖音Top5（保持不变）
function getDY() {
  return new Promise(res => {
    $httpClient.get({ url: DY_API, headers: UA }, (err, _, data) => {
      if (err || !data) return res("抖音接口请求失败");
      try {
        const list = JSON.parse(data).data.slice(0, 5).map((x, i) => `${i + 1}. ${x.title || x.name}`);
        res(list.join("\n") || "抖音列表为空");
      } catch {
        res("抖音数据解析失败");
      }
    });
  });
}
