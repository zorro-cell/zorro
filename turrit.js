#!name = Turrit
#!desc = Telegram外部链接跳转至Turrit
#!openUrl = https://apps.apple.com/app/id6471781238
#!author = sooyaaabo[https://github.com/sooyaaabo]
#!tag = 功能增强
#!system = 
#!system_version = 
#!loon_version = 3.3.3(894)
#!homepage = https://github.com/sooyaaabo/Loon/blob/main/README.md
#!icon = https://raw.githubusercontent.com/sooyaaabo/Loon/main/Icon/App-Icon/Turrit.png
#!date = 2025-09-09 22:00

[Rewrite]
(https:\/\/)?t\.me\/(.+) 302 turrit://resolve?domain=$2

[MitM]
hostname = t.me
