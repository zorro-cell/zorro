// hot_separate_arg.js
const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS)" };
const WB_API = "https://api.vvhan.com/api/hotlist/wbHot";
const DY_API = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";

// 读取 argument 格式
let arg = typeof $argument === "string" ? $argument.trim() : "";
arg = arg.replace(/^time=/,"").replace(/，/g,",");
const hours = arg.split(",").map(h=>parseInt(h,10)).filter(h=>!isNaN(h)&&h>=0&&h<24);
if (hours.length === 0) hours.push(8,12,20);
const nowH = new Date().getHours();
console.log(`已设推送小时: [${hours}]; 当前小时: ${nowH}`);
if (!hours.includes(nowH)) {
  console.log(`⏰ 当前 ${nowH} 点，不在推送时段 [${hours}]`);
  $done(); return;
}

Promise.all([fetchWB(), fetchDY()]).then(([wb, dy]) => {
  $notification.post("📰 微博热搜 Top5", "", wb, { "open-url": "about:blank" });
  $notification.post("📱 抖音热榜 Top5", "", dy, { "open-url": "about:blank" });
  $done();
}).catch(e=>{
  $notification.post("热榜脚本异常", "", String(e), { "open-url": "about:blank" });
  $done();
});

function fetchWB(){ return new Promise(r=>{
  $httpClient.get({url:WB_API,headers:UA},(e,_,d)=>{
    if(e||!d) return r("微博请求失败");
    try{ const list=JSON.parse(d).data.slice(0,5).map((x,i)=>`${i+1}. ${x.title}`); r(list.join("\n")||"微博无数据") }
    catch{ r("微博解析异常") }
  });
});}
function fetchDY(){ return new Promise(r=>{
  $httpClient.get({url:DY_API,headers:UA},(e,_,d)=>{
    if(e||!d) return r("抖音请求失败");
    try{ const list=JSON.parse(d).data.slice(0,5).map((x,i)=>`${i+1}. ${x.title||x.name}`); r(list.join("\n")||"抖音无数据") }
    catch{ r("抖音解析异常") }
  });
});}
