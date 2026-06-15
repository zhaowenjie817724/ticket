# 极速抢公开发布指南

本项目是静态 PWA，不需要后端服务器。正式给别人使用时，部署到公网静态托管平台，然后分享网址即可。

AI 图片预填是可选增强功能，需要服务端代理保存模型 Key。只做静态托管时，其他功能正常，AI 图片预填会自动降级为手动填写。

## 推荐方式：Vercel

1. 把 `H:\极速抢` 上传到 GitHub 仓库。
2. 打开 Vercel，导入该仓库。
3. Framework 选择 `Other` 或保持默认。
4. Build Command 留空或填 `npm test`。
5. Output Directory 填 `.`。
6. 发布后获得公网地址，别人用电脑、Android、iPhone 浏览器打开即可。

如果要启用 AI 图片预填，需要把 `scripts/server.mjs` 或等价 Node 服务部署到支持服务端运行的平台，并设置这些环境变量：

```text
AI_PREFILL_PRIMARY_BASE_URL
AI_PREFILL_PRIMARY_API_KEY
AI_PREFILL_PRIMARY_MODEL
AI_PREFILL_FALLBACK_BASE_URL
AI_PREFILL_FALLBACK_API_KEY
AI_PREFILL_FALLBACK_MODEL
```

Vercel 在国内网络下可能不稳定，部分用户需要梯子。要给国内同学、朋友稳定使用，优先看下面的“国内免梯子部署”。

## 国内免梯子部署

极速抢是纯静态 PWA，可以放到任何静态网站托管平台。国内用户不用梯子的优先级如下：

### 方案 A：腾讯云 EdgeOne Pages

适合：想像 Vercel 一样从 GitHub 自动部署。

1. 打开腾讯云 EdgeOne Pages。
2. 连接 GitHub 仓库 `zhaowenjie817724/ticket`。
3. 构建命令填 `npm test`，输出目录填 `.`。
4. 部署完成后使用平台给出的公网域名。

### 方案 B：腾讯云 COS 静态网站

适合：直接上传静态文件，国内访问更稳。

1. 新建 COS Bucket。
2. 开启静态网站功能，入口文档填 `index.html`。
3. 上传项目静态文件：`index.html`、`styles.css`、`app.js`、`src/`、`assets/`、`manifest.webmanifest`、`sw.js`。
4. 权限设为公有读，复制静态网站访问地址。

COS 静态网站不运行后端代理，AI 图片预填不可用。

### 方案 C：阿里云 OSS 静态网站

适合：已有阿里云账号。

1. 新建 OSS Bucket。
2. 开启静态网站托管，默认首页填 `index.html`。
3. 上传同样的静态文件。
4. 设置公共读或通过 CDN 公网访问。

OSS 静态网站不运行后端代理，AI 图片预填不可用。

### 自定义域名说明

如果用国内云服务绑定自己的域名并面向国内访问，通常需要完成 ICP 备案。没有备案时，可以先用平台自带的默认域名或临时域名。

## 备选方式：Netlify

1. 把 `H:\极速抢` 上传到 GitHub 仓库。
2. 打开 Netlify，导入该仓库。
3. Publish directory 填 `.`。
4. Build command 填 `npm test`。
5. 发布后分享 Netlify 域名。

只使用当前静态配置时，AI 图片预填不可用。要启用它，需要额外部署后端代理并保护环境变量。

## 备选方式：GitHub Pages

本项目已经带有 `.github/workflows/pages.yml`。

1. 把项目推送到 GitHub 仓库的 `main` 分支。
2. 在仓库 Settings → Pages 中选择 GitHub Actions。
3. 推送后 Actions 会自动运行测试并发布。
4. 发布完成后，GitHub 会给出 Pages 地址。

GitHub Pages 是纯静态托管，AI 图片预填不可用。

## 本地调试和公开使用的区别

- 本地调试：用 `npm start` 打开 `http://127.0.0.1:5177/`，只用于发布前检查。
- 局域网测试：手机和电脑同 Wi-Fi 时，可以用终端打印的 `http://192.168.x.x:5177/` 验证手机显示。
- 公开使用：部署到 Vercel、Netlify、Cloudflare Pages 或 GitHub Pages，别人直接打开公网链接。
- AI 图片预填：必须经过后端代理；不要把 API Key 写入 `app.js`、`index.html` 或任何会被浏览器下载的文件。

## 手机安装

- Android：用 Chrome 打开公网链接，菜单中选择“添加到主屏幕”。
- iOS：用 Safari 打开公网链接，分享按钮中选择“添加到主屏幕”。

## 合规边界

极速抢只做策略、检查、倒计时、官方入口跳转和人工确认辅助。它不做自动锁票、自动提交订单、验证码识别、接口逆向、代理池、多账号并发或绕过平台规则的行为。
