/*
🥳脚本功能: 自动加入 TestFlight
🎯重写脚本:
[rewrite_local]
^https:\/\/testflight\.apple\.com\/v3\/accounts\/.*\/ru\/([^\/]+)(?!\/accept)$ url script-request-header https://raw.githubusercontent.com/MCdasheng/QuantumultX/main/Scripts/myScripts/TF_appIds.js
[mitm]
hostname = testflight.apple.com
⏰定时任务:
[task_local]
30 10,20 * * * https://raw.githubusercontent.com/MCdasheng/QuantumultX/main/Scripts/myScripts/TestFlight.js, tag=TestFlight自动加入, img-url=https://raw.githubusercontent.com/Orz-3/mini/master/Color/testflight.png, enabled=true
📦BoxJs地址:
https://raw.githubusercontent.com/MCdasheng/QuantumultX/main/mcdasheng.boxjs.json
@params:
    "tf_appIds": appId,使用逗号隔开填入,或者使用重写自动获取
    "tf_account_key": 账户id,重写获取
    "tf_session_id"
    "tf_request_id"
    "tf_session_digest"
@tips:
  无法打开tf商店请禁用 mitm
*/

const $ = new Env("TestFlight");

// 关键修改1: 增加account_key有效性检查
const account_key = $.getdata("tf_account_key");
if (!account_key || account_key.trim() === "") {
  $.msg("TestFlight错误", "⚠️未获取到账户信息", "请确保重写规则正确并打开MITM后访问一次TestFlight");
  $.done();
}

let ids = $.getdata("tf_appIds");
if (!ids || ids.trim() === "") {
  $.msg("TestFlight错误", "⚠️未设置appId列表", "请在BoxJs中填写tf_appIds");
  $.done();
}

$.setdata(ids, "tf_appIds_2"); // 备用

let new_ids = "";

// 关键修改2: 补充完整请求头（模拟浏览器请求，避免被服务器拒绝）
let tf_headers = {
  "X-Session-Id": $.getdata("tf_session_id") || "",
  "X-Request-Id": $.getdata("tf_request_id") || "",
  "X-Session-Digest": $.getdata("tf_session_digest") || "",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  "Accept": "application/json, text/plain, */*", // 明确要求JSON响应
  "Accept-Language": "zh-CN,zh;q=0.9",
  "Connection": "keep-alive"
};

// 处理appId列表格式
if (ids.split(",").length === 1) {
  ids = [ids];
  $.log("🤖当前appId列表");
  $.log(ids);
} else {
  ids = ids.split(",").map(element => element.replace(/\/accept$/, "").trim()); // 去除空白字符
  $.log("🤖当前appId列表");
  $.log(ids);
}

(async () => {
  let promises = [];
  for (let i = 0; i < ids.length; i++) {
    // 跳过空id（避免无效请求）
    if (!ids[i] || ids[i].trim() === "") continue;
    const promise = autoPost(ids[i]);
    promises.push(promise);
    // 关键修改3: 增加请求间隔，避免触发频率限制
    await $.wait(1000);
  }
  await Promise.all(promises);
})()
  .catch((e) => {
    $.logErr(e);
    new_ids = $.getdata("tf_appIds"); // 出现异常时保留原列表
  })
  .finally(() => {
    new_ids = new_ids.replace(/^,+/g, "").replace(/,,+/g, ",").trim(); // 清理多余逗号
    $.setdata(new_ids, "tf_appIds");
    $.log("🎉appId列表更新完成!");
    $.log($.getdata("tf_appIds") || "空列表");
    $.done();
  });

async function autoPost(id) {
  const url = `https://testflight.apple.com/v3/accounts/${account_key}/ru/${id}`;
  let options = { url, headers: tf_headers };

  return $.http.get(options).then((resp) => {
    try {
      // 关键修改4: 先检查状态码，非200直接处理错误
      if (resp.statusCode !== 200) {
        $.log(`❌请求失败 [${resp.statusCode}]`, `链接: ${url}`);
        new_ids += `,${id}`; // 保留失败的id以便重试
        return;
      }

      // 关键修改5: 检查响应是否为JSON格式
      let obj;
      try {
        obj = JSON.parse(resp.body);
      } catch (parseErr) {
        $.log(`❌响应不是JSON [${id}]`, `内容: ${resp.body.substring(0, 100)}...`);
        new_ids += `,${id}`;
        return;
      }

      if (obj.data === null) {
        new_ids += `,${id}`;
        $.log(`🔴${id}: 不再接受新测试人员`);
      } else if (obj.data.status === "FULL") {
        new_ids += `,${id}`;
        $.log(`🟡${id}: 人数已满`);
      } else if (obj.data.status === "OPEN") {
        return tf_join(id); // 状态正常则尝试加入
      } else {
        $.log(`🔴${id}: 未知状态`, JSON.stringify(obj.data.status));
        new_ids += `,${id}`;
      }
    } catch (error) {
      $.log("----------------------------------");
      $.log(`❌处理错误 [${id}]: ${error}`);
      $.log(`🔗链接: ${url}`);
      $.log(`🤔请求头: ${JSON。stringify(options。headers)}`);
      $.log(`🟡状态码:${resp。statusCode}`);
      $。log(`响应内容: ${resp。body.substring(0, 200)}...`); // 只显示部分内容避免冗余
      $。log("----------------------------------");
      new_ids += `,${id}`; // 出错时保留id
    }
  }).catch((err) => {
    // 关键修改6: 捕获网络请求失败（如超时、连接错误）
    $.log(`❌网络错误 [${id}]: ${err。message}`);
    new_ids += `,${id}`;
  });
}

function tf_join(id) {
  const url = `https://testflight.apple.com/v3/accounts/${account_key}/ru/${id}/accept`;
  let options = { url, headers: tf_headers };

  return $.http.post(options).then((resp) => {
    try {
      if (resp。statusCode === 200) {
        const obj = JSON.parse(resp.body);
        const name = obj。data?.name || "未知应用";
        $。log(`🎉${id}: ${name} 加入成功!`);
        $.msg("TestFlight成功"， `应用: ${name}`， `ID: ${id}`);
      } else {
        new_ids += `,${id}`;
        $.log(`🔴${id}: 加入失败 [${resp。statusCode}]`, resp.body.substring(0, 100));
        $.msg("加入失败", `ID: ${id}`, `状态码: ${resp.statusCode}`);
      }
    } catch (error) {
      $.log(`❌加入处理错误 [${id}]: ${error}`);
      new_ids += `,${id}`;
    }
  })。catch((err) => {
    $。log(`❌加入网络错误 [${id}]: ${err。message}`);
    new_ids += `,${id}`;
  });
}

// Env类保持不变（省略重复代码，使用原脚本的Env定义）
function Env(t， s) {
  // 此处省略原脚本中的Env类实现（保持不变即可）
  class e {
    constructor(t) {
      this.env = t;
    }
    send(t， s = "GET") {
      t = "string" == typeof t ? { url: t } : t;
      let e = this.get;
      return (
        "POST" === s && (e = this.post),
        new Promise((s， i) => {
          e。call(this， t， (t， e, r) => {
            t ? i(t) : s(e);
          });
        })
      );
    }
    get(t) {
      return this.send。call(this.env, t);
    }
    post(t) {
      return this.send.call(this.env, t, "POST");
    }
  }
  return new (class {
    constructor(t， s) {
      (this.name = t),
        (this.http = new e(this)),
        (this.data = null),
        (this.dataFile = "box.dat"),
        (this.logs = []),
        (this.isMute = !1),
        (this.isNeedRewrite = !1),
        (this.logSeparator = "\n"),
        (this.encoding = "utf-8"),
        (this。startTime = new Date().getTime()),
        Object。assign(this, s),
        this.log("", `\ud83d\udd14${this.name}, \u5f00\u59cb!`);
    }
    isNode() {
      return "undefined" != typeof module && !!module。exports;
    }
    isQuanX() {
      return "undefined" != typeof $task;
    }
    isSurge() {
      return (
        "undefined" != typeof $environment && $environment["surge-version"]
      );
    }
    isLoon() {
      return "undefined" != typeof $loon;
    }
    isShadowrocket() {
      return "undefined" != typeof $rocket;
    }
    isStash() {
      return (
        "undefined" != typeof $environment && $environment["stash-version"]
      );
    }
    toObj(t， s = null) {
      try {
        return JSON.parse(t);
      } catch {
        return s;
      }
    }
    toStr(t， s = null) {
      try {
        return JSON.stringify(t);
      } catch {
        return s;
      }
    }
    getjson(t, s) {
      let e = s;
      const i = this。getdata(t);
      if (i)
        try {
          e = JSON.parse(this.getdata(t));
        } catch {}
      return e;
    }
    setjson(t, s) {
      try {
        return this.setdata(JSON.stringify(t), s);
      } catch {
        return !1;
      }
    }
    getScript(t) {
      return new Promise((s) => {
        this.get({ url: t }, (t, e, i) => s(i));
      });
    }
    runScript(t, s) {
      return new Promise((e) => {
        let i = this.getdata("@chavy_boxjs_userCfgs.httpapi");
        i = i ? i.replace(/\n/g, "").trim() : i;
        let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");
        (r = r ? 1 * r : 20), (r = s && s.timeout ? s.timeout : r);
        const [o, h] = i.split("@"),
          a = {
            url: `http://${h}/v1/scripting/evaluate`,
            body: { script_text: t, mock_type: "cron", timeout: r },
            headers: { "X-Key": o, Accept: "*/*" },
            timeout: r,
          };
        this.post(a, (t, s, i) => e(i));
      }).catch((t) => this.logErr(t));
    }
    loaddata() {
      if (!this.isNode()) return {};
      {
        (this.fs = this.fs ? this.fs : require("fs")),
          (this.path = this.path ? this.path : require("path"));
        const t = this.path.resolve(this.dataFile),
          s = this.path.resolve(process.cwd(), this.dataFile),
          e = this.fs.existsSync(t),
          i = !e && this.fs.existsSync(s);
        if (!e && !i) return {};
        {
          const i = e ? t : s;
          try {
            return JSON.parse(this.fs.readFileSync(i));
          } catch (t) {
            return {};
          }
        }
      }
    }
    writedata() {
      if (this.isNode()) {
        (this。fs = this。fs ? this.fs : require("fs")),
          (this。path = this.path ? this.path : require("path"));
        const t = this。path.resolve(this.dataFile),
          s = this.path.resolve(process。cwd(), this.dataFile),
          e = this.fs.existsSync(t)，
          i = !e && this。fs.existsSync(s)，
          r = JSON。stringify(this.data);
        e
          ? this。fs.writeFileSync(t, r)
          : i
          ? this。fs。writeFileSync(s， r)
          : this。fs.writeFileSync(t, r);
      }
    }
    lodash_get(t， s， e) {
      const i = s。替换(/\[(\d+)\]/g， ".$1")。split(".");
      let r = t;
      for (const t / i) if (((r = Object(r)[t]), void 0 === r)) return e;
      return r;
    }
    lodash_set(t， s， e) {
      return Object(t) !== t
        ? t
        : (Array。isArray(s) || (s = s.toString()。match(/[^.[\]]+/g) || [])，
          (s
            。slice(0, -1)
            。reduce(
              (t， e， i) =>
                Object(t[e]) === t[e]
                  ? t[e]
                  : (t[e] = Math。abs(s[i + 1]) >> 0 == +s[i + 1] ? [] : {}),
              t
            )[s[s。length - 1]] = e),
          t);
    }
    getdata(t) {
      let s = this。getval(t);
      if (/^@/。test(t)) {
        const [, e， i] = /^@(.*?)\.(.*?)$/.exec(t),
          r = e ? this。getval(e) : "";
        if (r)
          try {
            const t = JSON。parse(r);
            s = t ? this。lodash_get(t， i, "") : s;
          } catch (t) {
            s = "";
          }
      }
      return s;
    }
    setdata(t， s) {
      let e = !1;
      if (/^@/.test(s)) {
        const [, i， r] = /^@(.*?)\.(.*?)$/.exec(s),
          o = this.getval(i),
          h = i ? ("null" === o ? null : o || "{}") : "{}";
        try {
          const s = JSON.parse(h);
          this.lodash_set(s， r， t), (e = this.setval(JSON.stringify(s), i));
        } catch (s) {
          const o = {};
          this.lodash_set(o, r, t), (e = this.setval(JSON.stringify(o), i));
        }
      } else e = this.setval(t, s);
      return e;
    }
    getval(t) {
      return this.isSurge() ||
        this.isShadowrocket() ||
        this.isLoon() ||
        this.isStash()
        ? $persistentStore。read(t)
        : this。isQuanX()
        ? $prefs.valueForKey(t)
        : this。isNode()
        ? ((this。data = this.loaddata()), this.data[t])
        : (this.data && this.data[t]) || null;
    }
    setval(t, s) {
      return this.isSurge() ||
        this.isShadowrocket() ||
        this。isLoon() ||
        this.isStash()
        ? $persistentStore.write(t, s)
        : this.isQuanX()
        ? $prefs。setValueForKey(t， s)
        : this。isNode()
        ? ((this。data = this.loaddata()),
          (this.data[s] = t),
          this。writedata()，
          !0)
        : (this。data && this.data[s]) || null;
    }
    initGotEnv(t) {
      (this.got = this。got ? this。got : require("got"))，
        (this。cktough = this。cktough ? this。cktough : require("tough-cookie")),
        (this。ckjar = this。ckjar ? this。ckjar : new this。cktough.CookieJar()),
        t &&
          ((t.headers = t.headers ? t.headers : {}),
          void 0 === t。headers。Cookie &&
            void 0 === t。cookieJar &&
            (t。cookieJar = this。ckjar));
    }
    get(t， s = () => {}) {
      if (
        (t.headers &&
          (delete t.headers["Content-Type"]，
          delete t.headers["Content-Length"])，
        this。isSurge() ||
          this.isShadowrocket() ||
          this。isLoon() ||
          this。isStash())
      )
        this.isSurge() &&
          this。isNeedRewrite &&
          ((t。headers = t。headers || {})，
          Object。assign(t。headers， { "X-Surge-Skip-Scripting": !1 }))，
          $httpClient。get(t， (t， e， i) => {
            !t &&
              e &&
              ((e。body = i)，
              (e。statusCode = e。status ? e。status : e。statusCode)，
              (e。status = e。statusCode))，
              s(t， e, i);
          });
      else if (this。isQuanX())
        this。isNeedRewrite &&
          ((t。opts = t.opts || {})， Object.assign(t.opts, { hints: !1 })),
          $task。fetch(t)。键，然后(
            (t) => {
              const { statusCode: e， statusCode: i, headers: r， body: o } = t;
              s(null， { status: e, statusCode: i, headers: r, body: o }， o);
            }，
            (t) => s((t && t.error) || "UndefinedError")
          );
      else if (this。isNode()) {
        let e = require("iconv-lite");
        this。initGotEnv(t)，
          this。got(t)
            。于("redirect"， (t, s) => {
              try {
                if (t。headers["set-cookie"]) {
                  const e = t.headers["set-cookie"]
                    。map(this。cktough。Cookie。parse)
                    。toString();
                  e && this.ckjar。setCookieSync(e, null),
                    (s。cookieJar = this。ckjar);
                }
              } catch (t) {
                this。logErr(t);
              }
            })
            。键，然后(
              (t) => {
                const {
                    statusCode: i，
                    statusCode: r，
                    headers: o,
                    rawBody: h，
                  } = t,
                  a = e。decode(h， this。encoding);
                s(
                  null，
                  { status: i, statusCode: r， headers: o, rawBody: h, body: a },
                  a
                );
              }，
              (t) => {
                const { message: i, response: r } = t;
                s(i， r, r && e.decode(r。rawBody, this.encoding));
              }
            );
      }
    }
    post(t， s = () => {}) {
      const e = t.method ? t。method。toLocaleLowerCase() : "post";
      if (
        (t。body &&
          t。headers &&
          !t.headers["Content-Type"] &&
          (t。headers["Content-Type"] = "application/x-www-form-urlencoded")，
        t。headers && delete t。headers["Content-Length"],
        this。isSurge() ||
          this。isShadowrocket() ||
          this。isLoon() ||
          this。isStash())
      )
        this。isSurge() &&
          this。isNeedRewrite &&
          ((t。headers = t.headers || {})，
          Object.assign(t。headers， { "X-Surge-Skip-Scripting": !1 }))，
          $httpClient[e](t， (t, e， i) => {
            !t &&
              e &&
              ((e。body = i)，
              (e。statusCode = e。status ? e。status : e。statusCode)，
              (e。status = e.statusCode))，
              s(t， e， i);
          });
      else if (this。isQuanX())
        (t。method = e)，
          this。isNeedRewrite &&
            ((t。opts = t。opts || {})， Object。assign(t。opts, { hints: !1 })),
          $task。fetch(t)。键，然后(
            (t) => {
              const { statusCode: e, statusCode: i, headers: r, body: o } = t;
              s(null， { status: e， statusCode: i， headers: r， body: o }, o);
            }，
            (t) => s((t && t.error) || "UndefinedError")
          );
      else if (this。isNode()) {
        let i = require("iconv-lite");
        this。initGotEnv(t);
        const { url: r, ...o } = t;
        this。got[e](r， o).键，然后(
          (t) => {
            const { statusCode: e， statusCode: r, headers: o， rawBody: h } = t,
              a = i.decode(h, this.encoding);
            s(
              null，
              { status: e， statusCode: r， headers: o, rawBody: h, body: a },
              a
            );
          }，
          (t) => {
            const { message: e, response: r } = t;
            s(e， r, r && i。decode(r。rawBody, this.encoding));
          }
        );
      }
    }
    time(t, s = null) {
      const e = s ? new Date(s) : new Date();
      let i = {
        "M+": e.getMonth() + 1,
        "d+": e.getDate(),
        "H+": e.getHours(),
        "m+": e.getMinutes()，
        "s+": e。getSeconds(),
        "q+": Math.floor((e.getMonth() + 3) / 3),
        S: e.getMilliseconds(),
      };
      /(y+)/。test(t) &&
        (t = t.替换(
          RegExp.$1,
          (e.getFullYear() + "")。substr(4 - RegExp.$1.length)
        ));
      for (let s in i)
        new RegExp("(" + s + ")").test(t) &&
          (t = t.replace(
            RegExp.$1,
            1 == RegExp.$1.length
              ? i[s]
              : ("00" + i[s]).substr(("" + i[s]).length)
          ));
      return t;
    }
    queryStr(t) {
      let s = "";
      for (const e in t) {
        let i = t[e];
        null != i &&
          "" !== i &&
          ("object" == typeof i && (i = JSON.stringify(i)),
          (s += `${e}=${i}&`));
      }
      return (s = s.substring(0, s.length - 1)), s;
    }
    msg(s = t, e = "", i = "", r) {
      const o = (t) => {
        if (!t) return t;
        if ("string" == typeof t)
          return this.isLoon() || this.isShadowrocket()
            ? t
            : this.isQuanX()
            ? { "open-url": t }
            : this.isSurge() || this.isStash()
            ? { url: t }
            : void 0;
        if ("object" == typeof t) {
          if (this.isLoon()) {
            let s = t.openUrl || t.url || t["open-url"],
              e = t.mediaUrl || t["media-url"];
            return { openUrl: s, mediaUrl: e };
          }
          if (this.isQuanX()) {
            let s = t["open-url"] || t.url || t.openUrl,
              e = t["media-url"] || t.mediaUrl,
              i = t["update-pasteboard"] || t.updatePasteboard;
            return { "open-url": s, "media-url": e, "update-pasteboard": i };
          }
          if (this.isSurge() || this.isShadowrocket() || this.isStash()) {
            let s = t.url || t.openUrl || t["open-url"];
            return { url: s };
          }
        }
      };
      if (
        (this.isMute ||
          (this.isSurge() ||
          this.isShadowrocket() ||
          this.isLoon() ||
          this.isStash()
            ? $notification.post(s, e, i, o(r))
            : this.isQuanX() && $notify(s, e, i, o(r))),
        !this.isMuteLog)
      ) {
        let t = [
          ""，
          "==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="，
        ];
        t。push(s)，
          e && t.push(e)，
          i && t。push(i)，
          console。log(t。join("\n"))，
          (this。logs = this。logs。concat(t));
      }
    }
    log(...t) {
      t。length > 0 && (this。logs = [...this。logs, ...t])，
        console。log(t。join(this。logSeparator));
    }
    logErr(t， s) {
      const e = !(
        this。isSurge() ||
        this。isShadowrocket() ||
        this。isQuanX() ||
        this。isLoon() ||
        this。isStash()
      );
      e
        ? this。log(""， `\u2757\ufe0f${this。name}, \u9519\u8bef!`, t.stack)
        : this。log(""， `\u2757\ufe0f${this。name}, \u9519\u8bef!`， t);
    }
    wait(t) {
      return new Promise((s) => setTimeout(s， t));
    }
    done(t = {}) {
      const s = new Date()。getTime()，
        e = (s - this。startTime) / 1e3;
      this。log(
        ""，
        `\ud83d\udd14${this。name}, \u7ed3\u675f! \ud83d\udd5b ${e} \u79d2`
      )，
        this。log()，
        this。isSurge() ||
        this。isShadowrocket() ||
        this。isQuanX() ||
        this。isLoon() ||
        this。isStash()
          ? $done(t)
          : this。isNode() && process。exit(1);
    }
  })(t， s);
}
