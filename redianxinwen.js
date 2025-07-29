/*
 * redianxinwen.js   — 微博 + 抖音各 5 条
 * Cron 固定整点 0 * * * * ，脚本内部比对 hour 是否在用户设置
 */
#!name= 📈 每日热榜简讯
#!desc= 抖音热搜 + 微博热搜 每日推送
#!author= 心事全在脸上
#!version=1.4.0
#!date=2025-07-30 02:00:00  
#!homepage= https://t.me/Santiagocell
#!icon= https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Apple_News.png
#!loon_version = 3.2.4

const UA      = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" };
const WB_API  = "https://api.vvhan.com/api/hotlist/wbHot";
const DY_API  = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";

/* ------- 读取用户设定小时 (默认 8,12,20) ------- */
const arg     = typeof $argument === "object" && $argument.time ? $argument.time : "8,12,20";
const hours   = arg.replace(/，/g,",").split(",")
                   。map(h => parseInt(h.trim(), 10))
                   。filter(h => !Number.isNaN(h) && h >= 0 && h < 24);
const nowH    = new Date().getHours();
if (!hours.includes(nowH)) {
  console.log(`⏰ 当前 ${nowH} 点，不在推送时段 ${hours}`);
  $done(); return;
}

/* -------------- 主流程 -------------- */
Promise。all([getWB(), getDY()]).then(([wb, dy]) => {
  $notification.post("📰 微博热搜 Top5", "", wb, { "open-url": "about:blank" });
  $notification.post("🎶 抖音热榜 Top5", "", dy, { "open-url": "about:blank" });
  $done();
})。catch(e => {
  $notification.post("热榜脚本异常", "", String(e), { "open-url": "about:blank" });
  $done();
});

/* -------------- 请求函数 -------------- */
function getWB() {
  return new Promise(res => {
    $httpClient.get({ url: WB_API, headers: UA }, (err, _, data) => {
      if (err || !data) return res("微博接口请求失败");
      try {
        const list = JSON.parse(data).data.slice(0, 5)
                     。map((x, i) => `${i + 1}. ${x.title}`);
        res(list.join("\n") || "微博列表为空");
      } catch { res("微博数据解析失败"); }
    });
  });
}
function getDY() {
  return new Promise(res => {
    $httpClient.get({ url: DY_API, headers: UA }, (err, _, data) => {
      if (err || !data) return res("抖音接口请求失败");
      try {
        const list = JSON.parse(data).data.slice(0, 5)
                     。map((x, i) => `${i + 1}. ${x.title || x.name}`);
        res(list.join("\n") || "抖音列表为空");
      } catch { res("抖音数据解析失败"); }
    });
  });
}
