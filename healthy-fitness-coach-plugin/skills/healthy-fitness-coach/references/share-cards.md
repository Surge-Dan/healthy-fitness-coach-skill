# 分享图参考

分享图支持1:1、9:16、3:4。用户上传照片时可用仓库根目录 `healthy-fitness-coach/scripts/extract-style.py` 提取抽象视觉信号，再生成My Visual DNA；不上传照片时使用数据图谱并提供五套配色（acid-night、cobalt-coral、ultraviolet、paper-ink、ember-steel）。数据文字由本地渲染器叠加，图像生成失败时回退到本地排版。

数据图谱提供两种完全不同的布局：`rich` 信息图使用中文衬线标题、米白纸张、细边框和编辑部网格，强化标题/正文间距、趋势/热力/雷达/部位分布，适合月报和年报；`minimal` 极简分享图切换为深色艺术海报，使用超大衬线数字、非对称几何色块和稀疏信息，不复用信息图卡片结构，适合社交分享。CLI使用 `--layout rich|minimal` 指定。
