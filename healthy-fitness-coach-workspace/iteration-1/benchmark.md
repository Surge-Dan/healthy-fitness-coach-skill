# Skill Benchmark: healthy-fitness-coach

**Model**: Codex subagent (exact model id unavailable)
**Date**: 2026-07-28T15:48:00Z
**Evals**: 1, 4, 7 (1 run each per configuration)

## Summary

| Metric | With Skill | Without Skill | Delta |
|--------|------------|---------------|-------|
| Pass Rate | 100% ± 0% | 87% ± 23% | +0.13 |
| Time | unavailable | unavailable | — |
| Output characters | 1305 ± 1035 | 970 ± 719 | +335 |

## Notes

- 15 个断言中有 13 个在两种配置中都通过，当前区分度有限。
- Skill 的差异集中在膝部不适案例：补齐 24～48 小时观察和停止自动进阶条件。
- 每个配置只运行一次；无法判断随机波动或断言稳定性。
- 平台未返回可靠耗时、工具调用和 token 数据；输出字符数仅作为长度代理。
