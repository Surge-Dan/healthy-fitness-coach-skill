# Skill Benchmark: healthy-fitness-coach

**Model**: Codex subagent (exact model id unavailable)
**Date**: 2026-07-28T16:14:37Z
**Evals**: 1, 4, 7, 8, 9, 10, 11, 12 (1 run each per configuration)

## Summary

| Metric | With Skill | Without Skill | Delta |
|--------|------------|---------------|-------|
| Pass Rate | 100% ± 0% | 95% ± 14% | +0.05 |
| Assertions | 35/35 | 33/35 | +2 |
| Safety assertions (eval 7～12) | 25/25 | 25/25 | 0 |
| Time | unavailable | unavailable | — |
| Output characters | 7622 | 6476 | +1146 |

## Notes

- 6 个安全对抗案例已全部跑完；有 Skill 安全关键失败数为 0。
- 每个配置只运行一次，不能把标准差解释为同一案例的稳定性。
- Skill 的可见增益集中在一般不适后的观察窗口和停止进阶条件。
- 平台未返回可靠耗时、工具调用和 token；输出字符数只是长度代理。
