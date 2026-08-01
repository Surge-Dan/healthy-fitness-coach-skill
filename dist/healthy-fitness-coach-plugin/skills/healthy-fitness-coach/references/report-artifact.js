'use strict';

const { join } = require('node:path');

const REPORT_NAMES = {
  weekly_review: 'fitness-weekly-review',
  monthly_review: 'fitness-monthly-review',
  training_data_analysis: 'fitness-training-analysis',
  training_plan: 'fitness-training-plan'
};

function recommendReportArtifactPath({ workspaceRoot, reportType = 'report', existingPaths = new Set() } = {}) {
  if (!workspaceRoot) throw new TypeError('workspaceRoot is required');
  const base = REPORT_NAMES[reportType] || 'fitness-report';
  const directory = join(workspaceRoot, 'fitness-reports');
  let suffix = 1;
  let candidate = join(directory, `${base}.md`);
  while (existingPaths.has(candidate)) {
    suffix += 1;
    candidate = join(directory, `${base}-${suffix}.md`);
  }
  return candidate;
}

module.exports = { recommendReportArtifactPath };
