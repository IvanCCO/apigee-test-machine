const fs = require('fs');
const path = require('path');

const { RESERVED_ENV_KEYS } = require('./constants');
const { isNonEmptyString, isPlainObject } = require('./predicates');

function readJsonFixture(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required fixture file: ${filePath}`);
  }

  const fileContents = fs.readFileSync(filePath, 'utf8');
  if (!isNonEmptyString(fileContents)) {
    throw new Error(`Fixture file is empty: ${filePath}`);
  }

  try {
    return JSON.parse(fileContents);
  } catch (error) {
    throw new Error(`Invalid JSON in fixture file ${filePath}: ${error.message}`);
  }
}

function resolveMessagePayload(inputFixture, payloadKey) {
  if (inputFixture[payloadKey] !== undefined) {
    return inputFixture[payloadKey];
  }

  if (isPlainObject(inputFixture.environment) && inputFixture.environment[payloadKey] !== undefined) {
    return inputFixture.environment[payloadKey];
  }

  return {};
}

function resolveContextVariables(inputFixture) {
  const environment = isPlainObject(inputFixture.environment) ? inputFixture.environment : {};

  const environmentVariables = Object.fromEntries(
    Object.entries(environment).filter(([key]) => !RESERVED_ENV_KEYS.has(key)),
  );

  const nestedEnvironmentVariables = isPlainObject(environment.variables) ? environment.variables : {};
  const directVariables = isPlainObject(inputFixture.variables) ? inputFixture.variables : {};
  const legacyVariables = isPlainObject(inputFixture?._config?.varialbles)
    ? inputFixture._config.varialbles
    : isPlainObject(inputFixture?._config?.variables)
      ? inputFixture._config.variables
      : {};

  return {
    ...environmentVariables,
    ...nestedEnvironmentVariables,
    ...directVariables,
    ...legacyVariables,
  };
}

function readScenarioFixtures(scenarioDir) {
  const inputPath = path.join(scenarioDir, 'input.json');
  const outputPath = path.join(scenarioDir, 'output.json');

  return {
    inputFixture: readJsonFixture(inputPath),
    outputFixture: readJsonFixture(outputPath),
  };
}

module.exports = {
  readJsonFixture,
  resolveMessagePayload,
  resolveContextVariables,
  readScenarioFixtures,
};
