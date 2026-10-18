# Run this in PowerShell on your Windows machine (not WSL) and send Claude the output.
# It only reads system state — installs nothing, changes nothing.

Write-Host "=== Node / npm ===" -ForegroundColor Cyan
node -v 2>&1
npm -v 2>&1

Write-Host "`n=== MongoDB ===" -ForegroundColor Cyan
Write-Host "-- mongod on PATH --"
Get-Command mongod -ErrorAction SilentlyContinue | Select-Object Source
Write-Host "-- MongoDB Windows service --"
Get-Service -Name "MongoDB*" -ErrorAction SilentlyContinue | Format-Table Name, Status
Write-Host "-- Is anything listening on 27017? --"
Get-NetTCPConnection -LocalPort 27017 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, State
Write-Host "-- mongosh ping (only if mongod is running) --"
mongosh --eval "db.runCommand({ ping: 1 })" --quiet 2>&1

Write-Host "`n=== Ollama ===" -ForegroundColor Cyan
Write-Host "-- ollama on PATH --"
Get-Command ollama -ErrorAction SilentlyContinue | Select-Object Source
Write-Host "-- Is anything listening on 11434? --"
Get-NetTCPConnection -LocalPort 11434 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, State
Write-Host "-- Installed models --"
ollama list 2>&1
Write-Host "-- Ollama HTTP ping --"
try { (Invoke-WebRequest -Uri "http://localhost:11434/api/version" -UseBasicParsing -TimeoutSec 3).Content } catch { Write-Host "Not reachable: $($_.Exception.Message)" }

Write-Host "`n=== Ports the app wants (5000 API, 5173 client, 27017 Mongo, 11434 Ollama) ===" -ForegroundColor Cyan
foreach ($p in 5000, 5173, 27017, 11434) {
  $inUse = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
  if ($inUse) {
    $procId = $inUse[0].OwningProcess
    $procName = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
    Write-Host "Port $p : IN USE by PID $procId ($procName)"
  } else {
    Write-Host "Port $p : free"
  }
}

Write-Host "`n=== Repo .env present? ===" -ForegroundColor Cyan
$envPath = Join-Path $PSScriptRoot "..\server\.env"
if (Test-Path $envPath) {
  Write-Host "Found: $envPath (NOT printing contents — it may hold secrets)"
} else {
  Write-Host "No server/.env yet — copy server/.env.example to server/.env and fill it in."
}

Write-Host "`nDone. Copy everything above and send it back." -ForegroundColor Green
