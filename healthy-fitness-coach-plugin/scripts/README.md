# Plugin maintenance

发布前请在仓库根目录执行Skill测试、MCP测试、Python语法检查和打包校验；本目录脚本只负责运行时连接器与视觉导出，不依赖隐藏的测试脚本。

The optional visual helpers are local-only: `render-visual-assets.js` writes SVG report/share assets and `render-share-card.py` writes PNG cards. The latter requires Pillow and accepts `1:1`, `9:16`, or `3:4`. Photo cards support `abstract-collage`, `training-editorial`, and `material-poster`; no-photo reports use `data-atlas` with five selectable palettes. Use `node scripts/render-visual-assets.js --list-modes --has-photo` or `node scripts/render-visual-assets.js --list-palettes` to list choices. To embed a local photo in an SVG explicitly, pass `--photo <path> --embed-photo`; without `--embed-photo`, the photo is not persisted into the exported SVG.
