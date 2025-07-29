/*
 * redianxinwen.js   — 微博 + 抖音各 5 条
 * Cron 固定整点 0 * * * * ，脚本内部比对 hour 是否在用户设置
 */

const UA = {"User-Agent":"Mozilla/5.0 …"};
const WB_API = "https://api.vvhan.com/api/hotlist/wbHot";
const DY_API = "https://api.istero.com/resource/v1/douyin/top?token=…";

let arg = typeof $argument === "string" ? $argument.trim() : "";
if (arg.startsWith("time=")) arg = arg.slice(5);
arg = arg.replace(/，/g, ",");
const hours = arg ? arg.split(",").map(h=>parseInt(h,10)).filter(h=>!isNaN(h)&&h>=0&&h<24)
                  : [8,12,20];
const now = new Date().getHours();
if (!hours.includes(now)) {
  console.log(`⏰ 当前 ${now} 点，不在推送时段 [${hours}]`);
  $done();
  return;
}

Promise.all([fetchWB(),fetchDY()]).then(([wb,dy])=>{
  $notification.post("📰 微博热搜 Top5","",wb, {"open-url":"about:blank"});
  $notification.post("🎵 抖音热榜 Top5","",dy, {"open-url":"about:blank"});
  $done();
}).catch(e=>{
  $notification.post("热榜脚本异常","",String(e), {"open-url":"about:blank"});
  $done();
});

function fetchWB() { … }
function fetchDY() { … }

