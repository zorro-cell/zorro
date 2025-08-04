const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1" };
const WB_API = "https://api.lbbb.cc/api/weibors";
const DY_API = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";

// 时间过滤（默认全天候推送）
const arg = "0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23";
const hours = arg.split(",").map(h => parseInt(h.trim(), 10)).filter(h => !isNaN(h) && h >= 0 && h < 24);
const nowH = new Date().getHours();
if (!hours.includes(nowH)) {
  console.log(`⏰ 当前 ${nowH} 点，不在推送时段 [${hours.join(",")}]`);
  $done();
  return;
}

// 主流程
Promise.all([getWB(), getDY()]).then(([wb, dy]) => {
  // 微博热榜
  $notification.post("📰 微博热搜 Top5", "", wb, {
    "openUrl": "sinaweibo://weibo.com/p/106003type=25%26t=3%26disable_hot=1%26filter_type=realtimehot"
  });
  
  // 抖音热榜
  $notification.post("🎵 抖音热榜 Top5", "", dy, {
    "openUrl": "snssdk1128://search/trending"
  });
  
  $done();
}).catch(e => {
  $notification.post("热榜脚本异常", "", String(e), { "openUrl": "" });
  $done();
});

// 获取微博Top5（修改为文本解析逻辑）
function getWB() {
  return new Promise(res => {
    $httpClient.get({ url: WB_API, headers: UA }, (err, _, data) => {
      if (err || !data) return res("微博接口请求失败");
      
      try {
        // 直接处理文本格式（不再解析为JSON）
        // 1. 按行分割内容
        const lines = data.split(/[\n\r]+/).filter(line => line.trim() !== "");
        
        // 2. 过滤掉标题行（如"------微博-热搜榜----一•"）
        const hotLines = lines.filter(line => {
          const trimmed = line.trim();
          // 匹配以数字开头的行（如"1、武大回应图书馆事件..."）
          return /^\d+[、,.]/.test(trimmed);
        });
        
        // 3. 提取Top5并格式化
        if (hotLines.length === 0) {
          return res("未找到微博热榜数据");
        }
        
        const list = hotLines.slice(0, 5).map((line, i) => {
          // 移除行首的数字和符号（如"1、"）
          const title = line.replace(/^\d+[、,.]\s*/, "").trim();
          // 移除热度信息（如"【热度：752.7万】"）
          return `${i + 1}. ${title.replace(/【热度：.*?】/, "").trim()}`;
        });
        
        res(list.join("\n") || "微博列表为空");
      } catch (e) {
        res(`微博数据处理失败：${e.message}\n原始数据预览：${data.slice(0, 100)}`);
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
        const list = JSON.parse(data).data.slice(0, 5).map((x, i) => `${i + 1}. ${x.title || x.name}`);
        res(list.join("\n") || "抖音列表为空");
      } catch (e) {
        res(`抖音数据解析失败：${e.message}`);
      }
    });
  });
}
