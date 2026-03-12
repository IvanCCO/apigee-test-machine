const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TESTS_ROOT = __dirname;
const POLICIES_ROOT = path.join(REPO_ROOT, 'apiproxy', 'policies');

function printUsage() {
  console.log('Usage: node tests/create-scenario.js <PolicyFile.xml>');
  console.log('Example: node tests/create-scenario.js JS-Something.xml');
}

function normalizePolicyFileName(policyArgument) {
  const trimmed = String(policyArgument || '').trim();
  if (!trimmed) {
    throw new Error('Policy filename is required.');
  }

  const fileName = path.basename(trimmed);
  if (!fileName.toLowerCase().endsWith('.xml')) {
    return `${fileName}.xml`;
  }

  return fileName;
}

function toScenarioSlug(policyFileName) {
  const withoutExtension = policyFileName.replace(/\.xml$/i, '');
  const withoutPrefix = withoutExtension.replace(/^JS[-_]?/i, '');

  const slug = withoutPrefix
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z\d]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  if (!slug) {
    throw new Error(`Could not derive scenario folder name from policy: ${policyFileName}`);
  }

  return slug;
}

function buildSampleInput(policyFileName) {
  return {
    _scenario: `TODO: describe ${policyFileName} behavior`,
    skip: true,
    policy: policyFileName,
    runtime: {
      now: '2024-01-02T03:04:05.000Z',
    },
    request: {
      sample: true,
    },
    response: {
      sample: true,
    },
    error: {
      code: 'SAMPLE_ERROR',
      message: 'Sample error message',
      details: 500,
    },
    environment: {
      'sample.variable': 'sample-value',
    },
  };
}

function buildSampleOutput() {
  return {
    variables: {
      'request.content': {
        equals: {
          sample: true,
        },
      },
      'response.content': {
        equals: {
          sample: true,
        },
      },
      'context.getVariable:sample.variable': {
        equals: 'sample-value',
      },
    },
  };
}

function writeJson(filePath, content) {
  fs.writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
}

function main() {
  const policyArgument = process.argv[2];

  if (!policyArgument) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const policyFileName = normalizePolicyFileName(policyArgument);
  const policyPath = path.join(POLICIES_ROOT, policyFileName);
  const policyExists = fs.existsSync(policyPath);

  const scenarioSlug = toScenarioSlug(policyFileName);
  const scenarioDir = path.join(TESTS_ROOT, scenarioSlug, 'sample');

  if (fs.existsSync(scenarioDir)) {
    console.error(`Scenario already exists: ${scenarioDir}`);
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(scenarioDir, { recursive: true });

  const inputPath = path.join(scenarioDir, 'input.json');
  const outputPath = path.join(scenarioDir, 'output.json');

  writeJson(inputPath, buildSampleInput(policyFileName));
  writeJson(outputPath, buildSampleOutput());

  if (!policyExists) {
    console.warn(`Warning: policy file not found at ${policyPath}`);
  }

  console.log(`Created scenario scaffold: ${scenarioDir}`);
  console.log(`- ${inputPath}`);
  console.log(`- ${outputPath}`);
  console.log('Set "skip" to false when your scenario is ready to run.');
}

main();
