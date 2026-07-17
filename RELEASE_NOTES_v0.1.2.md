# Go Music JS v0.1.2

对应开发版：`0.0.115`

## 更新内容

- 统一歌曲字段映射规则，搜索、排行榜、歌单、本地音乐和 Songloft 回读歌曲统一识别 `id`、歌名、歌手、专辑、专辑 ID、封面等字段。
- 统一封面识别和规范化规则，补充兼容 `cover_url`、`coverImgUrl`、`picUrl`、`web_albumpic`、`web_albumpic_short` 等常见平台字段。
- 统一内嵌歌词读取规则，支持从歌曲、`source_data`、`extra`、`metadata`、`tags` 中读取歌词元数据。
- 搜索入口切换为统一归一化逻辑，减少平台字段差异导致的封面、音质、大小等信息丢失。

## 验证

- `npm run build` 通过。
- `npm run validate` 通过。
- `node --check static/js/app.js` 通过。
- 已验证酷我排行榜 30 首歌曲封面补全正常，歌词接口可正常返回歌词。

## 归档

- 插件包：`backups/formal-releases/go-music-js-v0.1.2.jsplugin.zip`
- 源码包：`backups/formal-releases/go-music-js-source-v0.1.2.zip`
