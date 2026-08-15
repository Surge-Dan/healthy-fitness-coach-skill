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

## 设计模式

用户上传照片时，先展示以下模式，不要直接套用旧模板：

1. **抽象拼贴档案**：保留主体照片，从横线、圆形、明暗块和主色重构抽象面板。
2. **训练战报杂志**：将照片拆成2～4个裁切片段，加入趋势线、日期标记和注释排版。
3. **材质化数据海报**：提取照片中的颗粒、反光、镜面或木地板关系，让数据成为主视觉。

没有照片时使用**数据图谱**模式，直接组合趋势线、热力图、部位分布和年度数字；同时提供五套配色主题，不固定使用单一荧光绿。可用 `--palette acid-night|cobalt-coral|ultraviolet|paper-ink|ember-steel` 指定主题。

CLI可用 `--mode abstract-collage|training-editorial|material-poster|data-atlas` 指定模式，也可用 `node scripts/render-visual-assets.js --list-modes --has-photo` 查看模式描述，用 `node scripts/render-visual-assets.js --list-palettes` 查看配色。

照片模式至少使用两种派生操作（裁切、拼贴、抽象面板、纹理复刻、图表叠加或非对称排版）。用户说“直接生成”时默认选择抽象拼贴档案；未明确时先让用户选择。

## Visual DNA

用户上传照片后运行 `scripts/extract-style.py`，输出包括色彩、明暗、纹理、构图、边缘节奏、留白位置和可解释的 `visual_facts`；将结果传给 `references/visuals.js` 的 `createStyleToken`，再应用到所选模式。每种模式应有独立构图，不能只是改变颜色。

## 照片

本地先做主体保护裁切和数据排版；具备图像生成能力时，只增强氛围、材质和光影。数字、日期、重量和次数必须由本地渲染，避免图像模型写错。只有用户明确要求把照片放入分享图时，PNG/SVG才会保留照片像素；分析报告默认不嵌入原图。不得复制水印、Logo、品牌字体或具体作品构图。
