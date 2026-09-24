# Go Music JS

Go Music JS 是 `go-music-dl` 项目的 Songloft JS 插件版，面向 Songloft 插件系统使用。

本仓库只发布可安装的插件产物、插件清单和中文更新说明，不发布插件源码。源码与本地开发资料保存在作者本地环境中。

## 下载

在 [Releases](https://github.com/fanliu-yi/go-music-js/releases) 页面下载最新的 `.jsplugin.zip` 文件，在 Songloft 的插件管理中安装。

当前版本：`v0.1.6`

## 功能

- 酷我、网易云、QQ、酷狗、咪咕、汽水等平台的歌曲搜索。
- 推荐歌单、排行榜、平台歌单、本地曲库和本地歌单浏览。
- 在线播放、歌词、封面、换源和 Songloft 导入。
- Cookie 登录及已支持平台的扫码登录。
- 汽水音乐旧接口异常时自动回退 SEO 接口，并兼容加密音频和明文 M4A 播放。
- 适配桌面端和移动端 Songloft 插件容器。

## 文件说明

- `go-music-js-v0.1.6.jsplugin.zip`：Songloft 可安装插件包。
- `plugin.json`：插件源所需的公开清单。
- `RELEASE_NOTES_v0.1.6.md`：中文版本更新说明。
- `SHA256SUMS.txt`：插件包 SHA-256 校验值。

## 参考项目

- [go-music-dl](https://github.com/guohuiyuan/go-music-dl)
- [洛雪音乐相关项目](https://github.com/lyswhut/lx-music-desktop)

## 许可与说明

本仓库发布内容用于 Songloft 插件分发。各平台接口、账号登录和音频可用性受平台规则及上游服务状态影响。
