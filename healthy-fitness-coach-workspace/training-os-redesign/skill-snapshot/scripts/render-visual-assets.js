'use strict';

const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { extname, join, resolve } = require('node:path');
const { buildVisualReportAssets } = require('../references/visual-report.js');
const { createStyleToken, getColorOptions, getDesignModeOptions, overrideStyleToken, renderShareCardSvg } = require('../references/visuals.js');

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
  const layout = argument('--layout', 'minimal');
  const palette = argument('--palette');
  const photoPath = argument('--photo');
  const embedPhoto = process.argv.includes('--embed-photo');
  if (!inputPath) throw new Error('--input JSON path is required');
  const payload = JSON.parse((await readFile(resolve(inputPath), 'utf8')).replace(/^\uFEFF/, ''));
  const localPhoto = photoPath || payload.share?.photo;
  await mkdir(outputDir, { recursive: true });
  const reportAssets = buildVisualReportAssets({ trends: payload.trends || {} });
  for (const asset of reportAssets) await writeFile(join(outputDir, asset.name), asset.svg, 'utf8');
  if (payload.share) {
    const svg = renderShareCardSvg({
      ...payload.share,
      ratio,
      layout: payload.share.layout || layout,
      mode: mode || payload.share.mode,
      styleToken: palette
        ? overrideStyleToken(payload.share.styleToken || createStyleToken(payload.share.styleSignals || payload.styleSignals || {}), { palette: createStyleToken({ theme: palette }).palette, theme: palette })
        : (payload.share.styleToken || createStyleToken({ ...(payload.share.styleSignals || payload.styleSignals || {}) })),
      ...(localPhoto ? { photoHref: `data:image/${extname(localPhoto).toLowerCase() === '.png' ? 'png' : extname(localPhoto).toLowerCase() === '.webp' ? 'webp' : 'jpeg'};base64,${(await readFile(resolve(localPhoto))).toString('base64')}`, embedPhoto: embedPhoto || payload.share.embedPhoto === true } : {}),
      trendPoints: payload.share.trendPoints || (payload.trends?.weekly || []).map((item) => ({ label: item.week_start, value: item.training_days })),
      trainingDates: payload.trends?.training_dates || [],
      dailyStats: payload.trends?.daily || [],
      dateStart: payload.trends?.date_start,
      dateEnd: payload.trends?.date_end,
      bodyDistribution: (payload.trends?.exercise_frequency || []).map((item) => ({ label: item.name, value: item.count }))
    });
    await writeFile(join(outputDir, `share-card-${ratio.replace(':', '-')}.svg`), svg, 'utf8');
  }
  process.stdout.write(JSON.stringify({ output: outputDir, report_assets: reportAssets.map((asset) => asset.name), share_ratio: payload.share ? ratio : null }));
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
