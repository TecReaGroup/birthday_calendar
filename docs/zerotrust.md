# zerotrust.md

可以。你这个场景建议用 **Cloudflare Access** 给 Pages 站点加一层登录门禁，登录方式同时开放 **Google** 和 **One-time PIN**。

## **推荐配置路径**

1. 进入 Cloudflare Dashboard  
   `Zero Trust > Integrations > Identity providers`

2. 添加登录方式：
   - `Google`：适合普通 Gmail / Google 账号登录，但不能读取 Google Workspace 组织/群组。
   - `Google Workspace`：适合企业域名邮箱，可按 Workspace 域名、群组做策略。
   - `One-time PIN`：用户输入邮箱，Cloudflare 发一次性验证码。PIN 单次有效，官方文档说明验证码 10 分钟过期。

3. 进入：  
   `Zero Trust > Access controls > Applications`

4. 创建应用：
   - 选择 `Self-hosted and private`
   - Public hostname 填你的 Pages 自定义域名，例如 `birthdays.example.com`
   - Session Duration 按需求设置，比如 `24h`、`7d`

5. 添加 Access Policy：
   - Action: `Allow`
   - Include 可以选：
     - `Emails`：只允许指定邮箱
     - `Emails ending in`：比如 `@gmail.com` 或公司域名
     - `Google Groups`：只有 Google Workspace 集成才适合用
   - Login methods 勾选 `Google` 和 `One-time PIN`

## **关键注意点**

如果你只是用了 `xxx.pages.dev`，Cloudflare Pages 的 “Enable access policy” 默认主要保护 preview deployments，不一定覆盖生产 `xxx.pages.dev` 和自定义域名。官方 Pages 文档特别说明：如果要保护 `*.pages.dev` 生产域名和 custom domain，需要到 Access 应用里分别配置 public hostname。

更稳妥的做法是：

- 给 Pages 绑定一个自定义域名
- 对这个自定义域名创建 Access application
- 把 `xxx.pages.dev` 重定向到自定义域名，避免绕过登录访问

## **Google vs PIN 的使用建议**

如果只是自己或少数朋友访问：

- 用 `One-time PIN + 指定邮箱列表` 最简单
- 不需要 Google Cloud 项目配置
- 适合私有生日日历这种轻量站点

如果你希望用 Google 登录体验：

- 普通 Google：仍然要在 Google Cloud Console 配 OAuth
- Google Workspace：适合公司/组织邮箱，并可按群组授权

## **我的建议**

你的项目是静态 Pages 站点，最实用配置是：

`自定义域名 + Cloudflare Access Self-hosted app + Allow 指定邮箱 + 启用 Google 和 One-time PIN`

这样用户访问页面前会先看到 Cloudflare Access 登录页，通过 Google 或邮箱 PIN 后才能进入站点，代码本身不需要改。  
参考：Cloudflare Access self-hosted app、Pages preview access、Google IdP、One-time PIN 官方文档。

这里 **App ID 不能填 Gmail 地址**。它要填 Google Cloud 里 OAuth Client 的 **Client ID**，格式通常像：

```text
1234567890-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

按这个填：

```text
Name:
Google
```

```text
App ID:
填写 Google Cloud Console 生成的 OAuth Client ID
```

```text
Client secret:
填写同一个 OAuth Client 生成的 Client secret
```

```text
PKCE:
先保持 OFF
```

你需要先去 Google Cloud Console 创建 OAuth Client：

1. 打开 `Google Cloud Console > APIs & Services > OAuth consent screen`
2. 如果是个人 Gmail，Audience 选 `External`
3. 再到 `APIs & Services > Credentials`
4. `Create credentials > OAuth client ID`
5. Application type 选 `Web application`
6. 填这两个 Cloudflare 回调地址：

```text
Authorized JavaScript origins:
https://你的-team-name.cloudflareaccess.com
```

```text
Authorized redirect URIs:
https://你的-team-name.cloudflareaccess.com/cdn-cgi/access/callback
```

`你的-team-name` 在 Cloudflare Zero Trust 里看：

```text
Settings > Team name and domain
```

创建完成后，Google 会显示：

```text
Client ID
Client secret
```

把 `Client ID` 填到你截图里的 `App ID`，把 `Client secret` 填到 `Client secret`。

另外，真正限制谁能访问不是在这个 Google IdP 页面里做，而是在后面的 Access Application Policy 里做。比如只允许你自己：

```text
Include > Emails > roupertrg@gmail.com
```

否则 Google 登录方式配置好了，也可能允许策略范围内的其他 Google 用户进入。
