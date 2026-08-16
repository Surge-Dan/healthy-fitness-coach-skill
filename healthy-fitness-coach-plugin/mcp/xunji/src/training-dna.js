'use strict';

// Keep the MCP connector on the same deterministic engine shipped with the Skill.
// The plugin copy is resolved from its bundled Skill reference, so it remains portable.
module.exports = require('../../../skills/healthy-fitness-coach/references/training-dna-engine.js');
