# Fillmate · 共享内容填充

一个独立的 Figma 开发插件，用于从共享素材库联动填充图片和文字。

## 安装

在 Figma Desktop 中打开 **Plugins → Development → Import plugin from manifest…**，选择本目录的 `manifest.json`。

## 使用

1. 在画布中同时选中一个封面/头像图层和对应的剧名/演员名文本图层。
2. 在插件内选择“短剧封图”或“演员头像”，再点击素材卡片。
3. 插件会将该卡片的图片填入选中图层，并将同名文字填入所有选中的文本图层。

素材由 GitHub 的公开素材目录提供，图片会在填充时嵌入当前 Figma 文件。默认素材库地址为 `https://raw.githubusercontent.com/tantan1994/framewise-live-preview/main/shared-library`；在插件的“素材库连接设置”中可以改为其他同样格式的 GitHub 素材目录。
