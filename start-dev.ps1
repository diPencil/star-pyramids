$ErrorActionPreference = 'Stop'
$devExitCode = 1
Push-Location -LiteralPath $PSScriptRoot
try {
    & corepack pnpm dev @args
    $devExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $devExitCode
