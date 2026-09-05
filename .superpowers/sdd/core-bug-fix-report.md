# Core bug fix report

Scope: close the final review blockers in the fitness workflow without touching dist artifacts.

## Fixed

1. Program changes now rebuild derived session structure after budget/progression edits.
   - `selectProgramChanges()` refreshes `session_slots`, `session_budget.sets_per_slot`, and `current_program`.
   - Regression coverage confirms the next program reflects the changed movement-slot and progression rules.

2. Review fact derivation now treats bad comparison evidence as non-comparable.
   - Duplicate `source_record_id` values are rejected as independent evidence.
   - RIR/RPE conflicts downgrade comparability.
   - Same exercise with different equipment is marked non-comparable.

3. DNA comparison now preserves direction.
   - `completePerformanceComparison()` keeps `direction`.
   - Downward evidence now survives into counterevidence instead of becoming `unknown`.

4. The tracked workspace snapshot no longer contains a real WeChat path.
   - The render-share PNG fixture test now uses synthetic paths only.

5. Xunji MCP DNA extraction now goes through a review-first evidence gate.
   - The DNA branch now standardizes review facts and decisions before extraction.
   - Incomplete evidence stays below `supported/high`.
   - Trend aggregation remains available through the trend path.

## Validation

- `node --test healthy-fitness-coach\\tests\\review-decision-engine.test.js healthy-fitness-coach\\tests\\training-dna.test.js healthy-fitness-coach-workspace\\training-os-redesign\\skill-snapshot\\tests\\render-share-png.test.js healthy-fitness-coach-plugin\\mcp\\xunji\\test\\trends.test.js healthy-fitness-coach-plugin\\mcp\\xunji\\test\\server.test.js`
- `node --test healthy-fitness-coach\\tests`

Both passed.

## Notes

- I kept the existing release/doc changes in the worktree untouched and did not modify dist.
- Plugin reference copies were synced where the MCP service depends on them, so the review-first gate is consistent end to end.
