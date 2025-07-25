// ==UserScript==
// @name        Revenuecat解锁订阅
// @namespace   http://tampermonkey.net/
// @version     1.0
// @description 模拟返回订阅信息，解锁App Pro功能
// ==/UserScript==

let obj = {
  request_date_ms: 1660000000000,
  request_date: "2022-08-08T08:08:08Z",
  subscriber: {
    entitlements: {
      pro: {
        expires_date: "2099-09-09T09:09:09Z",
        product_identifier: "com.app.pro",
        purchase_date: "2022-08-08T08:08:08Z"
      }
    },
    first_seen: "2022-08-08T08:08:08Z",
    original_application_version: "1.0.0",
    original_purchase_date: "2022-08-08T08:08:08Z",
    subscriptions: {
      "com.app.pro": {
        billing_issues_detected_at: null,
        expires_date: "2099-09-09T09:09:09Z",
        is_sandbox: false,
        original_purchase_date: "2022-08-08T08:08:08Z",
        period_type: "active",
        purchase_date: "2022-08-08T08:08:08Z",
        store: "app_store",
        unsubscribe_detected_at: null
      }
    }
  }
};

$done({ body: JSON.stringify(obj) });
