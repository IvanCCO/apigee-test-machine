const { TESTS_ROOT, listScenarioDirectories, runScenario } = require('./run');
const {
  findScenarioDirectory,
  parseCliArguments,
  printAvailableScenarios,
  printUsage,
  runAndAssertScenario,
} = require('./lib/scenario-cli');

function runAllScenarios(scenarioDirectories) {
  const allPassed = scenarioDirectories.every((scenarioDir) =>
    runAndAssertScenario(TESTS_ROOT, scenarioDir, runScenario),
  );

  process.exitCode = allPassed ? 0 : 1;
}

function runSingleScenario(scenarioArgument, scenarioDirectories) {
  const scenarioDirectory = findScenarioDirectory(scenarioArgument, TESTS_ROOT, scenarioDirectories);

  if (!scenarioDirectory) {
    console.error(`Scenario not found: ${scenarioArgument}`);
    printAvailableScenarios(TESTS_ROOT, scenarioDirectories);
    process.exitCode = 1;
    return;
  }

  const passed = runAndAssertScenario(TESTS_ROOT, scenarioDirectory, runScenario);
  process.exitCode = passed ? 0 : 1;
}

function main() {
  const scenarioDirectories = listScenarioDirectories(TESTS_ROOT);
  const command = parseCliArguments(process.argv.slice(2));

  if (command.mode === 'help') {
    printUsage();
    printAvailableScenarios(TESTS_ROOT, scenarioDirectories);
    process.exitCode = 1;
    return;
  }

  if (command.mode === 'invalid') {
    console.error(command.error);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command.mode === 'all') {
    runAllScenarios(scenarioDirectories);
    return;
  }

  runSingleScenario(command.scenarioArgument, scenarioDirectories);
}

main();
