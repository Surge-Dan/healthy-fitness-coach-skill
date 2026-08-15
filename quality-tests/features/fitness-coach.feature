Feature: Healthy Fitness Coach quality gates
  The Skill must keep training data private, truthful, and useful for action

  Scenario: Cached Xunji reads do not duplicate a same-day request
    Given a local Xunji cache with no entry for 2026-08-01
    When the same training day is requested twice concurrently
    Then the upstream request count is 1

  Scenario: Annual heatmap stays inside its SVG viewport
    Given training dates spanning 2026-01-01 to 2026-12-31
    When an annual training heatmap is rendered
    Then every heatmap cell is inside the viewport

  Scenario: Write-back rejects mixed training dates
    Given write-back rows from two different dates
    When the write-back payload is validated
    Then validation fails before any network call
