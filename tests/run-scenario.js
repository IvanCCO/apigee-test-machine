const assert = require('assert');
const path = require('path');

const { TESTS_ROOT, listScenarioDirectories, runScenario } = require('./run');

function toRelativeScenarioPath(scenarioDir) {
  return path.relative(TESTS_ROOT, scenarioDir);
}

function printUsage() {
  console.log('Usage: node tests/run-scenario.js <scenario-path | --all>');
  console.log('');
  console.log('Examples:');
  console.log('  node tests/run-scenario.js --all');
  console.log('  node tests/run-scenario.js "normalize-error/uses code as error type"');
}

function printAvailableScenarios(scenarios) {
  console.log('');
  console.log('Available scenarios:');
  scenarios.forEach((scenarioDir) => {
    console.log(`- ${toRelativeScenarioPath(scenarioDir)}`);
  });
}

function printFailure(relativeScenarioPath, error, comparableActual, comparableExpected) {
  console.error(`FAIL ${relativeScenarioPath}`);
  if (error) {
    console.error(error.message);
  }
  if (comparableActual !== undefined || comparableExpected !== undefined) {
    console.error('Actual:');
    console.error(JSON.stringify(comparableActual, null, 2));
    console.error('Expected:');
    console.error(JSON.stringify(comparableExpected, null, 2));
  }
}

function runAndAssertScenario(scenarioDir) {
  const relativeScenarioPath = toRelativeScenarioPath(scenarioDir);

  try {
    const { comparableActual, comparableExpected } = runScenario(scenarioDir);
    assert.deepStrictEqual(comparableActual, comparableExpected);
    console.log(`PASS ${relativeScenarioPath}`);
    return true;
  } catch (error) {
    if (error.actual !== undefined || error.expected !== undefined) {
      printFailure(relativeScenarioPath, error, error.actual, error.expected);
    } else {
      printFailure(relativeScenarioPath, error);
    }
    return false;
  }
}

function resolveScenarioDir(argument, scenarioDirectories) {
  const normalizedArgument = argument.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');

  const directMatch = scenarioDirectories.find(
    (scenarioDir) => toRelativeScenarioPath(scenarioDir).replace(/\\/g, '/') === normalizedArgument,
  );
  if (directMatch) {
    return directMatch;
  }

  const absoluteCandidate = path.isAbsolute(argument) ? argument : path.resolve(TESTS_ROOT, argument);
  const normalizedCandidate = path.normalize(absoluteCandidate);
  const absoluteMatch = scenarioDirectories.find(
    (scenarioDir) => path.normalize(scenarioDir) === normalizedCandidate,
  );

  return absoluteMatch || null;
}

function main() {
  const scenarioArgument = process.argv[2];
  const scenarioDirectories = listScenarioDirectories(TESTS_ROOT);

  if (!scenarioArgument) {
    printUsage();
    printAvailableScenarios(scenarioDirectories);
    process.exitCode = 1;
    return;
  }

  if (scenarioArgument === '--all') {
    const allPassed = scenarioDirectories.every((scenarioDir) => runAndAssertScenario(scenarioDir));
    process.exitCode = allPassed ? 0 : 1;
    return;
  }

  const scenarioDir = resolveScenarioDir(scenarioArgument, scenarioDirectories);
  if (!scenarioDir) {
    console.error(`Scenario not found: ${scenarioArgument}`);
    printAvailableScenarios(scenarioDirectories);
    process.exitCode = 1;
    return;
  }

  const passed = runAndAssertScenario(scenarioDir);
  process.exitCode = passed ? 0 : 1;
}

main();
