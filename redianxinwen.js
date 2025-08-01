// 微博+抖音热榜通知（新接口适配版）
const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1" };
// 替换为新的微博热榜接口
const WB_API = "https://www.hhlqilongzhu.cn/api/rs_juhe.php?type=weibo";
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
  // 微博热榜跳转链接（保持之前的配置）
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

// 获取微博Top5（适配新接口的解析逻辑）
function getWB() {
  return new Promise(res => {
    $httpClient.get({ url: WB_API, headers: UA }, (err, _, data) => {
      if (err || !data) return res("微博接口请求失败");
      try {
        // 解析新接口返回的数据（假设结构，实际以接口返回为准）
        const result = JSON.parse(data);
        
        // 根据新接口调整：这里假设接口返回格式为 { "list": [{ "title": "热搜内容" }, ...] }
        // 若实际格式不同，只需修改此处的字段名即可
        if (!result.list || !Array.isArray(result.list)) {
          return res("微博接口返回格式异常");
        }
        
        // 提取Top5热榜
        const list = result.list.slice(0, 5).map((item, i) => {
          // 确保获取到标题字段（根据接口实际字段名调整，可能是title/name等）
          const title = item.title || item.name || "未知标题";
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
