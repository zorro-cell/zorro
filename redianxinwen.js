/*
 *  微博 + 抖音各 5 条，分两条通知；推送小时由 argument=time=8,12,20 控制
 *  Cron 固定 0 * * * *  → 整点执行，脚本内部判断是否发送
 */

const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" };
const WB_API = "https://api.vvhan.com/api/hotlist/wbHot";
const DY_API = "https://api.istero.com/resource/v1/douyin/top?token=RQofNsxcAgWNEhPEigHNQHRfYOBvoIjX";

// ---------- 读取并解析推送时间 ----------
const argStr = typeof $argument === "string" ? $argument : "";         // Loon 把 argument= 后的内容放进 $argument
const hourStr = argStr.match(/time=([^&]+)/)?.[1] || "8,12,20";        // 取 time= 后面的子串，默认 8,12,20
const hours = hourStr.split(",")
                     .map(h=>parseInt(h.trim(),10))
                     .filter(h=>!Number.isNaN(h) && h>=0 && h<=23);    // 过滤非法值
const nowH  = new Date().getHours();

if (!hours.includes(nowH)) {
  console.log(`⏰ ${nowH} 点不在推送时间 ${hours}`);
  $done();
  return;
}

// ---------- 主流程 ----------
Promise.all([getWB(), getDY()]).then(([wb, dy]) => {
  $notification.post("📰 微博热搜 Top5", "", wb, { "open-url":"about:blank" });
  $notification.post("🎶 抖音热榜 Top5", "", dy, { "open-url":"about:blank" });
  $done();
}).catch(e=>{
  $notification.post("热榜脚本异常", "", String(e), { "open-url":"about:blank" });
  $done();
});

// ---------- 请求函数 ----------
function getWB(){return new Promise(r=>{
  $httpClient.get({url:WB_API,headers:UA},(e,_,d)=>{
    if(e||!d) return r("微博接口请求失败");
    try{
      const list=JSON.parse(d).data.slice(0,5).map((x,i)=>`${i+1}. ${x.title}`);
      r(list.join("\n")||"微博列表为空");
    }catch{r("微博数据解析失败");}
  });
});}
function getDY(){return new Promise(r=>{
  $httpClient.get({url:DY_API,headers:UA},(e,_,d)=>{
    if(e||!d) return r("抖音接口请求失败");
    try{
      const list=JSON.parse(d).data.slice(0,5).map((x,i)=>`${i+1}. ${x.title||x.name}`);
      r(list.join("\n")||"抖音列表为空");
    }catch{r("抖音数据解析失败");}
  });
});}

  });
});}
function getDY() { return new Promise(res=>{
  $httpClient.get({ url: DY_API, headers: UA }, (e,_,d)=>{
    if(e||!d) return res("抖音接口请求失败");
    try{ const l=JSON.parse(d).data.slice(0,5).map((x,i)=>`${i+1}. ${x.title||x.name}`);res(l.join("\n")); }
    catch{ res("抖音解析失败"); }
  });
});}
