'use strict';

const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { join, resolve } = require('node:path');
const skillReferences = '../skills/healthy-fitness-coach/references';
const { buildVisualReportAssets } = require(`${skillReferences}/visual-report.js`);
const { createStyleToken, getColorOptions, getDesignModeOptions, renderShareCardSvg } = require(`${skillReferences}/visuals.js`);

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function main() {
  if (process.argv.includes('--list-modes')) {
    const hasPhoto = process.argv.includes('--has-photo');
    process.stdout.write(JSON.stringify(getDesignModeOptions({ hasPhoto })));
    return;
  }
  if (process.argv.includes('--list-palettes')) {
    process.stdout.write(JSON.stringify(getColorOptions()));
    return;
  }
  const inputPath = argument('--input');
  const outputDir = resolve(argument('--output', 'fitness-reports/assets'));
  const ratio = argument('--ratio', '3:4');
  const mode = argument('--mode');
  const palette = argument('--palette');
  if (!inputPath) throw new Error('--input JSON path is required');
  const payload = JSON.parse(await readFile(resolve(inputPath), 'utf8'));
  await mkdir(outputDir, { recursive: true });
  const reportAssets = buildVisualReportAssets({ trends: payload.trends || {} });
  for (const asset of reportAssets) await writeFile(join(outputDir, asset.name), asset.svg, 'utf8');
  if (payload.share) {
    const svg = renderShareCardSvg({
      ...payload.share,
      ratio,
      mode: mode || payload.share.mode,
      styleToken: payload.share.styleToken || createStyleToken({ ...(payload.share.styleSignals || payload.styleSignals || {}), ...(palette ? { theme: palette } : {}) }),
      trendPoints: payload.share.trendPoints || (payload.trends?.weekly || []).map((item) => ({ label: item.week_start, value: item.training_days })),
      trainingDates: payload.trends?.training_dates || []
    });
    await writeFile(join(outputDir, `share-card-${ratio.replace(':', '-')}.svg`), svg, 'utf8');
  }
  process.stdout.write(JSON.stringify({ output: outputDir, report_assets: reportAssets.map((asset) => asset.name), share_ratio: payload.share ? ratio : null }));
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
