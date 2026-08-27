/**
 * Agent Plugins (open standard) packaging — single-source module.
 *
 * Used by scripts/build_agent_plugins.js (registry artifact generation) and,
 * in a later phase, by the CLI's `--plugin` install/pack/validate commands.
 * Keep this the ONLY packer implementation so published bundles stay
 * reproducible from the CLI.
 */

const packer = require('./packer');
const normalize = require('./normalize');
const { validateBundle } = require('./validate');

module.exports = {
  ...packer,
  ...normalize,
  validateBundle,
};
