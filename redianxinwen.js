/*  hot_separate_arg.js
 *  根据 argument=time=8,12,20 推送
 *  建议 Cron “0 * * * *” 每小时检查一次
 */

const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" };
const WB_API = "https://api.vvhan.com/api/hotlist/wbHot";
const DY_API = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";

const arg = typeof $argument === "string" ? $argument : "";     // Loon 会把 argument= 后面的内容放到 $argument
const hours = (arg.match(/time=([0-9,]+)/)?.[1] || "8,12,20")
               .split(",").map(x => parseInt(x.trim(), 10));
const nowHour = new Date().getHours();

if (!hours.includes(nowHour)) {          // 如果当前小时不在设定列表 → 直接结束
  console.log(`当前 ${nowHour} 点不在推送时间 ${hours}`);
  $done();
  return;
}

Promise.all([getWB(), getDY()]).then(([wbMsg, dyMsg]) => {
  $notification.post("📰 微博热搜 Top5", "", wbMsg, { "open-url": "about:blank" });
  $notification.post("🎵 抖音热榜 Top5", "", dyMsg, { "open-url": "about:blank" });
  $done();
}).catch(e => {
  $notification.post("热榜脚本异常", "", String(e), { "open-url": "about:blank" });
  $done();
});

/* --- 请求函数 --- */
function getWB() {
  return new Promise(res => {
    $httpClient.get({ url: WB_API, headers: UA }, (e, _, d) => {
      if (e || !d) return res("微博接口请求失败");
      try {
        const list = JSON.parse(d).data.slice(0, 5).map((x,i)=>`${i+1}. ${x.title}`);
        res(list.join("\n") || "微博列表为空");
      } catch { res("微博解析失败"); }
    });
  });
}
function getDY() {
  return new Promise(res => {
    $httpClient.get({ url: DY_API, headers: UA }, (e, _, d) => {
      if (e || !d) return res("抖音接口请求失败");
      try {
        const list = JSON.parse(d).data.slice(0, 5).map((x,i)=>`${i+1}. ${x.title||x.name}`);
        res(list.join("\n") || "抖音列表为空");
      } catch { res("抖音解析失败"); }
    });
  });
}

        res("抖音数据解析失败");
      }
    });
  });
}
