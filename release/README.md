# 线束成本核算工作台 - Release

本文件夹包含了项目的最新编译产物，可用于直接部署。

## 目录说明

- `frontend-build/` 
  - 这是前端应用编译后的纯静态资源文件（对应 `app/dist` 目录）。
  - **如何部署**：将该文件夹下的所有内容（`index.html`，`assets/`等）上传至任何静态 Web 服务器（如 Nginx, Vercel, Cloudflare Pages, 或阿里云 OSS）即可直接运行访问。
- `harness-cost-workbench-build-v1.0.zip`
  - `frontend-build/` 文件夹的压缩包，方便您直接下载或发送给相关人员部署。

## 运行方式（本地预览）
如果想在本地直接预览该发布版本，您可以：
1. 安装 http-server：`npm install -g http-server`
2. 进入 `frontend-build` 目录
3. 运行 `http-server`
4. 在浏览器中打开提示的本地地址

> 注意：因为是单页应用（SPA），如果在 Nginx 部署，请确保配置了 URL 重写规则，将所有路由 fallback 到 `index.html`。
