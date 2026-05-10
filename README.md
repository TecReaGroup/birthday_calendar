# Birthday Calendar

这是一个基于 Vite + React 的生日日历项目。

## 环境要求

- Node.js 18 或更高版本
- npm

## 安装依赖

首次运行项目时，在项目根目录执行：

```bash
npm install
```

## 启动开发环境

安装依赖后执行：

```bash
npm run dev
```

启动成功后，终端会显示本地访问地址，通常是：

```text
http://localhost:5173
```

在浏览器中打开该地址即可查看项目。

## 构建生产版本

```bash
npm run build
```

## 本地预览生产构建

```bash
npm run preview
```

## 部署到 Cloudflare

本项目可以部署到 Cloudflare Workers Static Assets。项目根目录已经包含 `wrangler.jsonc`，其中指定了构建产物目录：

```jsonc
{
  "name": "birthday-calendar",
  "compatibility_date": "2026-05-10",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

其中：

- `directory` 表示 Vite 构建后的输出目录，默认是 `dist`
- `not_found_handling` 用于支持 React 单页应用刷新页面时仍然返回 `index.html`

### 手动部署

首次部署前需要登录 Cloudflare：

```bash
npx wrangler login
```

然后执行：

```bash
npm run deploy
```

该命令会先执行：

```bash
npm run build
```

生成 `dist` 目录，然后通过：

```bash
npx wrangler deploy
```

部署到 Cloudflare。

### 通过 GitHub 自动部署

将项目推送到 GitHub 后，在 Cloudflare 中连接该仓库。

如果 Cloudflare 页面只有 `Deploy command`，没有 `Output folder`，请填写：

```bash
npm run deploy
```

或者直接填写：

```bash
npm run build && npx wrangler deploy
```

Cloudflare 会根据项目根目录的 `wrangler.jsonc` 自动读取 `assets.directory`，并上传 `dist` 目录。

## Cloudflare D1 数据持久化

项目现在通过 Cloudflare Worker API + D1 保存生日数据：

- 前端请求 `/api/birthdays`
- Worker 入口文件是 `worker/index.js`
- D1 表结构在 `migrations/0001_create_birthdays.sql`
- `localStorage` 只作为本地备份和首次迁移来源

### 1. 登录 Cloudflare

```bash
npx wrangler login
```

### 2. 创建 D1 数据库

```bash
npx wrangler d1 create birthday-calendar
```

命令会输出类似下面的配置：

```jsonc
{
  "binding": "birthday_calendar",
  "database_name": "birthday-calendar",
  "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

把输出里的 `database_id` 填到 `wrangler.jsonc`，替换：

```text
REPLACE_WITH_YOUR_D1_DATABASE_ID
```

### 3. 应用数据库迁移

本地开发数据库：

```bash
npx wrangler d1 migrations apply birthday-calendar --local
```

Cloudflare 远程数据库：

```bash
npx wrangler d1 migrations apply birthday-calendar --remote
```

### 4. 本地用 Worker 验证

由于 API 运行在 Cloudflare Worker 中，验证 D1 功能时建议使用 Wrangler，而不是只运行 Vite dev server。

```bash
npm run build
npx wrangler dev
```

打开 Wrangler 输出的本地地址，通常是：

```text
http://localhost:8787
```

### 5. 部署

```bash
npm run deploy
```

该命令会先构建 Vite 静态资源，再通过 `wrangler deploy` 部署 Worker、静态资源和 API。

### 6. 私有访问建议

如果只是个人使用，建议在 Cloudflare Zero Trust / Access 中为这个域名开启访问控制，只允许你的邮箱登录访问。不要把访问 token 写进前端代码。
