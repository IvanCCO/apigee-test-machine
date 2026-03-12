const fs = require('fs');
const path = require('path');

const { JSC_DIR, POLICIES_DIR } = require('./constants');
const { isNonEmptyString } = require('./predicates');

function ensurePathInsideDirectory(basePath, candidatePath, description) {
  const normalizedBase = path.resolve(basePath);
  const normalizedCandidate = path.resolve(candidatePath);

  if (!normalizedCandidate.startsWith(`${normalizedBase}${path.sep}`)) {
    throw new Error(`${description} resolves outside allowed directory: ${candidatePath}`);
  }

  return normalizedCandidate;
}

function resolvePolicyPath(policyFileName) {
  if (!isNonEmptyString(policyFileName)) {
    throw new Error('input.policy must be a non-empty string with the policy XML filename');
  }

  const policyPath = ensurePathInsideDirectory(
    POLICIES_DIR,
    path.join(POLICIES_DIR, policyFileName),
    'Policy path',
  );

  if (!fs.existsSync(policyPath)) {
    throw new Error(`Policy XML not found: ${policyPath}`);
  }

  return policyPath;
}

function parseScriptUrls(policyXmlContents, policyPath) {
  const includeUrls = [];
  const resourceUrls = [];

  const includePattern = /<IncludeURL>\s*([^<]+?)\s*<\/IncludeURL>/g;
  const resourcePattern = /<ResourceURL>\s*([^<]+?)\s*<\/ResourceURL>/g;

  let includeMatch = includePattern.exec(policyXmlContents);
  while (includeMatch) {
    includeUrls.push(includeMatch[1].trim());
    includeMatch = includePattern.exec(policyXmlContents);
  }

  let resourceMatch = resourcePattern.exec(policyXmlContents);
  while (resourceMatch) {
    resourceUrls.push(resourceMatch[1].trim());
    resourceMatch = resourcePattern.exec(policyXmlContents);
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

  const scriptRelativePath = scriptUrl.slice('jsc://'.length);
  const scriptPath = ensurePathInsideDirectory(
    JSC_DIR,
    path.join(JSC_DIR, scriptRelativePath),
    'Script path',
  );

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script file not found for ${scriptUrl}: ${scriptPath}`);
  }

  return scriptPath;
}

function resolvePolicyScriptPaths(policyFileName) {
  const policyPath = resolvePolicyPath(policyFileName);
  const policyXmlContents = fs.readFileSync(policyPath, 'utf8');
  const scriptUrls = parseScriptUrls(policyXmlContents, policyPath);

  return scriptUrls.map(resolveScriptPath);
}

module.exports = {
  resolvePolicyPath,
  parseScriptUrls,
  resolveScriptPath,
  resolvePolicyScriptPaths,
};
