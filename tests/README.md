# Apigee JS Policy Test Fixtures

Each scenario is a folder with:

- `input.json`
- `output.json`

## `input.json`

```json
{
  "_scenario": "Human readable scenario name",
  "skip": false,
  "policy": "JS-PolicyName.xml",
  "runtime": {
    "now": "2024-01-02T03:04:05.000Z"
  },
  "request": {},
  "response": {},
  "error": {},
  "environment": {
    "my.context.variable": "value"
  }
}
```

- `policy`: policy XML file under `apiproxy/policies`.
- `_scenario`: required non-empty scenario name (validated during discovery).
- `skip`: optional boolean. When `true`, scenario is ignored by discovery/runners.
- `runtime`: optional execution config.
- `runtime.now`: freezes `new Date()` and `Date.now()` for deterministic tests.
- `request`: object injected into the VM as `request` and also serialized into `request.content`.
- `response`: object injected into the VM as `response` and also serialized into `response.content`.
- `error`: object injected as `error` (`error.content` is auto-serialized when missing).
- `environment`: context variables seed (`context.getVariable` reads these values).
- `environment.error`, `environment.request`, and `environment.response` are also accepted as aliases.

## `output.json`

```json
{
  "variables": {
    "context.getVariable:error.errorType": {
      "equals": "BAD_REQUEST"
    },
    "request.content": {
      "equals": {
        "foo": "bar"
      }
    }
  }
}
```

- Keys in `variables` are expressions to resolve after policy execution.
- Supported expression types: `context.getVariable:<variableName>` and VM dot paths like `request.content`, `response.content`, `error.content`.
- Assertion operator: `equals` only.
- If expected value is an object/array and actual is a JSON string, the runner parses actual before comparing.

## Suggestions to scale the framework

- Keep one folder per scenario and name it by behavior.
- Assert multiple variables in the same `output.json` instead of creating one test per variable.
- Use `environment` to preload all required context variables for each policy.
- Add one happy-path and one failure-path scenario per policy.

## Helper script

- Run all scenarios: `node tests/run-scenario.js --all`
- Run one scenario: `node tests/run-scenario.js --scenario "normalize-error/uses default status when missing"`
- Run all scenarios (shortcut): `./test.sh --all` or `./test --all`
- Run one scenario (shortcut): `./test.sh --scenario "<path>"` or `./test --scenario "<path>"`
- Path alias (shortcut): `./test.sh --path "<path>"` or `./test --path "<path>"`

## Internal modules (for debugging)

- `tests/lib/scenario-runner.js`: Orchestrates a full scenario execution.
- `tests/lib/policy-loader.js`: Resolves policy XML and JS resource paths.
- `tests/lib/sandbox.js`: Builds Apigee-like VM globals and executes JS scripts.
- `tests/lib/assertions.js`: Resolves expressions and builds comparable assertion payloads.
- `tests/lib/fixtures.js`: Reads and normalizes fixture inputs.
- `tests/lib/scenario-cli.js`: CLI parsing, scenario lookup, and console reporting.
