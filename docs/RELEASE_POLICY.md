# Go Music JS 正式版发布规则

## 正式版编号

- `0.1.0`：第一版正式版，对应历史开发版 `0.0.110`。
- `0.1.1`：第二版正式版，对应历史开发版 `0.0.114`。
- `0.1.2`：第三版正式版，对应开发版 `0.0.115`。
- `0.1.3`：第四版正式版，对应开发版 `0.0.118`。
- `0.1.4`：第五版正式版，对应开发版 `0.0.123`。

## 发布规则

只有用户明确说“提交正式版”“更新为正式版”或等价指令时，才执行正式版流程：

1. 调整 `package.json`、`package-lock.json`、`plugin.json`、`src/main.ts` 中的正式版版本号。
2. 执行构建和校验。
3. 备份正式版源码。
4. 备份正式版插件包。
5. 写完整功能说明或版本更新说明。

日常修复和调试可以使用开发版号或临时备份，但不作为正式版归档。

## 正式版归档目录

正式版文件统一放在：

`backups/formal-releases/`

当前归档：

- `go-music-js-v0.1.0.jsplugin.zip`
- `go-music-js-source-v0.1.0.zip`
- `go-music-js-v0.1.1.jsplugin.zip`
- `go-music-js-source-v0.1.1.zip`
- `go-music-js-v0.1.2.jsplugin.zip`
- `go-music-js-source-v0.1.2.zip`
- `go-music-js-v0.1.3.jsplugin.zip`
- `go-music-js-source-v0.1.3.zip`
- `go-music-js-v0.1.4.jsplugin.zip`
- `go-music-js-source-v0.1.4.zip`
