/*  hot_separate_arg.js
 *  微博 + 抖音热榜各 5 条；推送小时由 argument=time=8,12,20 决定
 *  Cron 固定 0 * * * *   (整点运行，内部判断是否在设定小时)
 */
const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" };
const WB_API = "https://api.vvhan.com/api/hotlist/wbHot";
const DY_API = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";

const argStr = typeof $argument === "string" ? $argument : "";
const hours  = (argStr.match(/time=([^&]+)/)?.[1] || "8,12,20")
               .split(",").map(h => parseInt(h, 10));
const nowH   = new Date().getHours();

if (!hours.includes(nowH)) { console.log(`⏰ ${nowH} 点不在推送时间 ${hours}`); $done(); return; }

Promise.all([getWB(), getDY()]).then(([wb, dy]) => {
  $notification.post("📰 微博热搜 Top5", "", wb, { "open-url": "about:blank" });
  $notification.post("🎵 抖音热榜 Top5", "", dy, { "open-url": "about:blank" });
  $done();
}).catch(e => {
  $notification.post("热榜脚本异常", "", String(e), { "open-url": "about:blank" });
  $done();
});

function getWB() { return new Promise(res=>{
  $httpClient.get({ url: WB_API, headers: UA }, (e,_,d)=>{
    if(e||!d) return res("微博接口请求失败");
    try{ const l=JSON.parse(d).data.slice(0,5).map((x,i)=>`${i+1}. ${x.title}`);res(l.join("\n")); }
    catch{ res("微博解析失败"); }
  });
});}
function getDY() { return new Promise(res=>{
  $httpClient.get({ url: DY_API, headers: UA }, (e,_,d)=>{
    if(e||!d) return res("抖音接口请求失败");
    try{ const l=JSON.parse(d).data.slice(0,5).map((x,i)=>`${i+1}. ${x.title||x.name}`);res(l.join("\n")); }
    catch{ res("抖音解析失败"); }
  });
});}
