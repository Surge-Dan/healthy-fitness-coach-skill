'use strict';

const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { join, resolve } = require('node:path');
const { buildVisualReportAssets } = require('../references/visual-report.js');
const { createStyleToken, renderShareCardSvg } = require('../references/visuals.js');

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function main() {
  const inputPath = argument('--input');
  const outputDir = resolve(argument('--output', 'fitness-reports/assets'));
  const ratio = argument('--ratio', '3:4');
  if (!inputPath) throw new Error('--input JSON path is required');
  const payload = JSON.parse(await readFile(resolve(inputPath), 'utf8'));
  await mkdir(outputDir, { recursive: true });
  const reportAssets = buildVisualReportAssets({ trends: payload.trends || {} });
  for (const asset of reportAssets) await writeFile(join(outputDir, asset.name), asset.svg, 'utf8');
  if (payload.share) {
    const svg = renderShareCardSvg({
      ...payload.share,
      ratio,
      styleToken: createStyleToken(payload.share.styleSignals || payload.styleSignals || {})
    });
    await writeFile(join(outputDir, `share-card-${ratio.replace(':', '-')}.svg`), svg, 'utf8');
  }
  process.stdout.write(JSON.stringify({ output: outputDir, report_assets: reportAssets.map((asset) => asset.name), share_ratio: payload.share ? ratio : null }));
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
