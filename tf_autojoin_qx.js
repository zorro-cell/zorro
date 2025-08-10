/*
* TestFlight 自动加入（Quantumult X 版，兼容 Surge/Loon）
* 原脚本作者：DecoAri｜修复作者：xream｜QX重写与稳健增强：ChatGPT
* 变更要点：
* 1) 原 $httpClient/$notification/$persistentStore → 统一适配到 QX 原生 $task.fetch/$notify/$prefs；
* 2) 新增 Content-Type 与 HTML 兜底，避免 JSON.parse('<html...') 报错；
* 3) 更清晰的日志+错误提示；404 自动移除 APP_ID；401 提示会话失效；
* 4) 支持多平台运行（QX/Surge/Loon），便于迁移。
*
* 需事先写入以下键值（名称与原脚本一致，便于无缝过渡）：
*  key            → v3/accounts/<key>/ru/ 的 accountKey
*  session_id     → X-Session-Id
*  session_digest → X-Session-Digest（注意必须与本次会话匹配）
*  request_id     → X-Request-Id
*  tf_ua          → User-Agent（可留空，脚本有 iPhone Safari 默认 UA）
*  APP_ID         → 逗号分隔的 join code 列表，如 "UzgVUV7k,pzU71aua,SXJHaQYF"
*
* Quantumult X 定时示例（放到 [task_local]）：
*  0 */5 * * * tf_autojoin_qx.js, tag=TF AutoJoin, timeout=30, enabled=true
*/

;(async () => {
  const store = {
    read(k){ return typeof $prefs !== 'undefined' ? ($prefs.valueForKey(k) ?? null)
           : typeof $persistentStore !== 'undefined' ? ($persistentStore.read(k) ?? null)
           : null },
    write(v,k){ if (typeof $prefs !== 'undefined') return $prefs.setValueForKey(v, k)
                if (typeof $persistentStore !== 'undefined') return $persistentStore.write(v, k)
                return false }
  };
  const notify = (title, sub, body) => {
    if (typeof $notify !== 'undefined') $notify(title, sub, body);
    else if (typeof $notification !== 'undefined') $notification.post(title, sub, body);
    else console.log(`[Notify] ${title} | ${sub} | ${body}`);
  };
  const fetchQX = (req) => {
    // 统一到 Promise 风格
    if (typeof $task !== 'undefined' && $task.fetch) {
      return $task.fetch(req).then(resp => ({
        status: resp.statusCode || resp.status || 0,
        headers: resp.headers || {},
        body: resp.body
      }));
    }
    // 兼容 Surge/Loon
    if (typeof $httpClient !== 'undefined') {
      return new Promise((resolve) => {
        const cb = (err, resp, data) => resolve({
          status: resp ? (resp.status || resp.statusCode || 0) : 0,
          headers: resp ? (resp.headers || {}) : {},
          body: data,
          error: err
        });
        if ((req.method || 'GET').toUpperCase() === 'POST') $httpClient.post(req, cb);
        else $httpClient.get(req, cb);
      });
    }
    // 兜底
    return Promise.resolve({ status: 0, headers: {}, body: '', error: 'No HTTP engine' });
  };

  const log = (...args) => console.log('[TF AutoJoin]', ...args);

  // === 读取配置 ===
  let ids = store.read('APP_ID');
  const key = store.read('key');
  const sid = store.read('session_id');
  const sgd = store.read('session_digest');
  const rid = store.read('request_id');
  const ua  = store.read('tf_ua') || 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

  if (ids == null) {
    notify('未添加 TestFlight APP_ID', '请手动添加或用 TF 链接获取', '');
    return $done?.();
  }
  if (ids.trim() === '') {
    notify('所有 TestFlight 已加入完毕', '如无需要可禁用该任务', '');
    return $done?.();
  }
  if (!key || !sid || !sgd || !rid) {
    notify('缺少会话参数', 'key/session_id/session_digest/request_id 不能为空', '请重新抓取同一批会话参数并写入。');
    return $done?.();
  }

  // 规范化 APP_ID 列表
  let idList = ids.split(',').map(s => s.trim()).filter(Boolean);
  const base = `https://testflight.apple.com/v3/accounts/${key}/ru/`;
  const headers = {
    'X-Session-Id': sid,
    'X-Session-Digest': sgd,
    'X-Request-Id': rid,
    'User-Agent': ua,
    'Accept': 'application/json, text/plain, */*'
  };

  // 工具：安全 JSON 解析（容忍 HTML/空响应）
  const safeJSON = (text) => {
    if (!text) return { __empty: true };
    const head = text.trim().slice(0, 1);
    if (head === '<') return { __html: true, raw: text };
    try { return JSON.parse(text); }
    catch (e) { return { __parse_error: String(e), raw: text }; }
  };

  // 工具：从 APP_ID 列表中移除并持久化
  const removeId = (ID) => {
    idList = idList.filter(x => x !== ID);
    store.write(idList.join(','), 'APP_ID');
  };

  // 主流程
  for (const ID of idList.slice()) {
    try {
      // 1) 查询名额/状态
      const getResp = await fetchQX({ url: base + ID, headers, method: 'GET' });
      const ct = String((getResp.headers && (getResp.headers['Content-Type'] || getResp.headers['content-type'])) || '');
      log(ID, 'GET status:', getResp.status, 'CT:', ct);

      if (getResp.status === 404) {
        removeId(ID);
        notify(ID, '不存在该 TestFlight（404）', '已自动从 APP_ID 移除');
        log(ID, '不存在该 TestFlight，已移除');
        continue;
      }
      if (getResp.status === 401) {
        // 会话失效/签名不匹配
        notify(ID, '鉴权失败（401）', '会话已过期或签名失配，请重新抓取同一批会话参数');
        log(ID, '401 Unauthorized');
        continue;
      }
      if (getResp.status === 400) {
        // 常见为 HTML 错页
        notify(ID, '请求被拒（400）', '多见于签名/头部不匹配，或参数过期；已跳过');
        log(ID, '400 Bad Request（可能返回 HTML）');
        continue;
      }
      // 解析查询结果
      const j1 = safeJSON(getResp.body);
      if (j1.__html) {
        notify(ID, '收到 HTML 而非 JSON', '大概率签名或会话无效；请重新抓包同批参数');
        log(ID, 'HTML page received, skip.');
        continue;
      }
      if (j1.__parse_error) {
        notify(ID, '返回体解析失败', j1.__parse_error);
        log(ID, 'JSON parse error:', j1.__parse_error);
        continue;
      }

      // 业务判断
      // 结构示例：{ data: { status: 'FULL'|'OPEN', app:{name:...}, message:... }, messages: [...] }
      const data = j1.data || null;
      if (!data) {
        const msg = (j1.messages && j1.messages[0] && j1.messages[0].message) || '无可用数据';
        log(ID, '无 data，messages:', msg);
        continue;
      }
      if (data.status === 'FULL') {
        log(`${data.app?.name || ''} ${ID} 已满员：${data.message || ''}`);
        continue;
      }

      // 2) 可加入 → 发起 accept
      const postResp = await fetchQX({ url: base + ID + '/accept', headers, method: 'POST' });
      log(ID, 'POST /accept status:', postResp.status);
      if (postResp.status === 401) {
        notify(ID, '加入失败（401）', '会话过期或签名失配，需重新抓取参数');
        continue;
      }
      const j2 = safeJSON(postResp.body);
      if (j2.__html || j2.__parse_error) {
        notify(ID, '加入返回体异常', j2.__html ? '收到 HTML（签名/会话问题）' : j2.__parse_error);
        log(ID, 'accept parse issue:', j2.__html ? 'HTML' : j2.__parse_error);
        continue;
      }

      const appName = (j2.data && (j2.data.name || j2.data.app?.name)) || '未知应用';
      notify(appName, 'TestFlight 加入成功', '');
      log(appName, '加入成功');
      // 成功后移除该 ID
      removeId(ID);

    } catch (e) {
      const msg = String(e || '');
      if (msg.includes('timeout') || msg.includes('Timed out') || msg.includes('The request timed out')) {
        log(ID, '请求超时，跳过本次');
      } else {
        notify('自动加入 TestFlight 异常', ID, msg);
        log(ID, '异常：', msg);
      }
    }
  }

  $done?.();
})();
