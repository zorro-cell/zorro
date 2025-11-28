/******************************* 微博 + 抖音热榜推送（Quantumult X）
 作者：@zorro-cell 2025-08-05
*******************************/

/* ===== 常量 ===== */
const UA = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
};

const WB_API = "https://api.lbbb.cc/api/weibors";
// ✅ 已改：使用新的抖音热榜接口（无需 token）
const DY_API = "https://v2.xxapi.cn/api/douyinhot";

/* ===== 时间过滤 ===== */
const defaultHours =
  "0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23";
/* Quantumult X 取参说明：
   task_local 里写 …,argument=time=8,12,20 之类；这里只解析 time=… */
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
  console.log(`⏰ 当前 ${nowH} 点，不在推送时段 [${hours.join(",")}]`);
  $done();
  return;
}

/* ===== 主流程 ===== */
!(async () => {
  try {
    const [wb, dy] = await Promise.all([getWB(), getDY()]);

    // 微博
    $notify(" 微博热搜 Top5", "", wb, {
      "open-url":
        "sinaweibo://weibo.com/p/106003type=25%26t=3%26disable_hot=1%26filter_type=realtimehot",
    });

    // 抖音
    $notify(" 抖音热榜 Top5", "", dy, {
      "open-url": "snssdk1128://search/trending",
    });
  } catch (e) {
    $notify("热榜脚本异常", "", String(e));
  } finally {
    $done();
  }
})();

/* ===== 子函数 ===== */

// 微博 Top5（返回字符串）
async function getWB() {
  const resp = await $task.fetch({ url: WB_API, headers: UA });
  const data = resp.body;
  if (!data) return "微博接口请求失败";

  // 文本解析
  const lines = data
    .split(/[\n\r]+/)
    .filter((l) => l.trim() !== "");

  const hotLines = lines.filter((l) => /^\d+[、,.]/.test(l.trim()));
  if (hotLines.length === 0) return "未找到微博热榜数据";

  const list = hotLines.slice(0, 5).map((l, i) => {
    const title = l
      .replace(/^\d+[、,.]\s*/, "")
      .replace(/〖热度：.*?〗/, "")
      .trim();
    return `${i + 1}.\n${title}`;
  });

  return list.join("\n") || "微博列表为空";
}

// 抖音 Top5（返回字符串）—— 已改成新接口并增加容错
async function getDY() {
  const resp = await $task.fetch({ url: DY_API, headers: UA });
  const body = resp.body || "";
  if (!body) return "抖音接口请求失败";

  try {
    const json = typeof body === "string" ? JSON.parse(body) : body;

    // 判断接口是否正常返回数据
    if (json.code !== 200 || !Array.isArray(json.data)) {
      const msg = json.msg || json.message || "未知错误";
      return `抖音接口异常：${msg}`;
    }

    // 取前 5 条
    const list = json.data.slice(0, 5).map((x, i) => {
      // xxapi 的字段是 word，其它字段做兜底
      const title = x.word || x.title || x.name || "无标题";
      return `${i + 1}. ${title}`;
    });

    return list.join("\n") || "抖音列表为空";
  } catch (e) {
    return `抖音数据解析失败：${e.message || e}`;
  }
}
