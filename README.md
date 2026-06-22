# Framewise Live Preview

Figma 选中画板后，将它导出为 PNG 并实时推送到 iPhone 的 PWA 预览器。第一版刻意采用“渲染图预览”，以获得最稳定的跨屏幕尺寸检查；它不代替 Figma Prototype 的点击交互。

## 项目结构

- `figma-plugin/`：可在 Figma Desktop 开发模式加载的插件。
- `relay/`：会话、鉴权和 Server-Sent Events 实时推送服务。
- `mobile/`：可部署为静态站点、可添加至 iPhone 主屏幕的预览器。

## 本地开发与部署顺序

1. 此项目根目录包含 `Dockerfile` 和 `render.yaml`。推送至 GitHub 后，可在 Render 中从仓库创建 Blueprint；服务健康检查为 `/health`，手机端由同一服务的 `/mobile/` 托管。也可使用任意支持 Docker 与 HTTPS 的平台。
2. 得到部署 URL 后，运行：`python3 scripts/configure-domain.py https://你的服务域名`。它会同时更新 Figma 的网络白名单与插件默认地址。
3. 在 Figma Desktop 选择 **Plugins → Development → Import plugin from manifest…**，选择 `figma-plugin/manifest.json`。
4. 将 `mobile/` 发布到同一 HTTPS 域名的 `/mobile/` 路径（或任意静态托管服务）。在插件里创建会话，手机打开它显示的链接；链接里含查看密钥，请勿公开分享。

## 现在的行为

- 仅接收当前页直接选中的一个 Frame、组件、实例、Section 或 Group。
- 切换选择或停止编辑约 450ms 后，插件以 2× PNG 同步。
- 会话码是 6 位十六进制；发布者令牌只保存在 Figma 插件，手机只使用独立查看密钥。

## 上线前建议

- 把内存会话存储改为 Redis 或数据库，并加 30 分钟的自动过期。
- 把 base64 图像改为对象存储 URL，减少实时通道的内存压力。
- 为会话创建加上用户登录、速率限制与域名白名单。
