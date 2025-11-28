/*******************************
 微博 + 抖音热榜推送（Quantumult X）
*******************************/

/* ===== 通用 UA ===== */
const UA = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
};

/* ===== 接口地址 ===== */
const WB_API = "https://api.lbbb.cc/api/weibors";             // 微博热搜（文本）
const DY_API = "https://v2.xxapi.cn/api/douyinhot";           // 抖音热榜（JSON，无需 token）

/* ===== 时间过滤（可选）===== */
/*
  在 task_local 里可以这样写参数：
  argument=time=8,12,20
  表示每天 8 点 / 12 点 / 20 点才推送
*/
const defaultHours =
  "0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23";

let argHours = defaultHours;
if (typeof $argument === "string" && $argument.includes("time=")) {
  argHours = $argument.split("time=")[1] || defaultHours;
}
const hours = argHours
  .replace(/，/g, ",")
  .split(",")
  .map((h) => parseInt(h.trim(), 10))
  .filter((h) => !isNaN(h) && h >= 0 && h < 24);

const nowH = new Date().getHours();
if (!hours.includes(nowH)) {
  console.log(`⏰ 当前 ${nowH} 点，不在推送时段 [${hours.join(",")}]，退出脚本`);
  $done();
  // 记得 return
  return;
}

/* ===== 主流程 ===== */
!(async () => {
  try {
    const [wb, dy] = await Promise.all([getWB(), getDY()]);

    // 微博通知
    $notify("微博热搜 Top5", "", wb, {
      "open-url":
        "sinaweibo://pageinfo?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot",
    });

    // 抖音通知
    $notify("抖音热榜 Top5", "", dy, {
      "open-url": "snssdk1128://search/trending",
    });
  } catch (e) {
    $notify("热榜脚本异常", "", String(e));
  } finally {
    $done();
  }
})();

/* ===== 子函数 ===== */

// 微博 Top5（去掉“热度：xxx”，一行显示）
async function getWB() {
  const resp = await $task.fetch({ url: WB_API, headers: UA });
  const data = resp.body;
  if (!data) return "微博接口请求失败";

  // 文本按行拆开
  const lines = data
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter((l) => l);

  // 只要形如 “1、xxx” / “1. xxx” 这种行
  const hotLines = lines.filter((l) => /^\d+[、,.]/.test(l));
  if (hotLines.length === 0) return "未找到微博热搜数据";

  const list = hotLines.slice(0, 5).map((l, i) => {
    // 去掉前面的“1、”“1.”
    let title = l.replace(/^\d+[、,.]\s*/, "");
    // 去掉两种括号包着的【/〖热度：xxx】/〗
    title = title.replace(/[〖【]热度：.*?[〗】]/g, "").trim();

    // 一行格式：1. 标题
    return `${i + 1}. ${title}`;
  });

  return list.join("\n") || "微博列表为空";
}

// 抖音 Top5（新接口）
async function getDY() {
  const resp = await $task.fetch({ url: DY_API, headers: UA });
  const body = resp.body || "";
  if (!body) return "抖音接口请求失败";

  try {
    const json = typeof body === "string" ? JSON.parse(body) : body;

    // 接口规范：code = 200 且 data 为数组
    if (json.code !== 200 || !Array.isArray(json.data)) {
      const msg = json.msg || json.message || "未知错误";
      return `抖音接口异常：${msg}`;
    }

    const list = json.data.slice(0, 5).map((x, i) => {
      // xxapi 字段一般是 word，这里多兜底几个字段
      const title = x.word || x.title || x.name || "无标题";
      return `${i + 1}. ${title}`;
    });

    return list.join("\n") || "抖音列表为空";
  } catch (e) {
    return `抖音数据解析失败：${e.message || e}`;
  }
}
