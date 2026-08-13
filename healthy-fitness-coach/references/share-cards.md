# 分享图参考

分享图是社交媒体可读的叙事卡，不是把报告整页截图。每张图只突出一个主结论，配合最多3～5个指标。支持 `1:1`、`9:16`、`3:4`，默认不替用户生成未指定的额外比例。

SVG适合Markdown/HTML和二次编辑；需要可直接发布的PNG时使用：

```powershell
python .\healthy-fitness-coach\scripts\render-share-card.py `
  --input .\share-data.json `
  --output .\fitness-reports\share-card.png `
  --ratio 9:16
```

PNG渲染依赖Pillow（`python -m pip install Pillow`）。支持Windows微软雅黑、Linux Noto Sans CJK和`HEALTHY_FITNESS_FONT`自定义字体路径。

## 风格

- 预设：Night Performance、Editorial Training Journal、Raw Gym Contact Sheet、Clean Athletic。
- 自适应：用户上传照片后运行 `scripts/extract-style.py`，将输出传给 `references/visuals.js` 的 `createStyleToken`，生成 My Visual DNA。
- 适配：可用自然语言覆盖色彩、纹理、留白或文字安全区；低置信度字段回退预设值。

## 照片

本地先做主体保护裁切和数据排版；具备图像生成能力时，只增强氛围、材质和光影。数字、日期、重量和次数必须由本地渲染，避免图像模型写错。只有用户明确要求把照片放入分享图时，PNG/SVG才会保留照片像素；分析报告默认不嵌入原图。不得复制水印、Logo、品牌字体或具体作品构图。
