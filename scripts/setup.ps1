# Script de Setup para Windows PowerShell
Write-Host "🚀 Configurando ambiente de desenvolvimento..." -ForegroundColor Green

# Verificar se Node.js está instalado
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js encontrado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js não encontrado. Por favor, instale o Node.js primeiro." -ForegroundColor Red
    exit 1
}

# Verificar se MongoDB está instalado
try {
    $mongoVersion = mongod --version 2>$null
    if ($mongoVersion) {
        Write-Host "✅ MongoDB encontrado" -ForegroundColor Green
    } else {
        Write-Host "⚠️ MongoDB não encontrado. Certifique-se de que está instalado e rodando." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ MongoDB não encontrado. Certifique-se de que está instalado e rodando." -ForegroundColor Yellow
}

Write-Host "`n📦 Instalando dependências do projeto raiz..." -ForegroundColor Cyan
npm install

Write-Host "`n📦 Instalando dependências do backend..." -ForegroundColor Cyan
Set-Location backend
npm install
Set-Location ..

Write-Host "`n📦 Instalando dependências do frontend..." -ForegroundColor Cyan
Set-Location frontend
npm install
Set-Location ..

Write-Host "`n🔧 Criando arquivos de ambiente..." -ForegroundColor Cyan

# Criar backend/.env se não existir
$backendEnvPath = "backend\.env"
if (-not (Test-Path $backendEnvPath)) {
    $backendEnvContent = @"
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/chat-atendimento
JWT_SECRET=seu_jwt_secret_super_seguro_aqui_mude_em_producao
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
"@
    Set-Content -Path $backendEnvPath -Value $backendEnvContent
    Write-Host "✅ Arquivo backend/.env criado" -ForegroundColor Green
} else {
    Write-Host "✅ Arquivo backend/.env já existe" -ForegroundColor Green
}

# Criar frontend/.env se não existir
$frontendEnvPath = "frontend\.env"
if (-not (Test-Path $frontendEnvPath)) {
    $frontendEnvContent = @"
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
"@
    Set-Content -Path $frontendEnvPath -Value $frontendEnvContent
    Write-Host "✅ Arquivo frontend/.env criado" -ForegroundColor Green
} else {
    Write-Host "✅ Arquivo frontend/.env já existe" -ForegroundColor Green
}

Write-Host "`n✨ Setup completo!" -ForegroundColor Green
Write-Host "Execute 'npm run dev' para iniciar o desenvolvimento." -ForegroundColor Yellow
Write-Host "Backend rodará em: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Frontend rodará em: http://localhost:5173" -ForegroundColor Cyan
