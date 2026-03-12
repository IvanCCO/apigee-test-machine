const fs = require('fs');
const vm = require('vm');

const { isNonEmptyString, isPlainObject } = require('./predicates');

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

function normalizeMessageObject(payload, payloadName) {
  if (!isPlainObject(payload)) {
    throw new Error(`input.${payloadName} must be an object when provided`);
  }

  const messageObject = { ...payload };

  if (messageObject.content === undefined) {
    messageObject.content = JSON.stringify(payload);
    return messageObject;
  }

  if (typeof messageObject.content !== 'string') {
    messageObject.content = JSON.stringify(messageObject.content);
  }

  return messageObject;
}

function normalizeRequestObject(requestPayload) {
  if (!isPlainObject(requestPayload)) {
    throw new Error('input.request must be an object when provided');
  }

  return {
    ...requestPayload,
    content: JSON.stringify(requestPayload),
  };
}

function createContext(contextVariables) {
  const variableStore = new Map(
    Object.entries(contextVariables).map(([name, value]) => [name, normalizeContextValue(value)]),
  );

  return {
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
}

function createSandbox({ requestPayload, responsePayload, errorPayload, contextVariables }) {
  const context = createContext(contextVariables);

  const sandbox = {
    context,
    request: normalizeRequestObject(requestPayload),
    response: normalizeMessageObject(responsePayload, 'response'),
    error: normalizeMessageObject(errorPayload, 'error'),
    print(...args) {
      console.log(...args);
    },
    Print(...args) {
      console.log(...args);
    },
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

function installVmCompat(vmContext) {
  vm.runInContext(
    'if (typeof String.prototype.equals !== "function") { String.prototype.equals = function(other) { return String(this) === String(other); }; }',
    vmContext,
  );
}

function resolveFixedNow(runtimeConfig) {
  if (!isPlainObject(runtimeConfig)) {
    return null;
  }

  const fixedNowValue =
    runtimeConfig.now ?? runtimeConfig.mockDate ?? runtimeConfig.fixedDate ?? undefined;

  if (fixedNowValue === undefined || fixedNowValue === null) {
    return null;
  }

  if (typeof fixedNowValue === 'number' && Number.isFinite(fixedNowValue)) {
    return fixedNowValue;
  }

  if (isNonEmptyString(fixedNowValue)) {
    const parsedDate = Date.parse(fixedNowValue);
    if (!Number.isNaN(parsedDate)) {
      return parsedDate;
    }
  }

  throw new Error(
    'Invalid runtime date mock. Use runtime.now (or runtime.mockDate / runtime.fixedDate) as epoch ms number or ISO date string.',
  );
}

function installMockedDate(vmContext, runtimeConfig) {
  const fixedNow = resolveFixedNow(runtimeConfig);
  if (fixedNow === null) {
    return;
  }

  vm.runInContext(
    `
    (function(__fixedNow) {
      const __RealDate = Date;

      function MockDate(...args) {
        if (new.target) {
          if (args.length === 0) {
            return new __RealDate(__fixedNow);
          }

          return new __RealDate(...args);
        }

        if (args.length === 0) {
          return __RealDate(__fixedNow);
        }

        return __RealDate(...args);
      }

      Object.setPrototypeOf(MockDate, __RealDate);
      MockDate.prototype = __RealDate.prototype;
      MockDate.now = function() { return __fixedNow; };
      MockDate.parse = __RealDate.parse;
      MockDate.UTC = __RealDate.UTC;
      globalThis.Date = MockDate;
    })(${JSON.stringify(fixedNow)});
    `,
    vmContext,
  );
}

function executeScriptsInSandbox(scriptPaths, sandbox, runtimeConfig = {}) {
  const vmContext = vm.createContext(sandbox);

  installVmCompat(vmContext);
  installMockedDate(vmContext, runtimeConfig);

  scriptPaths.forEach((scriptPath) => {
    const sourceCode = fs.readFileSync(scriptPath, 'utf8');
    vm.runInContext(sourceCode, vmContext, {
      filename: scriptPath,
      timeout: 2000,
    });
  });

  return vmContext;
}

module.exports = {
  createSandbox,
  executeScriptsInSandbox,
};
