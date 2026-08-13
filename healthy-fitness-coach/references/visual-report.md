# 可视化报告参考

报告图表应服务于结论，不把完整仪表盘缩小到一张图。默认输出四类视觉：

1. 周/月训练频率趋势。
2. 周/月估算训练量趋势，并明确“估算”与混合动作不可直接比较。
3. 训练主题或部位分布。
4. 主动作重量/次数轨迹；只有同动作、相近器械和相近次数区间才可比较。

使用 `scripts/render-visual-assets.js`，输入 JSON 至少包含 `trends.weekly` 和 `trends.exercise_frequency`：

```powershell
node .\healthy-fitness-coach\scripts\render-visual-assets.js `
  --input .\trend-data.json `
  --output .\fitness-reports\assets `
  --ratio 3:4
```

生成的 SVG 是确定性、可嵌入 Markdown/HTML 的本地资源；不要将个人报告资源提交到公开仓库。
