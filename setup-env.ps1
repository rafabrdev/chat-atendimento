# Script de Configuração de Ambiente Seguro
# Este script ajuda a configurar as variáveis de ambiente necessárias
# sem expor senhas no código

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " CONFIGURAÇÃO DE AMBIENTE SEGURO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se já existe um arquivo .env.local
if (Test-Path ".env.local") {
    Write-Host "⚠️  Arquivo .env.local já existe!" -ForegroundColor Yellow
    $overwrite = Read-Host "Deseja sobrescrever? (yes/no)"
    if ($overwrite -ne "yes") {
        Write-Host "Configuração cancelada." -ForegroundColor Yellow
        exit
    }
}

Write-Host "Este script irá criar um arquivo .env.local com suas credenciais." -ForegroundColor White
Write-Host "IMPORTANTE: Este arquivo NÃO deve ser commitado!" -ForegroundColor Red
Write-Host ""

# Função para ler entrada segura (para senhas)
function Read-SecureInput {
    param([string]$Prompt)
    $secure = Read-Host -AsSecureString $Prompt
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    return [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

# Coletar informações
Write-Host "📝 Configure as variáveis de ambiente:" -ForegroundColor Green
Write-Host ""

# Configurações Gerais
Write-Host "=== Configurações Gerais ===" -ForegroundColor Cyan
$ec2Host = Read-Host "EC2 Host IP (default: 52.90.17.204)"
if ([string]::IsNullOrWhiteSpace($ec2Host)) { $ec2Host = "52.90.17.204" }

$sshKeyPath = Read-Host "Caminho da chave SSH (default: ~/.ssh/chat-atendimento-new-key.pem)"
if ([string]::IsNullOrWhiteSpace($sshKeyPath)) { $sshKeyPath = "~/.ssh/chat-atendimento-new-key.pem" }

Write-Host ""
Write-Host "=== Segurança ===" -ForegroundColor Cyan
$jwtSecret = Read-SecureInput "JWT Secret (senha forte)"

Write-Host ""
Write-Host "=== MongoDB ===" -ForegroundColor Cyan
Write-Host "Formato: mongodb+srv://usuario:senha@cluster.mongodb.net/database" -ForegroundColor Gray

$mongoStaging = Read-SecureInput "MongoDB URI Staging"
$mongoProduction = Read-SecureInput "MongoDB URI Production"

Write-Host ""
Write-Host "=== AWS (opcional - deixe em branco se usar AWS CLI) ===" -ForegroundColor Cyan
$awsKeyId = Read-Host "AWS Access Key ID"
$awsSecretKey = ""
if (-not [string]::IsNullOrWhiteSpace($awsKeyId)) {
    $awsSecretKey = Read-SecureInput "AWS Secret Access Key"
}

Write-Host ""
Write-Host "=== S3 Buckets ===" -ForegroundColor Cyan
$s3Staging = Read-Host "S3 Bucket Staging (default: chat-atendimento-staging)"
if ([string]::IsNullOrWhiteSpace($s3Staging)) { $s3Staging = "chat-atendimento-staging" }

$s3Production = Read-Host "S3 Bucket Production (default: chat-atendimento-production)"
if ([string]::IsNullOrWhiteSpace($s3Production)) { $s3Production = "chat-atendimento-production" }

# Criar conteúdo do arquivo
$envContent = @"
# Arquivo de configuração local - NÃO COMMITAR!
# Gerado em: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# Configurações Gerais
EC2_HOST=$ec2Host
SSH_KEY_PATH=$sshKeyPath
JWT_SECRET=$jwtSecret

# MongoDB
MONGODB_URI_STAGING=$mongoStaging
MONGODB_URI_PRODUCTION=$mongoProduction

# AWS
AWS_ACCESS_KEY_ID=$awsKeyId
AWS_SECRET_ACCESS_KEY=$awsSecretKey

# S3 Buckets
S3_BUCKET_NAME_STAGING=$s3Staging
S3_BUCKET_NAME_PRODUCTION=$s3Production
"@

# Salvar arquivo
$envContent | Out-File -FilePath ".env.local" -Encoding UTF8
Write-Host ""
Write-Host "✅ Arquivo .env.local criado com sucesso!" -ForegroundColor Green

# Adicionar ao .gitignore se não estiver
$gitignorePath = ".gitignore"
if (Test-Path $gitignorePath) {
    $gitignoreContent = Get-Content $gitignorePath
    if ($gitignoreContent -notcontains ".env.local") {
        Add-Content -Path $gitignorePath -Value "`n# Local environment variables (never commit!)`n.env.local"
        Write-Host "✅ Adicionado .env.local ao .gitignore" -ForegroundColor Green
    }
} else {
    "# Local environment variables (never commit!)`n.env.local" | Out-File -FilePath $gitignorePath -Encoding UTF8
    Write-Host "✅ Criado .gitignore com .env.local" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔒 Configuração de Segurança:" -ForegroundColor Yellow
Write-Host "   1. O arquivo .env.local foi criado" -ForegroundColor White
Write-Host "   2. Este arquivo NÃO deve ser commitado" -ForegroundColor White
Write-Host "   3. Use 'source .env.local' no Linux/Mac ou carregue as variáveis no Windows" -ForegroundColor White
Write-Host ""

# Perguntar se deseja carregar as variáveis agora
$loadNow = Read-Host "Deseja carregar as variáveis de ambiente agora? (yes/no)"
if ($loadNow -eq "yes") {
    # Carregar variáveis no PowerShell atual
    Get-Content ".env.local" | ForEach-Object {
        if ($_ -match '^([^#].+?)=(.+)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "Env:$name" -Value $value
        }
    }
    Write-Host "✅ Variáveis de ambiente carregadas na sessão atual!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Agora você pode executar:" -ForegroundColor Cyan
    Write-Host "   .\deploy-staging.ps1    - Para deploy em staging" -ForegroundColor White
    Write-Host "   .\deploy-production.ps1 - Para deploy em produção" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "Para carregar as variáveis manualmente, execute:" -ForegroundColor Yellow
    Write-Host '   Get-Content ".env.local" | ForEach-Object { if ($_ -match "^([^#].+?)=(.+)$") { Set-Item -Path "Env:$($matches[1].Trim())" -Value $matches[2].Trim() } }' -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Configuração Concluída!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
