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

### 数据持久化说明

当前生日数据保存在浏览器的 `localStorage` 中。部署到 Cloudflare 后，数据仍然只保存在当前用户的当前浏览器里：

- 刷新页面后数据会保留
- 关闭浏览器再打开通常会保留
- 更换浏览器或设备后不会同步
- 清理浏览器数据后会丢失

如果需要多设备同步或云端持久化，需要增加后端接口，并接入 Cloudflare D1、KV 或其他数据库。
