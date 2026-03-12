const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TESTS_ROOT = path.resolve(__dirname, '..');
const POLICIES_DIR = path.join(REPO_ROOT, 'apiproxy', 'policies');
const JSC_DIR = path.join(REPO_ROOT, 'apiproxy', 'resources', 'jsc');
const RESERVED_ENV_KEYS = new Set(['request', 'error', 'response', 'variables']);

module.exports = {
  REPO_ROOT,
  TESTS_ROOT,
  POLICIES_DIR,
  JSC_DIR,
  RESERVED_ENV_KEYS,
};
