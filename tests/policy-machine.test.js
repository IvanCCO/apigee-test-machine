const path = require('path');

const { TESTS_ROOT, listScenarioDirectories, runScenario } = require('./run');

describe('Jest XML-driven policy test machine', () => {
  const scenarioDirectories = listScenarioDirectories(TESTS_ROOT);

  test('has at least one scenario directory', () => {
    expect(scenarioDirectories.length).toBeGreaterThan(0);
  });

  scenarioDirectories.forEach((scenarioDir) => {
    const scenarioName = path.relative(TESTS_ROOT, scenarioDir);

    test(`scenario: ${scenarioName}`, () => {
      const { comparableActual, comparableExpected } = runScenario(scenarioDir);
      expect(comparableActual).toEqual(comparableExpected);
    });
  });
});
