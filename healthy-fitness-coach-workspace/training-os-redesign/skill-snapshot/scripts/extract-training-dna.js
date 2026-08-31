'use strict';

const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { extractTrainingDNA } = require('../references/training-dna-engine.js');

function args(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) continue;
    const key = argv[index].slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    result[key] = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : true;
  }
  return result;
}

async function main(argv = process.argv.slice(2)) {
  const options = args(argv);
  if (!options.input) throw new Error('missing --input JSON file');
  const inputPath = path.resolve(String(options.input));
  const text = (await readFile(inputPath, 'utf8')).replace(/^\uFEFF/, '');
  const parsed = JSON.parse(text);
  const source = Array.isArray(parsed) ? { records: parsed } : (parsed || {});
  const dna = extractTrainingDNA({
    records: source.records,
    dateStart: options.dateStart || source.date_start,
    dateEnd: options.dateEnd || source.date_end,
    plannedSessionsPerWeek: source.planned_sessions_per_week,
    profile: source.profile
  });
  const output = JSON.stringify(dna, null, 2);
  if (options.output) await writeFile(path.resolve(String(options.output)), `${output}\n`, 'utf8');
  else process.stdout.write(`${output}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { args, main };
