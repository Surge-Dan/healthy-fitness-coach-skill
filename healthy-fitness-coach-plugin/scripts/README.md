# Plugin maintenance

The deterministic Plugin validation and Skill-copy hash check live in `../../tests/validate_plugin.ps1` so they can validate both source and `dist` without becoming runtime MCP behavior.

The optional visual helpers are local-only: `render-visual-assets.js` writes SVG report/share assets and `render-share-card.py` writes PNG cards. The latter requires Pillow and accepts `1:1`, `9:16`, or `3:4`. Photo cards support `abstract-collage`, `training-editorial`, and `material-poster`; no-photo reports use `data-atlas` with five selectable palettes. Use `node scripts/render-visual-assets.js --list-modes --has-photo` or `node scripts/render-visual-assets.js --list-palettes` to list choices.
