const { isNonEmptyString, isPlainObject } = require('./predicates');

const CONTEXT_GET_VARIABLE_PREFIX = 'context.getVariable:';

function resolvePathValue(target, dotPath) {
  if (!isNonEmptyString(dotPath)) {
    throw new Error('Output expression must be a non-empty dot path, e.g. request.content');
  }

  return dotPath.split('.').reduce((current, segment) => {
    if (
      current === null ||
      current === undefined ||
      (typeof current !== 'object' && typeof current !== 'function') ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      throw new Error(`Output variable path not found: ${dotPath}`);
    }

    return current[segment];
  }, target);
}

function resolveGetVariableExpression(expression, vmContext) {
  if (!expression.startsWith(CONTEXT_GET_VARIABLE_PREFIX)) {
    return { matched: false };
  }

  const variableName = expression.slice(CONTEXT_GET_VARIABLE_PREFIX.length).trim();
  if (!isNonEmptyString(variableName)) {
    throw new Error('context.getVariable expression must include a variable name');
  }

  return {
    matched: true,
    value: vmContext.context.getVariable(variableName),
  };
}

function resolveOutputExpression(expression, vmContext) {
  const getVariableResult = resolveGetVariableExpression(expression, vmContext);
  if (getVariableResult.matched) {
    return getVariableResult.value;
  }

  return resolvePathValue(vmContext, expression);
}

function normalizeComparableValue(actualValue, expectedValue) {
  const expectsStructuredValue = expectedValue !== null && typeof expectedValue === 'object';

  if (!expectsStructuredValue || typeof actualValue !== 'string') {
    return actualValue;
  }

  try {
    return JSON.parse(actualValue);
  } catch (_error) {
    return actualValue;
  }
}

function resolveExpectedValue(assertionConfig, expression) {
  if (!isPlainObject(assertionConfig) || !Object.prototype.hasOwnProperty.call(assertionConfig, 'equals')) {
    return assertionConfig;
  }

  const assertionKeys = Object.keys(assertionConfig);
  if (assertionKeys.length > 1) {
    throw new Error(
      `Variable assertion "${expression}" only supports the "equals" operator. Found keys: ${assertionKeys.join(', ')}`,
    );
  }

  return assertionConfig.equals;
}

function resolveVariablesAssertions(outputFixture) {
  if (!isPlainObject(outputFixture) || !isPlainObject(outputFixture.variables)) {
    return null;
  }

  return outputFixture.variables;
}

function buildVariablesComparison(variablesAssertions, vmContext) {
  const comparableActual = { variables: {} };
  const comparableExpected = { variables: {} };

  Object.entries(variablesAssertions).forEach(([expression, assertionConfig]) => {
    const expectedValue = resolveExpectedValue(assertionConfig, expression);
    const actualValue = resolveOutputExpression(expression, vmContext);

    comparableExpected.variables[expression] = expectedValue;
    comparableActual.variables[expression] = normalizeComparableValue(actualValue, expectedValue);
  });

  return {
    comparableActual,
    comparableExpected,
  };
}

module.exports = {
  buildVariablesComparison,
  normalizeComparableValue,
  resolveOutputExpression,
  resolveVariablesAssertions,
};
