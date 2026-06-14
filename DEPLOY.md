# 极速抢公开发布指南

本项目是静态 PWA，不需要后端服务器。正式给别人使用时，部署到公网静态托管平台，然后分享网址即可。

## 推荐方式：Vercel

1. 把 `H:\极速抢` 上传到 GitHub 仓库。
2. 打开 Vercel，导入该仓库。
3. Framework 选择 `Other` 或保持默认。
4. Build Command 留空或填 `npm test`。
5. Output Directory 填 `.`。
6. 发布后获得公网地址，别人用电脑、Android、iPhone 浏览器打开即可。

## 备选方式：Netlify

1. 把 `H:\极速抢` 上传到 GitHub 仓库。
2. 打开 Netlify，导入该仓库。
3. Publish directory 填 `.`。
4. Build command 填 `npm test`。
5. 发布后分享 Netlify 域名。

## 备选方式：GitHub Pages

本项目已经带有 `.github/workflows/pages.yml`。

1. 把项目推送到 GitHub 仓库的 `main` 分支。
2. 在仓库 Settings → Pages 中选择 GitHub Actions。
3. 推送后 Actions 会自动运行测试并发布。
4. 发布完成后，GitHub 会给出 Pages 地址。

## 本地调试和公开使用的区别

- 本地调试：用 `npm start` 打开 `http://127.0.0.1:5177/`，只用于发布前检查。
- 局域网测试：手机和电脑同 Wi-Fi 时，可以用终端打印的 `http://192.168.x.x:5177/` 验证手机显示。
- 公开使用：部署到 Vercel、Netlify、Cloudflare Pages 或 GitHub Pages，别人直接打开公网链接。

## 手机安装

- Android：用 Chrome 打开公网链接，菜单中选择“添加到主屏幕”。
- iOS：用 Safari 打开公网链接，分享按钮中选择“添加到主屏幕”。

## 合规边界

极速抢只做策略、检查、倒计时、官方入口跳转和人工确认辅助。它不做自动锁票、自动提交订单、验证码识别、接口逆向、代理池、多账号并发或绕过平台规则的行为。
