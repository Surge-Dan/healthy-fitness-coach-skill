# Plugin maintenance

发布前请在仓库根目录执行Skill测试、MCP测试、Python语法检查和打包校验；本目录脚本只负责运行时连接器与视觉导出，不依赖隐藏的测试脚本。

脚本全部在本地运行：`extract-style.py`提取Visual DNA2.0，`compile-visual-brief.js`生成输入路由、3个设计配方和派生层Prompt，`render-visual-composition.py`合成新照片创作PNG；`render-visual-assets.js`和`render-share-card.py`保留旧版SVG/PNG报告兼容。`extract-training-dna.js`仅消费复盘 facts + decision；只有显式传入`--legacy-raw`时才读取原始训练行。视觉脚本依赖Pillow，首次使用前运行`python -m pip install pillow`，支持`1:1`、`3:4`和`9:16`。个人照片、Manifest和报告只应写入本地输出目录，不要提交仓库。
