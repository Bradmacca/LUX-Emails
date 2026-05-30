# Push local backend/.env variables to Railway
#
# First-time setup:
#   npx @railway/cli login
#   npx @railway/cli link          # select your project + modest-cooperation service
#
# Then run from this folder:
#   .\set-railway-vars.ps1

$ErrorActionPreference = "Stop"
$envFile = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $envFile)) {
  Write-Host "Missing $envFile — copy railway.env.template to .env and fill in values." -ForegroundColor Red
  exit 1
}

Write-Host "Setting Railway variables from .env..." -ForegroundColor Cyan

Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) { return }
  if ($line -match "^([A-Z_][A-Z0-9_]*)=(.*)$") {
    $key = $Matches[1]
    $value = $Matches[2]
    Write-Host "  -> $key"
    npx @railway/cli variable set "${key}=${value}" --skip-deploys 2>&1 | Out-Null
  }
}

Write-Host "Done. Redeploy in Railway to pick up new variables." -ForegroundColor Green
