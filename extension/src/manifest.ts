import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

// NOTE: `host_permissions` must include the origin of your Node API so the
// popup's fetch() calls are not blocked by CORS in MV3. The localhost entry
// below covers local development; add your production API origin before release.
export default defineManifest({
  manifest_version: 3,
  name: 'ReClue',
  version: pkg.version,
  description: pkg.description,
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'ReClue — alternative crossword clues',
  },
  // `_execute_action` is the reserved command that opens the popup. Users can
  // rebind it at chrome://extensions/shortcuts (Chrome) or about:addons (Firefox).
  commands: {
    _execute_action: {
      suggested_key: {
        default: 'Ctrl+Shift+Y',
        mac: 'Command+Shift+Y',
      },
      description: 'Open ReClue',
    },
  },
  permissions: [],
  host_permissions: ['http://localhost:5555/*'],
  browser_specific_settings: {
    gecko: {
      id: 'reclue@example.com',
      strict_min_version: '109.0',
    },
  },
});
