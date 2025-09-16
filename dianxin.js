[mitm]
hostname = e.dlife.cn

[rewrite_local]
^https:\/\/e\.dlife\.cn\/user\/loginMiddle  url script-request-header https://raw.githubusercontent.com/dompling/Script/master/10000/index.js
