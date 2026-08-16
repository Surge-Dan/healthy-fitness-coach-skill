# 分享图与视觉编译器

分享图不是报告截图，也不是“照片外框+指标卡”。先按输入路由，再把照片事实或训练数据编译成有来源的视觉母题。支持`1:1`、`3:4`、`9:16`，只生成用户指定或当前场景需要的比例。

## 输入路由

- 单张照片：默认推荐3个结构不同的配方，优先原图×派生艺术层的双联、分镜或小志。
- 多张照片：优先训练故事板、漫画分镜或不规则拼贴；每张原图都要保留且可辨认。
- 照片+训练数据：照片负责叙事，数字和图表由本地渲染器负责。
- 无照片：输出数据图谱、训练年轮、肌群星座、力量地形或动作指纹。

用户点名风格时直接执行；用户只说“做一张分享图”时使用`references/visual-dna.js`推荐3个配方并解释差异。用户说“直接生成”时自动采用排名第一的配方。

## 照片配方

| ID | 中文名 | 构图语法 | 适用输入 |
| --- | --- | --- | --- |
| `sketch-diptych` | 原图×运动速写 | 左右或上下双联，原图与手绘派生层并置 | 单图、照片+数据 |
| `motion-comic` | 训练漫画分镜 | 1个主画面+2个局部画面+运动轨迹 | 单图/多图 |
| `risograph-zine` | 双色训练小志 | 网点、双色套印偏移、纸张质感 | 单图/多图 |
| `symbol-lab` | 健身符号实验室 | 原图与可追溯器械符号并置 | 单图、照片+数据 |
| `minimal-trajectory` | 极简身体轨迹 | 全幅原图、高留白、单一运动路径 | 单图 |
| `multi-photo-storyboard` | 多图训练故事板 | 按动作或时间组织2～6张照片 | 多图 |

图像模型只生成手绘、卡通、纹理、剪影碎片、速度线或抽象符号等“派生艺术层”；不生成中文、数字、图表、Logo或训练成绩。原图由本地合成器作为独立图层保留，失败时用本地线稿和几何母题回退。

## 无照片配方

- `data-atlas`：信息丰富图谱，强调趋势、全年热力、部位分布和主动作表现。
- `training-rings`：把周频率、训练量和连续性编码成同心年轮。
- `muscle-constellation`：把训练部位和容量编码成节点网络。
- `strength-terrain`：把周/月训练量编码成等高线和力量地形。
- `action-fingerprint`：把动作分布和节奏编码成个人指纹。

无照片的配方必须改变构图骨架和图形语法，不能只是切换配色。无数据时显示“暂无数据”，不得生成默认年份、训练天数或虚假热力。

## Visual DNA2.0

先运行本地提取器：

```powershell
python .\healthy-fitness-coach\scripts\extract-style.py .\photo.jpg
```

输出只包含尺寸、比例、分区色板、明暗、对比、纹理、边缘节奏、视觉重心、留白和安全文字区，不做人脸识别、身份推断或身体评价。Agent可基于已看到的照片补充`ring_light:top_center`、`mirror:background`、`barbell_plate:foreground`等语义事实。

编译设计简报：

```powershell
node .\healthy-fitness-coach\scripts\compile-visual-brief.js `
  --input .\visual-input.json `
  --output .\fitness-reports\visual-manifest.json
```

Manifest包含输入路由、视觉DNA、可追溯母题、3个推荐配方、派生层Prompt和真实性约束。每个母题都必须指向一个照片事实或训练数据字段。

## 本地合成

派生层生成后，把其路径写入`derived_image`；照片路径写入`photos`数组：

```powershell
python .\healthy-fitness-coach\scripts\render-visual-composition.py `
  --input .\composition.json `
  --output .\fitness-reports\share-card.png `
  --ratio 3:4
```

旧版`render-share-card.py`与`render-visual-assets.js`继续用于兼容的报告图和旧模式。新照片创作优先使用视觉编译器与`render-visual-composition.py`。

## 质量与隐私

- 360px缩略图仍能读懂主视觉和标题；安全边距内不得溢出。
- 真实数据、日期、重量和次数只由本地渲染器叠加。
- 原图、派生图、Manifest和报告默认写入`fitness-reports/`，不得提交仓库。
- 不复制具体作品构图、品牌字体、水印或Logo；只借鉴抽象设计原则。
- 只有用户明确要求照片分享图时才在产物中保留照片像素。
