const { execFileSync } = require('node:child_process')

// Last verified published main snapshot; used by source uploads/shallow clones
// without complete Git history. Refresh this count during release preparation.
const RECORDED_MAIN_COMMIT_COUNT = 164

function formatReleaseVersion(commitCount) {
  if (!Number.isSafeInteger(commitCount) || commitCount < 0) throw new Error('Invalid release commit count.')
  return `v${Math.floor(commitCount / 100)}.${String(commitCount % 100).padStart(2, '0')}`
}

function resolveReleaseVersion({ cwd, git = execFileSync } = {}) {
  const options = { cwd, encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }
  try {
    // A shallow count would silently reset the release number to nearly zero.
    if (git('git', ['rev-parse', '--is-shallow-repository'], options).trim() !== 'false') {
      return formatReleaseVersion(RECORDED_MAIN_COMMIT_COUNT)
    }
    // The built commit becomes the published main commit when this release ships.
    const raw = git('git', ['rev-list', '--count', 'HEAD'], options).trim()
    if (!/^\d+$/.test(raw)) throw new Error('Invalid Git count.')
    return formatReleaseVersion(Number(raw))
  } catch {
    return formatReleaseVersion(RECORDED_MAIN_COMMIT_COUNT)
  }
}

module.exports = { formatReleaseVersion, resolveReleaseVersion }
