const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const TESTS_ROOT = __dirname;
const POLICIES_DIR = path.join(REPO_ROOT, 'apiproxy', 'policies');
const JSC_DIR = path.join(REPO_ROOT, 'apiproxy', 'resources', 'jsc');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function listScenarioDirectories(rootDir) {
  const directories = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    const hasInput = entries.some((entry) => entry.isFile() && entry.name === 'input.json');
    const hasOutput = entries.some((entry) => entry.isFile() && entry.name === 'output.json');

    if (hasInput || hasOutput) {
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
    throw new Error('input.path must be a non-empty string with the policy XML filename');
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

function createSandbox(inputFixture) {
  const requestPayload = inputFixture.request || {};
  const errorPayload = inputFixture.error || {};
  const contextVariables =
    inputFixture?._config?.varialbles || inputFixture?._config?.variables || {};

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

  const request = {
    ...requestPayload,
    content: JSON.stringify(requestPayload),
  };

  const response = {};
  const error = {
    ...errorPayload,
    content:
      typeof errorPayload.content === 'string'
        ? errorPayload.content
        : JSON.stringify(errorPayload),
  };

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
    throw new Error('input.output_variable must be a non-empty dot path, e.g. request.content');
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

function runScenario(scenarioDir) {
  const inputPath = path.join(scenarioDir, 'input.json');
  const outputPath = path.join(scenarioDir, 'output.json');

  const inputFixture = readJsonFixture(inputPath);
  const expectedOutput = readJsonFixture(outputPath);

  const policyPath = resolvePolicyPath(inputFixture.path);
  const policyXmlContent = fs.readFileSync(policyPath, 'utf8');
  const scriptUrls = parseScriptUrls(policyXmlContent, policyPath);
  const scriptPaths = scriptUrls.map(resolveScriptPath);

  const sandbox = createSandbox(inputFixture);
  const vmContext = executeScriptsInSandbox(scriptPaths, sandbox);

  const actualOutput = resolveOutputValue(inputFixture.output_variable, vmContext);
  const comparableActual = getComparableActualValue(actualOutput, expectedOutput);

  return {
    actualOutput,
    comparableActual,
    expectedOutput,
    inputFixture,
  };
}

module.exports = {
  TESTS_ROOT,
  listScenarioDirectories,
  runScenario,
};
