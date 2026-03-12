const { resolveMessagePayload, resolveContextVariables, readScenarioFixtures } = require('./fixtures');
const { resolvePolicyScriptPaths } = require('./policy-loader');
const { createSandbox, executeScriptsInSandbox } = require('./sandbox');
const {
  buildVariablesComparison,
  normalizeComparableValue,
  resolveOutputExpression,
  resolveVariablesAssertions,
} = require('./assertions');

function resolvePolicyFileName(inputFixture) {
  return inputFixture.policy || inputFixture.path;
}

function resolveRuntimeConfig(inputFixture) {
  if (inputFixture.runtime && typeof inputFixture.runtime === 'object') {
    return inputFixture.runtime;
  }

  if (inputFixture._runtime && typeof inputFixture._runtime === 'object') {
    return inputFixture._runtime;
  }

  return {};
}

function runScenario(scenarioDir) {
  const { inputFixture, outputFixture } = readScenarioFixtures(scenarioDir);

  const policyFileName = resolvePolicyFileName(inputFixture);
  const scriptPaths = resolvePolicyScriptPaths(policyFileName);

  const sandbox = createSandbox({
    requestPayload: resolveMessagePayload(inputFixture, 'request'),
    responsePayload: resolveMessagePayload(inputFixture, 'response'),
    errorPayload: resolveMessagePayload(inputFixture, 'error'),
    contextVariables: resolveContextVariables(inputFixture),
  });

  const vmContext = executeScriptsInSandbox(
    scriptPaths,
    sandbox,
    resolveRuntimeConfig(inputFixture),
  );
  const variablesAssertions = resolveVariablesAssertions(outputFixture);

  if (variablesAssertions) {
    const { comparableActual, comparableExpected } = buildVariablesComparison(variablesAssertions, vmContext);

    return {
      actualOutput: comparableActual,
      comparableActual,
      comparableExpected,
      expectedOutput: outputFixture,
      inputFixture,
    };
  }

  const actualOutput = resolveOutputExpression(inputFixture.output_variable, vmContext);
  const comparableActual = normalizeComparableValue(actualOutput, outputFixture);

  return {
    actualOutput,
    comparableActual,
    comparableExpected: outputFixture,
    expectedOutput: outputFixture,
    inputFixture,
  };
}

module.exports = {
  runScenario,
};
