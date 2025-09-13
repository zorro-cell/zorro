#!name=网易云会员（Quantumult X 版）
#!desc=共享网易云会员（Surge 模块→QX 转换 by anyehttp）

[rewrite_local]
^https:\/\/interface3?\.music\.163\.com\/eapi\/playermode\/ url script-request-header https://raw.githubusercontent.com/anyehttp/quantumult-x/main/headers/wyy.js timeout=60
^https:\/\/interface3?\.music\.163\.com\/eapi\/search\/complex\/(page|rec\/song\/get) url script-request-header https://raw.githubusercontent.com/anyehttp/quantumult-x/main/headers/wyy.js timeout=60
^https:\/\/interface3?\.music\.163\.com\/eapi\/v3\/song\/detail url script-request-header https://raw.githubusercontent.com/anyehttp/quantumult-x/main/headers/wyy.js timeout=60
^https:\/\/interface3?\.music\.163\.com\/eapi\/song\/(chorus|enhance\/|play\/|type\/detail\/get) url script-request-header https://raw.githubusercontent.com/anyehttp/quantumult-x/main/headers/wyy.js timeout=60
^https:\/\/interface3?\.music\.163\.com\/eapi\/(v1\/artist\/top\/song|v3\/discovery\/recommend\/songs) url script-request-header https://raw.githubusercontent.com/anyehttp/quantumult-x/main/headers/wyy.js timeout=60
^https:\/\/interface3?\.music\.163\.com\/eapi\/vipnewcenter\/app\/resource\/newaccountpage url script-request-header https://raw.githubusercontent.com/anyehttp/quantumult-x/main/headers/wyy.js timeout=60
^https?:\/\/interface3?\.music\.163\.com\/eapi\/(homepage\/|v6\/)?playlist\/ url script-request-header https://raw.githubusercontent.com/anyehttp/quantumult-x/main/headers/wyy.js timeout=60
^https?:\/\/interface3?\.music\.163\.com\/eapi\/vipauth\/app\/auth\/(soundquality\/)?query url script-request-header https://raw.githubusercontent.com/anyehttp/quantumult-x/main/headers/wyy.js timeout=60

[mitm]
hostname = %APPEND% *.music.163.com
