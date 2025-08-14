# Script para iniciar o ambiente de desenvolvimento
Write-Host "Iniciando o ambiente de desenvolvimento..." -ForegroundColor Green

# Iniciar o backend em uma nova janela do PowerShell
Write-Host "Iniciando backend..." -ForegroundColor Cyan
$backendPath = Join-Path $PSScriptRoot "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendPath'; npm run dev"

# Aguardar um pouco para o backend iniciar
Start-Sleep -Seconds 3

# Iniciar o frontend em uma nova janela do PowerShell
Write-Host "Iniciando frontend..." -ForegroundColor Cyan
$frontendPath = Join-Path $PSScriptRoot "frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendPath'; npm run dev"

Write-Host "Ambiente iniciado com sucesso!" -ForegroundColor Green
Write-Host "Backend: http://localhost:5000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
