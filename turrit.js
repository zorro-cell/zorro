[rewrite_local]
^https?:\/\/t\.me\/(.+) url 302 turrit://resolve?domain=$1

[mitm]
hostname = %APPEND% t.me
