# 极速抢索票台审计报告

## 审计范围

- `index.html`
- `styles.css`
- `app.js`
- `src/extract.js`
- `src/strategy.js`
- `api/extract-ticket.js`
- `sw.js`
- `scripts/build.mjs`
- `tests/strategy.test.mjs`
- `tests/extract.test.mjs`
- 发布配置和文档

## 结论

当前实现是客户索票需求整理工具，不是自动抢票脚本。项目只做票需识别、索票单生成、复制/分享和官方入口跳转。

## 已验证

- 策略单元测试通过：`npm test`
- 运行包构建通过：`npm run build`
- JavaScript 语法检查通过：`node --check app.js`、`node --check src/strategy.js`、`node --check src/extract.js`、`node --check api/extract-ticket.js`
- GitHub Pages、Vercel、Netlify 已改为只发布 `dist/`，避免测试、脚本和审计文档进入客户访问面。
- 图片/文字解析测试覆盖 12306 行程和大麦项目页字段。
- URL 白名单测试覆盖 12306 和大麦域名。
- 12306 可在填写电报码后生成官方余票页参数链接。
- 大麦项目 ID 可以生成网页入口和移动入口。
- 大麦详情页链接可以解析 `itemId`。
- 手机端入口会按候选队列提供 App 深链、Android intent、官方移动页和官方网页。
- 图片填表优先走 Vercel API 代理，不在前端暴露模型 Key；静态站点降级为浏览器 OCR 或粘贴文字解析。
- UI 已改为客户索票单交付，不再堆叠提醒类面板。

## 合规边界

本项目没有实现以下能力：

- 自动提交订单。
- 自动锁票。
- 自动预约。
- 验证码识别或打码平台接入。
- 私有接口调用。
- 代理池。
- 多账号并发。
- Selenium/Appium 自动点击。
- Cookie 窃取或账号凭证上传。

## 数据安全

- 所有索票信息保存在用户浏览器 `localStorage`。
- Vercel API 仅作为图片模型代理，Key 读取自环境变量。
- 没有第三方统计脚本。
- 不要求上传账号、密码、Cookie 或支付信息。

## 风险和限制

- 手机 App 深链是否接管由系统、浏览器和官方 App 决定。
- 图片识别准确度取决于截图清晰度、模型可用性和浏览器 OCR 能力。
- 浏览器可能限制自动打开新窗口。
- Web App 不能代替客户完成官方登录、实名确认、验证码、下单或支付。

## 下一步建议

- 增加导入/导出索票单。
- 增加常用车站电报码字典。
- 增加多客户索票记录列表。
