const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const TESTS_ROOT = __dirname;
const POLICIES_DIR = path.join(REPO_ROOT, 'apiproxy', 'policies');
const JSC_DIR = path.join(REPO_ROOT, 'apiproxy', 'resources', 'jsc');
const RESERVED_ENV_KEYS = new Set(['request', 'error', 'response', 'variables']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function listScenarioDirectories(rootDir) {
  const directories = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    const hasInput = entries.some((entry) => entry.isFile() && entry.name === 'input.json');
    const hasOutput = entries.some((entry) => entry.isFile() && entry.name === 'output.json');

    if (hasInput && hasOutput) {
      directories.push(currentDir);
    }

    entries
      .filter((entry) => entry.isDirectory())
      .forEach((entry) => walk(path.join(currentDir, entry.name)));
  }

  walk(rootDir);
  return directories.sort((a, b) => a.localeCompare(b));
}

function readJsonFixture(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required fixture file: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!isNonEmptyString(content)) {
    throw new Error(`Fixture file is empty: ${filePath}`);
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in fixture file ${filePath}: ${error.message}`);
  }
}

function ensurePathInsideBase(basePath, targetPath, description) {
  const normalizedBase = path.resolve(basePath);
  const normalizedTarget = path.resolve(targetPath);

  if (!normalizedTarget.startsWith(normalizedBase + path.sep)) {
    throw new Error(`${description} resolves outside allowed directory: ${targetPath}`);
  }

  return normalizedTarget;
}

function resolvePolicyPath(policyFileName) {
  if (!isNonEmptyString(policyFileName)) {
    throw new Error('input.policy must be a non-empty string with the policy XML filename');
  }

  const resolved = ensurePathInsideBase(POLICIES_DIR, path.join(POLICIES_DIR, policyFileName), 'Policy path');
  if (!fs.existsSync(resolved)) {
    throw new Error(`Policy XML not found: ${resolved}`);
  }

  return resolved;
}

function parseScriptUrls(policyXmlContent, policyPath) {
  const includeUrls = [];
  const resourceUrls = [];

  const includePattern = /<IncludeURL>\s*([^<]+?)\s*<\/IncludeURL>/g;
  const resourcePattern = /<ResourceURL>\s*([^<]+?)\s*<\/ResourceURL>/g;

  let includeMatch = includePattern.exec(policyXmlContent);
  while (includeMatch) {
    includeUrls.push(includeMatch[1].trim());
    includeMatch = includePattern.exec(policyXmlContent);
  }

  let resourceMatch = resourcePattern.exec(policyXmlContent);
  while (resourceMatch) {
    resourceUrls.push(resourceMatch[1].trim());
    resourceMatch = resourcePattern.exec(policyXmlContent);
  }

  if (resourceUrls.length === 0) {
    throw new Error(`Policy ${policyPath} does not define any <ResourceURL>`);
  }

  return [...includeUrls, ...resourceUrls];
}

function resolveScriptPath(scriptUrl) {
  if (!isNonEmptyString(scriptUrl) || !scriptUrl.startsWith('jsc://')) {
    throw new Error(`Unsupported script URL (expected jsc://): ${scriptUrl}`);
  }

  const relativePath = scriptUrl.slice('jsc://'.length);
  const resolved = ensurePathInsideBase(JSC_DIR, path.join(JSC_DIR, relativePath), 'Script path');

  if (!fs.existsSync(resolved)) {
    throw new Error(`Script file not found for ${scriptUrl}: ${resolved}`);
  }

  return resolved;
}

function normalizeContextValue(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function getInputPayload(inputFixture, key) {
  const directPayload = inputFixture[key];
  if (directPayload !== undefined) {
    return directPayload;
  }

  const environmentPayload = isPlainObject(inputFixture.environment)
    ? inputFixture.environment[key]
    : undefined;

  if (environmentPayload !== undefined) {
    return environmentPayload;
  }

  return {};
}

function getContextVariablesFromFixture(inputFixture) {
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

function toMessageLikeObject(payload, name) {
  if (!isPlainObject(payload)) {
    throw new Error(`input.${name} must be an object when provided`);
  }

  const messageLikeObject = { ...payload };
  if (typeof messageLikeObject.content === 'undefined') {
    messageLikeObject.content = JSON.stringify(payload);
    return messageLikeObject;
  }

  if (typeof messageLikeObject.content !== 'string') {
    messageLikeObject.content = JSON.stringify(messageLikeObject.content);
  }

  return messageLikeObject;
}

function toRequestLikeObject(payload) {
  if (!isPlainObject(payload)) {
    throw new Error('input.request must be an object when provided');
  }

  return {
    ...payload,
    content: JSON.stringify(payload),
  };
}

function createSandbox(inputFixture) {
  const requestPayload = getInputPayload(inputFixture, 'request');
  const errorPayload = getInputPayload(inputFixture, 'error');
  const contextVariables = getContextVariablesFromFixture(inputFixture);

  const variableStore = new Map(
    Object.entries(contextVariables).map(([key, value]) => [key, normalizeContextValue(value)]),
  );

  const context = {
    getVariable(variableName) {
      if (!variableStore.has(variableName)) {
        return null;
      }

      return variableStore.get(variableName);
    },
    setVariable(variableName, value) {
      variableStore.set(variableName, value);
      return value;
    },
  };

  const request = toRequestLikeObject(requestPayload);

  const response = {};
  const error = toMessageLikeObject(errorPayload, 'error');

  const sandbox = {
    context,
    request,
    response,
    error,
    httpClient: {
      send() {
        return undefined;
      },
    },
    Request: function Request(config) {
      this.config = config;
    },
    console,
  };

  sandbox.GLOBAL = sandbox;
  sandbox.global = sandbox;

  return sandbox;
}

function executeScriptsInSandbox(scriptPaths, sandbox) {
  const vmContext = vm.createContext(sandbox);

  vm.runInContext(
    'if (typeof String.prototype.equals !== "function") { String.prototype.equals = function(other) { return String(this) === String(other); }; }',
    vmContext,
  );

  scriptPaths.forEach((scriptPath) => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    vm.runInContext(source, vmContext, {
      filename: scriptPath,
      timeout: 2000,
    });
  });

  return vmContext;
}

function resolvePathValue(target, dotPath) {
  if (!isNonEmptyString(dotPath)) {
    throw new Error('Output expression must be a non-empty dot path, e.g. request.content');
  }

  const segments = dotPath.split('.');
  let current = target;

  for (const segment of segments) {
    if (
      current === null ||
      current === undefined ||
      (typeof current !== 'object' && typeof current !== 'function') ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      throw new Error(`Output variable path not found: ${dotPath}`);
    }

    current = current[segment];
  }

  return current;
}

function resolveGetVariableExpression(expression, vmContext) {
  const prefix = 'context.getVariable:';
  if (!expression.startsWith(prefix)) {
    return { matched: false };
  }

  const variableName = expression.slice(prefix.length).trim();
  if (!isNonEmptyString(variableName)) {
    throw new Error('context.getVariable expression must include a variable name');
  }

  return {
    matched: true,
    value: vmContext.context.getVariable(variableName),
  };
}

function resolveOutputValue(outputExpression, vmContext) {
  const getVariableResult = resolveGetVariableExpression(outputExpression, vmContext);
  if (getVariableResult.matched) {
    return getVariableResult.value;
  }

  return resolvePathValue(vmContext, outputExpression);
}

function getComparableActualValue(actualValue, expectedValue) {
  const isExpectedStructured = expectedValue !== null && typeof expectedValue === 'object';

  if (!isExpectedStructured || typeof actualValue !== 'string') {
    return actualValue;
  }

  try {
    return JSON.parse(actualValue);
  } catch (_error) {
    return actualValue;
  }
}

function resolveAssertionExpectedValue(assertionConfig, expression) {
  if (!isPlainObject(assertionConfig) || !Object.prototype.hasOwnProperty.call(assertionConfig, 'equals')) {
    return assertionConfig;
  }

  const keys = Object.keys(assertionConfig);
  if (keys.length > 1) {
    throw new Error(
      `Variable assertion "${expression}" only supports the "equals" operator. Found keys: ${keys.join(', ')}`,
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

function buildComparableOutputsForVariables(variablesAssertions, vmContext) {
  const comparableActual = { variables: {} };
  const comparableExpected = { variables: {} };

  Object.entries(variablesAssertions).forEach(([expression, assertionConfig]) => {
    const expectedValue = resolveAssertionExpectedValue(assertionConfig, expression);
    const actualValue = resolveOutputValue(expression, vmContext);

    comparableExpected.variables[expression] = expectedValue;
    comparableActual.variables[expression] = getComparableActualValue(actualValue, expectedValue);
  });

  return {
    comparableActual,
    comparableExpected,
  };
}

function runScenario(scenarioDir) {
  const inputPath = path.join(scenarioDir, 'input.json');
  const outputPath = path.join(scenarioDir, 'output.json');

  const inputFixture = readJsonFixture(inputPath);
  const outputFixture = readJsonFixture(outputPath);

  const policyPath = resolvePolicyPath(inputFixture.policy || inputFixture.path);
  const policyXmlContent = fs.readFileSync(policyPath, 'utf8');
  const scriptUrls = parseScriptUrls(policyXmlContent, policyPath);
  const scriptPaths = scriptUrls.map(resolveScriptPath);

  const sandbox = createSandbox(inputFixture);
  const vmContext = executeScriptsInSandbox(scriptPaths, sandbox);

  const variablesAssertions = resolveVariablesAssertions(outputFixture);
  if (variablesAssertions) {
    const { comparableActual, comparableExpected } = buildComparableOutputsForVariables(
      variablesAssertions,
      vmContext,
    );

    return {
      actualOutput: comparableActual,
      comparableActual,
      comparableExpected,
      expectedOutput: outputFixture,
      inputFixture,
    };
  }

  const actualOutput = resolveOutputValue(inputFixture.output_variable, vmContext);
  const comparableActual = getComparableActualValue(actualOutput, outputFixture);

  return {
    actualOutput,
    comparableActual,
    comparableExpected: outputFixture,
    expectedOutput: outputFixture,
    inputFixture,
  };
}

module.exports = {
  TESTS_ROOT,
  listScenarioDirectories,
  runScenario,
};
