// 微博+抖音热榜通知（修复版）
const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1" };
// 确保使用的接口域名在MITM中已配置
const WB_API = "https://api.lbbb.cc/api/weibors";  // 对应MITM中的api.lbbb.cc
const DY_API = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";  // 对应MITM中的api.istero.com

// 时间过滤逻辑（保持不变）
const arg = (typeof $argument === "object" && $argument.time) ? $argument.time : "8,12,20";
const hours = arg.replace(/，/g, ",").split(",").map(h => parseInt(h.trim(), 10)).filter(h => !isNaN(h) && h >= 0 && h < 24);
const nowH = new Date().getHours();
if (!hours.includes(nowH)) {
  console.log(`⏰ 当前 ${nowH} 点，不在推送时段 [${hours.join(",")}]`);
  $done();
  return;
}

// 主流程（保持不变，使用之前修复的解析逻辑）
Promise.all([getWB(), getDY()]).then(([wb, dy]) => {
  $notification.post("📰 微博热搜 Top5", "", wb, {
    "openUrl": "sinaweibo://weibo.com/p/106003type=25%26t=3%26disable_hot=1%26filter_type=realtimehot"
  });
  
  $notification.post("🎵 抖音热榜 Top5", "", dy, {
    "openUrl": "snssdk1128://search/trending"
  });
  
  $done();
}).catch(e => {
  $notification.post("热榜脚本异常", "", String(e), { "openUrl": "" });
  $done();
});

// 获取微博Top5（使用之前的容错解析逻辑）
function getWB() {
  return new Promise(res => {
    $httpClient.get({ url: WB_API, headers: UA }, (err, _, data) => {
      if (err || !data) return res("微博接口请求失败");
      
      try {
        // 数据清洗（关键修复）
        let cleanData = data
          .replace(/:\s*(\d+\.\d*|\.\d+|\d+)([^\d\.]|$)/g, ":$1$2")
          .replace(/([^\\])"/g, '$1"')
          .replace(/,\s*([\]}])/g, ' $1');
        
        const result = JSON.parse(cleanData);
        const hotList = result.list || result.data || result.hot || [];
        
        if (!Array.isArray(hotList) || hotList.length === 0) {
          return res("微博接口无有效数据");
        }
        
        const list = hotList.slice(0, 5).map((item, i) => {
          const title = item.title || item.name || "未知标题";
          return `${i + 1}. ${title}`;
        });
        
        res(list.join("\n"));
      } catch (e) {
        res(`微博解析失败：${e.message}\n数据预览：${data.slice(0, 50)}`);
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
        res(list.join("\n"));
      } catch (e) {
        res(`抖音解析失败：${e.message}`);
      }
    });
  });
}
