'use strict';

function compileDerivedLayerPrompt({ recipe = {}, visualDNA = {}, motifs = [], ratio = '3:4', photoCount = 1 } = {}) {
  const facts = (visualDNA.observed_facts || []).slice(0, 12);
  const palette = (visualDNA.palette || []).slice(0, 6);
  const trace = motifs.map((motif) => `${motif.id} <= ${motif.source?.value || motif.source?.type || 'unknown'}`);
  const prompt = [
    'Create a derived art layer for a fitness social artwork.',
    `Recipe: ${recipe.name || recipe.id || 'custom'} (${recipe.derived_style || 'contemporary fitness editorial art'}).`,
    `Target ratio: ${ratio}. Source image count: ${photoCount}.`,
    `Observed source facts only: ${facts.length ? facts.join('; ') : 'no semantic photo facts supplied'}.`,
    `Palette cues: ${palette.length ? palette.join(', ') : 'derive restrained colors from the supplied source'}.`,
    `Traceable fitness motifs: ${trace.length ? trace.join('; ') : 'none; use abstract training rhythm only'}.`,
    'Generate only the derived art layer: sketch, cartoon, texture, silhouette fragments, motion strokes or abstract motifs.',
    'Do not recreate, replace, beautify, rate or alter the identifiable person. The original photo is composited separately.',
    'No text. No letters. No numbers. No charts. No logos. No watermarks. No invented equipment, records, muscles or achievements.',
    'Keep the background transparent when supported; otherwise use a flat plain background sampled from the supplied palette.',
    'Every visible motif must be traceable to an observed photo fact or supplied training-data field.'
  ].join('\n');
  return {
    schema_version: '1.0',
    prompt,
    preservation: { original_photo: recipe.preservation || (photoCount ? 'high' : 'none'), identity: 'locked', training_data: 'local-render-only' },
    output: { role: 'derived-art-layer', transparent_or_plain_background: true, contains_text: false, contains_metrics: false },
    traceability: trace
  };
}

module.exports = { compileDerivedLayerPrompt };

