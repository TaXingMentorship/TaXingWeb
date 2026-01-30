## TaXing Web

公益项目「她行」的官方网站，基于 **Next.js 15 + TypeScript + MUI**。包含首页、关于页、往期活动、播客等内容，并提供志愿者名录展示。

## 环境要求
- Node.js **18+**（建议 20）
- npm（或 pnpm / yarn / bun，示例使用 npm）

## 快速开始
```bash
# 1) 安装依赖
npm install

# 2) 本地开发
npm run dev
# 打开 http://localhost:3000

# 3) 代码检查（可选）
npm run lint

# 4) 生产构建（可选）
npm run build
# 运行生产包：
npm run start
```

> 目前无需额外环境变量；如后续增加 API / 域名配置，请在根目录创建 `.env.local` 并按需填写。

## 项目结构（摘要）
```
src/
  app/                # Next.js App Router 页面
    about/            # 关于页
    past-programs/    # 往期活动
    podcast/          # 播客
  components/
    sections/         # 页面区块组件（Hero, Volunteers 等）
    common/           # 通用组件（AppBar, Card, SectionContainer 等）
    about/            # 关于页专属组件（Header, Timeline, VolunteerAccordion）
  data/               # 文案与志愿者数据
  theme.ts            # MUI 主题配置
public/
  icons/ images/      # 静态资源
```

## 常用脚本
- `npm run dev`  本地开发
- `npm run lint`  ESLint 规则检查
- `npm run build`  生产构建
- `npm run start`  以生产模式启动（需先 build）

## 贡献
欢迎提交 Issue 或 PR，共同改进「她行」网站。如有设计或内容更新，请优先修改 `src/data` 下的文案数据，保持组件专注于展示。
