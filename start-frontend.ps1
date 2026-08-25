Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
Write-Host ""
Write-Host "  Starting VistA Modernizer Frontend..." -ForegroundColor Cyan
Write-Host "  Vite dev server on http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Set-Location "$PSScriptRoot"
cmd /c npm run dev
