Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$env:PYTHONIOENCODING = "utf-8"

Write-Host ""
Write-Host "  VistA Modernizer — Backend" -ForegroundColor Cyan
Write-Host "  FastAPI + Uvicorn  ->  http://localhost:8000" -ForegroundColor Gray
Write-Host ""

# MUST run from inside backend/ so Python can find the 'app' package
$backendPath = Join-Path $PSScriptRoot "backend"
Set-Location $backendPath

Write-Host "  Working dir: $backendPath" -ForegroundColor DarkGray
Write-Host ""

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
