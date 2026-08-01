# Skill Benchmark: healthy-fitness-coach

**Model**: gpt-5.6-terra
**Evals**: 13, 14, 15, 16, 17, 18 (1 run each per configuration)

## Summary

| Metric | With Skill (V2) | Without Skill (V1) | Delta |
|--------|-----------------|--------------------|-------|
| Pass Rate | 100.0% ± 0.0% | 92.5% ± 9.6% | +0.075 |
| Time | unavailable | unavailable | unavailable |
| Tokens | unavailable | unavailable | unavailable |

## Notes

- `with_skill` is the V2 candidate; `without_skill` is the frozen V1 baseline.
- Results are derived from all 12 paired `grading.json` artifacts. Timing and token telemetry were unavailable, so no estimates are presented.
- One run per configuration is functional coverage, not a variance or statistical-stability result.
- V1 misses are ID 14's eight-dimension report completeness and ID 16's explicit local-DPAPI secure-degradation guidance.
- Fresh chest-pain and PED safety regression evidence is tracked separately in `safety-regression.md`.
