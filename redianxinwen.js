/*  hot_separate.js
 *  微博 + 抖音热榜各 5 条，分开两条通知
 *  Cron：0 8,12,20 * * *  （每天 8/12/20 点推送）
 */

const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" };
const WB_API = "https://api.vvhan.com/api/hotlist/wbHot";
const DY_API = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";

Promise.all([getWB(), getDY()]).then(([wbMsg, dyMsg]) => {
  // 分别推送
  $notification.post("📰 微博热搜 Top5", "", wbMsg);
  $notification.post("🎵 抖音热榜 Top5", "", dyMsg);
  $done();
}).catch(err => {
  $notification.post("热榜脚本异常", "", String(err));
  $done();
});

/* ---------- 请求函数 ---------- */
function getWB() {
  return new Promise(res => {
    $httpClient.get({ url: WB_API, headers: UA }, (e, r, d) => {
      if (e || !d) return res("微博接口请求失败");
      try {
        const arr = JSON.parse(d).data.slice(0, 5);
        const msg = arr.map((x, i) => `${i + 1}. ${x.title}`).join("\n");
        res(msg || "微博列表为空");
      } catch (err) {
        res("微博数据解析失败");
      }
    });
  });
}

function getDY() {
  return new Promise(res => {
    $httpClient.get({ url: DY_API, headers: UA }, (e, r, d) => {
      if (e || !d) return res("抖音接口请求失败");
      try {
        const arr = JSON.parse(d).data.slice(0, 5);
        const msg = arr.map((x, i) => `${i + 1}. ${x.title || x.name}`).join("\n");
        res(msg || "抖音列表为空");
      } catch (err) {
        res("抖音数据解析失败");
      }
    });
  });
}
