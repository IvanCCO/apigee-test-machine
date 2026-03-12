const fs = require('fs');
const path = require('path');

const { readJsonFixture } = require('./fixtures');
const { isNonEmptyString, isPlainObject } = require('./predicates');

function validateScenarioInputFixture(inputFixture, inputPath) {
  if (!isPlainObject(inputFixture)) {
    throw new Error(`Scenario input must be a JSON object: ${inputPath}`);
  }

  if (!isNonEmptyString(inputFixture._scenario)) {
    throw new Error(`Scenario is missing required "_scenario" in: ${inputPath}`);
  }

  if (
    Object.prototype.hasOwnProperty.call(inputFixture, 'skip') &&
    typeof inputFixture.skip !== 'boolean'
  ) {
    throw new Error(`Scenario field "skip" must be boolean in: ${inputPath}`);
  }
}

function shouldSkipScenario(inputFixture) {
  return inputFixture.skip === true;
}

function collectScenarioDirectory(currentDir, scenarioDirectories) {
  const inputPath = path.join(currentDir, 'input.json');
  const inputFixture = readJsonFixture(inputPath);

  validateScenarioInputFixture(inputFixture, inputPath);

  if (shouldSkipScenario(inputFixture)) {
    return;
  }

  scenarioDirectories.push(currentDir);
}

function listScenarioDirectories(rootDir) {
  const scenarioDirectories = [];

  function walkDirectory(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    const hasInputFixture = entries.some((entry) => entry.isFile() && entry.name === 'input.json');
    const hasOutputFixture = entries.some((entry) => entry.isFile() && entry.name === 'output.json');

    if (hasInputFixture && hasOutputFixture) {
      collectScenarioDirectory(currentDir, scenarioDirectories);
    }

    entries
      .filter((entry) => entry.isDirectory())
      .forEach((entry) => walkDirectory(path.join(currentDir, entry.name)));
  }

  walkDirectory(rootDir);

  return scenarioDirectories.sort((left, right) => left.localeCompare(right));
}

module.exports = {
  listScenarioDirectories,
};
