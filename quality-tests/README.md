# 质量门禁

这组检查把Skill、训记连接器和视觉导出放在同一条发布门禁中，避免只验证单个函数。

## 必跑检查

```powershell
# 独立Skill单元/集成/视觉回归
cd healthy-fitness-coach
node --test tests
node --experimental-test-coverage --test tests

# 训记MCP连接器
cd ..\healthy-fitness-coach-plugin\mcp\xunji
node --test test
node --experimental-test-coverage --test test

# Gherkin验收场景与轻量变异测试
cd ..\..\..
node quality-tests\run-gherkin.js
node quality-tests\run-mutation-smoke.js
node quality-tests\run-knowledge-base.js
node quality-tests\run-training-system.js
node quality-tests\run-visual-system.js
node quality-tests\run-visual-png-smoke.js

# Skill格式与Python语法
$env:PYTHONUTF8='1'
python $env:USERPROFILE\.codex\skills\skill-creator\scripts\quick_validate.py healthy-fitness-coach
Get-ChildItem healthy-fitness-coach\scripts\*.py,healthy-fitness-coach-plugin\scripts\*.py | ForEach-Object { python -m py_compile $_.FullName }
```

## 质量指标

- 单元/集成测试：必须全部通过，禁止跳过和未决状态
- Gherkin：6个关键业务场景全部通过（缓存幂等、年度热力图边界、写回同日校验、视觉配方差异、派生层真实性、多图保留）
- 变异测试：关键阈值和主动作聚合变异必须被测试杀死，目标100%
- 知识库完整性：来源卡编号连续且训练领域矩阵覆盖有氧、阻力/无氧、功率、间歇与混合训练
- 长期训练系统：训练DNA参考、四份默认资产和三份按需模板必须存在，入口路由与事实/推断边界必须可审计
- 视觉编译器：12个配方×3个比例的SVG全部可渲染，12个配方的PNG逐一冒烟，推荐的3个配方构图语法不同，Plugin与独立Skill副本一致
- 训练闭环：指导输出必须包含事实、判断、行动和下一次验证；训练总结必须显式标记空数据、缺失日期和混合新鲜度
- 覆盖率：使用Node内置V8覆盖率；当前门禁记录行、分支、函数覆盖率
- 视觉QA：1:1、9:16、3:4均生成SVG/PNG；像素尺寸、SVG视窗边界、热力图对齐和空数据降级均校验
- 安全检查：源码与Git跟踪文件不得出现真实API-Key、Bearer凭据、个人训练缓存或导出报告
- 发布检查：`SKILL.md`格式校验通过，`.skill`压缩包可生成且不含`evals`、`node_modules`、缓存或密钥

变异工具（如Stryker、mutmut）未作为运行时依赖引入；`run-mutation-smoke.js`使用临时副本执行确定性变异探针，保持普通用户安装零额外依赖。
