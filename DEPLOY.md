# 极速抢公开发布指南

本项目主体是静态 PWA。图片模型识别需要 Vercel API 代理；没有 API 的静态托管仍可使用表单、索票单、官方入口、浏览器 OCR 和粘贴文字解析。

## 推荐方式：Vercel

1. 把 `H:\极速抢` 上传到 GitHub 仓库。
2. 打开 Vercel，导入该仓库。
3. Framework 选择 `Other` 或保持默认。
4. Build Command 填 `npm test && npm run build`。
5. Output Directory 填 `dist`。
6. 在 Environment Variables 配置模型 Key，发布后获得公网地址，别人用电脑、Android、iPhone 浏览器打开即可。

图片识别环境变量：

```text
ANYROUTER_API_KEY
ANYROUTER_BASE_URL
ANYROUTER_MODEL   # 必填，需是该网关实际支持图片输入的模型名
MUYUAN_API_KEY
MUYUAN_BASE_URL
MUYUAN_MODEL
```

Vercel 在国内网络下可能不稳定，部分用户需要梯子。要给国内同学、朋友稳定使用，优先看下面的“国内免梯子部署”。

## 国内免梯子部署

极速抢的核心表单和索票单可以放到任何静态网站托管平台。国内用户不用梯子的优先级如下：

### 方案 A：腾讯云 EdgeOne Pages

适合：想像 Vercel 一样从 GitHub 自动部署。

1. 打开腾讯云 EdgeOne Pages。
2. 连接 GitHub 仓库 `zhaowenjie817724/ticket`。
3. 构建命令填 `npm test && npm run build`，输出目录填 `dist`。
4. 部署完成后使用平台给出的公网域名。

### 方案 B：腾讯云 COS 静态网站

适合：直接上传静态文件，国内访问更稳。

1. 新建 COS Bucket。
2. 开启静态网站功能，入口文档填 `index.html`。
3. 运行 `npm run build`，只上传 `dist/` 目录里的文件。
4. 权限设为公有读，复制静态网站访问地址。

### 方案 C：阿里云 OSS 静态网站

适合：已有阿里云账号。

1. 新建 OSS Bucket。
2. 开启静态网站托管，默认首页填 `index.html`。
3. 运行 `npm run build`，上传 `dist/` 目录。
4. 设置公共读或通过 CDN 公网访问。

### 自定义域名说明

如果用国内云服务绑定自己的域名并面向国内访问，通常需要完成 ICP 备案。没有备案时，可以先用平台自带的默认域名或临时域名。

## 备选方式：Netlify

1. 把 `H:\极速抢` 上传到 GitHub 仓库。
2. 打开 Netlify，导入该仓库。
3. Publish directory 填 `dist`。
4. Build command 填 `npm test && npm run build`。
5. 发布后分享 Netlify 域名。

## 备选方式：GitHub Pages

本项目已经带有 `.github/workflows/pages.yml`。

1. 把项目推送到 GitHub 仓库的 `main` 分支。
2. 在仓库 Settings → Pages 中选择 GitHub Actions。
3. 推送后 Actions 会自动运行测试、生成 `dist/`，并只发布运行文件。
4. 发布完成后，GitHub 会给出 Pages 地址。

## 本地调试和公开使用的区别

- 本地调试：用 `npm start` 打开 `http://127.0.0.1:5177/`，只用于发布前检查。
- 局域网测试：手机和电脑同 Wi-Fi 时，可以用终端打印的 `http://192.168.x.x:5177/` 验证手机显示。
- 公开使用：部署到 Vercel、Netlify、Cloudflare Pages、腾讯云或 GitHub Pages，别人直接打开公网链接。

## 手机安装

- Android：用 Chrome 打开公网链接，菜单中选择“添加到主屏幕”。
- iOS：用 Safari 打开公网链接，分享按钮中选择“添加到主屏幕”。

## 合规边界

极速抢只做客户索票登记、索票单生成、官方网页入口和官方 App 拉起辅助。它不做自动锁票、自动提交订单、验证码识别、接口逆向、代理池、多账号并发或绕过平台规则的行为。
