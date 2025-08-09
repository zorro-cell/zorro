/*
 * TestFlight 自动加入脚本（Quantumult X 版）
 * 作者：DecoAri / 修复：xream / 改写成 QX：你
 * 用法：
 *   1. 确保已抓取 token（TF_keys_QX.js）
 *   2. 在 [task_local] 里定时调用本脚本
 *   3. APP_ID 用英文逗号隔开，持久化键名 APP_ID
 */

!(async () => {
  const ids = $prefs.valueForKey('APP_ID');
  if (!ids) {
    $notify('未添加 TestFlight APP_ID', '请先添加 ID 或使用 TestFlight 链接自动获取', '');
    return;
  }
  if (ids === '') {
    $notify('所有 TestFlight 已加入完毕', '可手动禁用本任务', '');
    return;
  }
  const list = ids.split(',').filter(Boolean);
  for (const id of list) await autoPost(id.trim());
  $done();
})();

function autoPost(id) {
  return new Promise(resolve => {
    const key   = $prefs.valueForKey('key');
    const sId   = $prefs.valueForKey('session_id');
    const sDig  = $prefs.valueForKey('session_digest');
    const rId   = $prefs.valueForKey('request_id');
    const ua    = $prefs.valueForKey('tf_ua');

    const base  = `https://testflight.apple.com/v3/accounts/${key}/ru/`;
    const hdr   = {
      'X-Session-Id'   : sId,
      'X-Session-Digest': sDig,
      'X-Request-Id'   : rId,
      'User-Agent'     : ua
    };

    $task.fetch({ url: base + id, method: 'GET', headers: hdr })
      。then(resp => {
        if (resp.status === 404) {
          removeId(id, '404 不存在，已移除');
        } else if (resp.status === 401) {
          console.log(`${id} 401 异常，跳过`);
        } else {
          const data = JSON.parse(resp.body);
          if (!data.data) {
            console.log(`${id} ${data.messages?.[0]?.message || '未知错误'}`);
          } else if (data.data.status === 'FULL') {
            console.log(`${data.data.app.name} 已满`);
          } else {
            // 真正加入
            $task.fetch({ url: base + id + '/accept', method: 'POST', headers: hdr })
              。then(res => {
                const name = JSON.parse(res.body).data?.name || id;
                $notify('🎉' + name, 'TestFlight 加入成功', '');
                removeId(id, '已成功加入，已移除');
              });
          }
        }
        resolve();
      })
      。catch(err => {
        console.log(`${id} 网络错误：${err}`);
        resolve();
      });
  });
}

function removeId(id, msg) {
  let arr = ($prefs.valueForKey('APP_ID') || '').split(',').filter(Boolean);
  arr = arr.filter(i => i !== id);
  $prefs.setValueForKey(arr.join(','), 'APP_ID');
  console.log(`${id} ${msg}`);
}
