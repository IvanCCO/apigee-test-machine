# Apigee JS Policy Test Fixtures

Each scenario is a folder with:

- `input.json`
- `output.json`

## `input.json`

```json
{
  "_scenario": "Human readable scenario name",
  "policy": "JS-PolicyName.xml",
  "request": {},
  "error": {},
  "environment": {
    "my.context.variable": "value"
  }
}
```

- `policy`: policy XML file under `apiproxy/policies`.
- `request`: object injected into the VM as `request` and also serialized into `request.content`.
- `error`: object injected as `error` (`error.content` is auto-serialized when missing).
- `environment`: context variables seed (`context.getVariable` reads these values).
- `environment.error` and `environment.request` are also accepted as aliases.

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
- Run one scenario: `node tests/run-scenario.js "normalize-error/uses default status when missing"`
