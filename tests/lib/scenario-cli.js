const assert = require('assert');
const path = require('path');

function toRelativeScenarioPath(testsRoot, scenarioDir) {
  return path.relative(testsRoot, scenarioDir);
}

function normalizeScenarioArgument(argument) {
  return argument.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
}

function findScenarioDirectory(argument, testsRoot, scenarioDirectories) {
  const normalizedArgument = normalizeScenarioArgument(argument);

  const relativeMatch = scenarioDirectories.find(
    (scenarioDir) => toRelativeScenarioPath(testsRoot, scenarioDir).replace(/\\/g, '/') === normalizedArgument,
  );

  if (relativeMatch) {
    return relativeMatch;
  }

  const absoluteCandidate = path.isAbsolute(argument) ? argument : path.resolve(testsRoot, argument);
  const normalizedAbsoluteCandidate = path.normalize(absoluteCandidate);

  return (
    scenarioDirectories.find((scenarioDir) => path.normalize(scenarioDir) === normalizedAbsoluteCandidate) || null
  );
}

function printUsage() {
  console.log('Usage: node tests/run-scenario.js [--all | --scenario <path> | --path <path>]');
  console.log('Examples:');
  console.log('  node tests/run-scenario.js --all');
  console.log('  node tests/run-scenario.js --scenario "normalize-error/uses code as error type"');
}

function printAvailableScenarios(testsRoot, scenarioDirectories) {
  console.log('Available scenarios:');
  scenarioDirectories.forEach((scenarioDir) => {
    console.log(`- ${toRelativeScenarioPath(testsRoot, scenarioDir)}`);
  });
}

function printFailure(relativeScenarioPath, error, actualValue, expectedValue) {
  console.error(`FAIL ${relativeScenarioPath}`);
  console.error(error.message);

  if (actualValue === undefined && expectedValue === undefined) {
    return;
  }

  console.error('Actual:');
  console.error(JSON.stringify(actualValue, null, 2));
  console.error('Expected:');
  console.error(JSON.stringify(expectedValue, null, 2));
}

function runAndAssertScenario(testsRoot, scenarioDir, runScenario) {
  const relativeScenarioPath = toRelativeScenarioPath(testsRoot, scenarioDir);

  try {
    const { comparableActual, comparableExpected } = runScenario(scenarioDir);
    assert.deepStrictEqual(comparableActual, comparableExpected);
    console.log(`PASS ${relativeScenarioPath}`);
    return true;
  } catch (error) {
    printFailure(relativeScenarioPath, error, error.actual, error.expected);
    return false;
  }
}

function parseCliArguments(rawArgs) {
  if (rawArgs.length === 0) {
    return { mode: 'help' };
  }

  const [firstArg, secondArg] = rawArgs;

  if (firstArg === '--all') {
    return { mode: 'all' };
  }

  if (firstArg === '--scenario' || firstArg === '--path') {
    if (!secondArg) {
      return { mode: 'invalid', error: `${firstArg} requires a scenario path` };
    }

    return { mode: 'single', scenarioArgument: secondArg };
  }

  if (firstArg === '--help' || firstArg === '-h') {
    return { mode: 'help' };
  }

  return { mode: 'single', scenarioArgument: firstArg };
}

module.exports = {
  findScenarioDirectory,
  parseCliArguments,
  printAvailableScenarios,
  printUsage,
  runAndAssertScenario,
};
