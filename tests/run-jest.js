const path = require('path');

function runJest() {
  let jestPackage;

  try {
    jestPackage = require('jest');
  } catch (_error) {
    throw new Error(
      'Jest is not available. Install it with your preferred package manager, then run: node tests/run-jest.js',
    );
  }

  const configPath = path.join(__dirname, 'jest.config.cjs');
  jestPackage.run(['--runInBand', '--config', configPath]);
}

runJest();
