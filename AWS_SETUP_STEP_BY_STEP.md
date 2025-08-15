# 🚀 AWS Setup Completo - Passo a Passo do Zero

## 📋 Status do Checklist
- [ ] Conta AWS criada
- [ ] MongoDB Atlas configurado
- [ ] EC2 lançado
- [ ] S3 configurado
- [ ] Aplicação deployada
- [ ] Sistema funcionando

---

## PASSO 1: Criar e Configurar Conta AWS

### 1.1 Criar Conta AWS

1. **Acesse**: https://aws.amazon.com/pt/
2. **Clique em**: "Criar uma conta da AWS"
3. **Preencha**:
   - Email: seu-email@dominio.com
   - Senha: (forte, com 12+ caracteres)
   - Nome da conta AWS: "ChatSaaS-Dev"

4. **Informações de Contato**:
   - Tipo: Pessoal ou Profissional
   - Nome completo
   - Telefone (será verificado via SMS/ligação)
   - País: Brasil
   - Endereço completo

5. **Informações de Pagamento**:
   - Cartão de crédito (será cobrado $1 USD para verificação)
   - CPF/CNPJ

6. **Verificação**:
   - Escolha SMS ou ligação
   - Digite o código recebido

7. **Plano de Suporte**:
   - Selecione: **Basic (Free)**

### 1.2 Configurar Segurança Inicial

#### Ativar MFA (Multi-Factor Authentication)
```
1. Entre no Console AWS
2. Clique no seu nome (canto superior direito)
3. Selecione "Security credentials"
4. Em "Multi-factor authentication (MFA)", clique "Assign MFA device"
5. Escolha "Virtual MFA device"
6. Use o Google Authenticator ou Authy
7. Escaneie o QR Code
8. Digite dois códigos consecutivos
9. Clique "Assign MFA"
```

#### Criar Usuário IAM (Não use root!)
```
1. Acesse: Services > IAM
2. Clique em "Users" > "Add users"
3. User name: "admin-dev"
4. Access type: 
   ✅ AWS Management Console access
   ✅ Programmatic access
5. Console password: Custom password
6. Require password reset: Desmarcar
7. Next: Permissions
8. Attach existing policies:
   - AdministratorAccess (por enquanto)
9. Next: Tags
10. Add tag:
    - Key: Environment
    - Value: Development
11. Review and Create
12. SALVE as credenciais:
    - Access key ID
    - Secret access key
    - Console sign-in URL
```

### 1.3 Configurar Billing Alerts

```
1. Acesse: Services > Billing > Budgets
2. Clique "Create budget"
3. Budget type: Cost budget
4. Name: "Monthly-Dev-Budget"
5. Period: Monthly
6. Budget amount: $20.00
7. Configure alerts:
   - Threshold: 80% ($16)
   - Email: seu-email@dominio.com
8. Create budget
```

### 1.4 Instalar AWS CLI no Windows

```powershell
# No PowerShell como Admin
# Baixar e instalar AWS CLI
Invoke-WebRequest -Uri https://awscli.amazonaws.com/AWSCLIV2.msi -OutFile AWSCLIV2.msi
Start-Process msiexec.exe -Wait -ArgumentList '/i AWSCLIV2.msi /quiet'
Remove-Item AWSCLIV2.msi

# Verificar instalação
aws --version

# Configurar credenciais
aws configure
# Digite:
# AWS Access Key ID: [sua-access-key]
# AWS Secret Access Key: [sua-secret-key]
# Default region name: us-east-1
# Default output format: json
```

---

## PASSO 2: Configurar MongoDB Atlas

### 2.1 Criar Conta MongoDB Atlas

```
1. Acesse: https://www.mongodb.com/cloud/atlas
2. Clique "Try Free"
3. Preencha:
   - Email
   - First/Last name
   - Password
4. Verify email
```

### 2.2 Criar Cluster M0 (Free)

```
1. Choose a path: "Build a Database"
2. Deploy: 
   - FREE Shared
   - Provider: AWS
   - Region: N. Virginia (us-east-1) - MESMA DO EC2!
   - Cluster Name: "chat-saas-dev"
3. Create Cluster
```

### 2.3 Configurar Acesso

```
1. Security > Database Access
2. Add New Database User:
   - Username: chatadmin
   - Password: [gerar senha forte]
   - Role: Atlas Admin
3. Add User

4. Security > Network Access
5. Add IP Address:
   - Por enquanto: "Allow Access from Anywhere" (0.0.0.0/0)
   - Nota: Depois mudaremos para o IP do EC2
6. Confirm
```

### 2.4 Obter Connection String

```
1. Databases > Connect (no seu cluster)
2. Choose: "Connect your application"
3. Driver: Node.js
4. Version: 5.5 or later
5. Copie a connection string:
   mongodb+srv://chatadmin:<password>@chat-saas-dev.xxxxx.mongodb.net/?retryWrites=true&w=majority
6. SALVE esta string (substitua <password> pela senha real)
```

---

## PASSO 3: Lançar e Configurar EC2

### 3.1 Criar Key Pair (para SSH)

```powershell
# No PowerShell
aws ec2 create-key-pair `
  --key-name chat-key `
  --query 'KeyMaterial' `
  --output text | Out-File -Encoding ASCII -FilePath chat-key.pem

# Proteger a chave
icacls chat-key.pem /inheritance:r
icacls chat-key.pem /grant:r "${env:USERNAME}:F"
```

### 3.2 Criar Security Group

```powershell
# Criar security group
$sgId = aws ec2 create-security-group `
  --group-name chat-sg `
  --description "Security group for chat application" `
  --query 'GroupId' `
  --output text

Write-Host "Security Group ID: $sgId"

# Adicionar regras
# SSH
aws ec2 authorize-security-group-ingress `
  --group-id $sgId `
  --protocol tcp `
  --port 22 `
  --cidr 0.0.0.0/0

# HTTP
aws ec2 authorize-security-group-ingress `
  --group-id $sgId `
  --protocol tcp `
  --port 80 `
  --cidr 0.0.0.0/0

# HTTPS
aws ec2 authorize-security-group-ingress `
  --group-id $sgId `
  --protocol tcp `
  --port 443 `
  --cidr 0.0.0.0/0

# Node Backend (temporário, remover depois)
aws ec2 authorize-security-group-ingress `
  --group-id $sgId `
  --protocol tcp `
  --port 5000 `
  --cidr 0.0.0.0/0
```

### 3.3 Lançar Instância EC2

```powershell
# Obter AMI mais recente do Amazon Linux 2023
$amiId = aws ec2 describe-images `
  --owners amazon `
  --filters "Name=name,Values=al2023-ami-*-x86_64" "Name=state,Values=available" `
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' `
  --output text

Write-Host "AMI ID: $amiId"

# Lançar instância
$instanceId = aws ec2 run-instances `
  --image-id $amiId `
  --instance-type t2.micro `
  --key-name chat-key `
  --security-group-ids $sgId `
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=chat-dev},{Key=Environment,Value=development}]' `
  --query 'Instances[0].InstanceId' `
  --output text

Write-Host "Instance ID: $instanceId"

# Aguardar instância ficar pronta
Write-Host "Aguardando instância iniciar..."
aws ec2 wait instance-running --instance-ids $instanceId
Write-Host "Instância pronta!"
```

### 3.4 Alocar Elastic IP

```powershell
# Alocar Elastic IP
$allocationId = aws ec2 allocate-address `
  --query 'AllocationId' `
  --output text

# Associar ao EC2
aws ec2 associate-address `
  --instance-id $instanceId `
  --allocation-id $allocationId

# Obter o IP público
$publicIp = aws ec2 describe-addresses `
  --allocation-ids $allocationId `
  --query 'Addresses[0].PublicIp' `
  --output text

Write-Host "Elastic IP: $publicIp"
Write-Host "Salve este IP! Você vai usar para acessar o servidor."

# Salvar informações em arquivo
@"
Instance ID: $instanceId
Security Group ID: $sgId
Elastic IP: $publicIp
AMI ID: $amiId
"@ | Out-File -FilePath aws-resources.txt
```

---

## PASSO 4: Criar Buckets S3

### 4.1 Script para criar buckets

```powershell
# Definir nome único (adicione números aleatórios ou seu identificador)
$bucketPrefix = "chat-saas-dev-" + (Get-Random -Maximum 99999)

# Criar bucket para uploads
aws s3 mb "s3://$bucketPrefix-uploads"

# Criar bucket para static files
aws s3 mb "s3://$bucketPrefix-static"

# Criar bucket para backups
aws s3 mb "s3://$bucketPrefix-backups"

Write-Host "Buckets criados:"
Write-Host "- $bucketPrefix-uploads"
Write-Host "- $bucketPrefix-static"
Write-Host "- $bucketPrefix-backups"

# Salvar nomes dos buckets
@"
UPLOAD_BUCKET=$bucketPrefix-uploads
STATIC_BUCKET=$bucketPrefix-static
BACKUP_BUCKET=$bucketPrefix-backups
"@ | Out-File -Append -FilePath aws-resources.txt
```

### 4.2 Configurar CORS para upload bucket

Crie o arquivo `cors-config.json`:

```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

Aplicar configuração:

```powershell
# Aplicar CORS
aws s3api put-bucket-cors `
  --bucket "$bucketPrefix-uploads" `
  --cors-configuration file://cors-config.json

# Configurar política de acesso público para leitura
$policyJson = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$bucketPrefix-uploads/*"
    }
  ]
}
"@

$policyJson | Out-File -FilePath bucket-policy.json -Encoding UTF8

aws s3api put-bucket-policy `
  --bucket "$bucketPrefix-uploads" `
  --policy file://bucket-policy.json
```

---

## PASSO 5: Conectar ao EC2 e Instalar Ambiente

### 5.1 Conectar via SSH

```powershell
# Usar o IP que salvamos anteriormente
$publicIp = "SEU-ELASTIC-IP-AQUI"

# Conectar
ssh -i chat-key.pem ec2-user@$publicIp

# Se der erro de permissão no Windows, use:
ssh -i chat-key.pem -o StrictHostKeyChecking=no ec2-user@$publicIp
```

### 5.2 Script de Setup do Ambiente (executar no EC2)

Uma vez conectado ao EC2, execute:

```bash
#!/bin/bash
# setup-environment.sh

# Atualizar sistema
sudo yum update -y

# Instalar Git
sudo yum install git -y

# Instalar Node.js via NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
node --version

# Instalar PM2 globalmente
npm install -g pm2

# Instalar Nginx
sudo yum install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx

# Instalar build tools (necessário para alguns pacotes npm)
sudo yum groupinstall "Development Tools" -y

# Criar diretórios
mkdir -p ~/apps
cd ~/apps

echo "✅ Ambiente básico instalado!"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "PM2 version: $(pm2 --version)"
```

---

## PASSO 6: Deploy da Aplicação

### 6.1 Clonar e Configurar Projeto

No EC2, continue:

```bash
# Clonar seu repositório (substitua pela URL real)
cd ~/apps
git clone https://github.com/seu-usuario/chat-atendimento.git
cd chat-atendimento

# Criar arquivo de variáveis de ambiente
cat > backend/.env << 'EOF'
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://chatadmin:SENHA@chat-saas-dev.xxxxx.mongodb.net/chat-prod?retryWrites=true&w=majority
JWT_SECRET=seu_jwt_secret_super_seguro_mude_isso_em_producao_32caracteres
JWT_EXPIRE=7d
CLIENT_URL=http://SEU-ELASTIC-IP
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# S3 Configuration
AWS_REGION=us-east-1
S3_UPLOAD_BUCKET=SEU-BUCKET-uploads
S3_STATIC_BUCKET=SEU-BUCKET-static
EOF

# Frontend .env
cat > frontend/.env << 'EOF'
VITE_API_URL=http://SEU-ELASTIC-IP:5000/api
VITE_SOCKET_URL=http://SEU-ELASTIC-IP:5000
EOF
```

### 6.2 Instalar Dependências e Build

```bash
# Backend
cd ~/apps/chat-atendimento/backend
npm install

# Frontend
cd ~/apps/chat-atendimento/frontend
npm install
npm run build

# Voltar ao diretório raiz
cd ~/apps/chat-atendimento
```

### 6.3 Iniciar com PM2

```bash
# Criar ecosystem file para PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'chat-backend',
    script: './backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Criar diretório de logs
mkdir -p logs

# Iniciar aplicação
pm2 start ecosystem.config.js

# Salvar configuração do PM2
pm2 save

# Configurar PM2 para iniciar no boot
pm2 startup systemd -u ec2-user --hp /home/ec2-user
# Execute o comando que o PM2 sugerir (com sudo)

# Verificar status
pm2 status
pm2 logs --lines 50
```

---

## PASSO 7: Configurar Nginx

### 7.1 Configurar Proxy Reverso

```bash
# Criar configuração do Nginx
sudo tee /etc/nginx/conf.d/chat.conf << 'EOF'
server {
    listen 80;
    server_name _;
    
    # Logs
    access_log /var/log/nginx/chat.access.log;
    error_log /var/log/nginx/chat.error.log;
    
    # Frontend
    location / {
        root /home/ec2-user/apps/chat-atendimento/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:5000;
    }
}
EOF

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx

# Verificar status
sudo systemctl status nginx
```

---

## PASSO 8: Integração com S3

### 8.1 Instalar AWS SDK no Backend

```bash
cd ~/apps/chat-atendimento/backend
npm install aws-sdk multer-s3
```

### 8.2 Criar Configuração S3

Crie o arquivo `backend/config/s3.js`:

```javascript
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

// Configurar AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();

// Configurar Multer S3
const uploadS3 = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_UPLOAD_BUCKET,
    acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const userId = req.user ? req.user._id : 'anonymous';
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const filename = `${userId}/${timestamp}-${Math.random().toString(36).substring(7)}${ext}`;
      cb(null, filename);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp3|wav|m4a|mp4|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

module.exports = { s3, uploadS3 };
```

### 8.3 Atualizar Controller de Upload

Modificar `backend/controllers/fileController.js`:

```javascript
const { uploadS3 } = require('../config/s3');

// Substituir o upload local pelo S3
exports.uploadFile = [
  uploadS3.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileData = {
        filename: req.file.key,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: req.file.location,
        uploadedBy: req.user._id
      };

      // Salvar no banco se necessário
      const file = new File(fileData);
      await file.save();

      res.json({
        success: true,
        file: fileData
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
];
```

---

## PASSO 9: Configurar CloudWatch

### 9.1 Instalar CloudWatch Agent

No EC2:

```bash
# Baixar e instalar CloudWatch Agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
sudo rpm -U ./amazon-cloudwatch-agent.rpm

# Criar configuração
sudo tee /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOF'
{
  "metrics": {
    "namespace": "ChatSaaS",
    "metrics_collected": {
      "mem": {
        "measurement": [
          {"name": "mem_used_percent", "rename": "MemoryUtilization"}
        ]
      },
      "disk": {
        "measurement": [
          {"name": "used_percent", "rename": "DiskUtilization"}
        ],
        "resources": ["/"]
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/home/ec2-user/apps/chat-atendimento/logs/**.log",
            "log_group_name": "/aws/ec2/chat-app",
            "log_stream_name": "{instance_id}/app"
          },
          {
            "file_path": "/var/log/nginx/**.log",
            "log_group_name": "/aws/ec2/chat-app",
            "log_stream_name": "{instance_id}/nginx"
          }
        ]
      }
    }
  }
}
EOF

# Iniciar CloudWatch Agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
```

### 9.2 Criar Dashboard no Console AWS

```powershell
# No PowerShell local, criar dashboard
$dashboardBody = @'
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/EC2", "CPUUtilization", {"stat": "Average"}],
          ["ChatSaaS", "MemoryUtilization", {"stat": "Average"}],
          ["ChatSaaS", "DiskUtilization", {"stat": "Average"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "System Metrics"
      }
    }
  ]
}
'@

aws cloudwatch put-dashboard `
  --dashboard-name ChatSaaS-Dev `
  --dashboard-body $dashboardBody
```

---

## PASSO 10: Testes Finais

### 10.1 Verificar Aplicação

```bash
# No EC2
# Verificar se backend está rodando
curl http://localhost:5000/health

# Verificar PM2
pm2 status
pm2 logs --lines 100

# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx

# Verificar MongoDB Atlas connection
pm2 logs chat-backend --lines 50 | grep -i mongo
```

### 10.2 Testar do Browser

1. Abra o browser
2. Acesse: `http://SEU-ELASTIC-IP`
3. Teste:
   - [ ] Página carrega
   - [ ] Login/Register funciona
   - [ ] Chat funciona
   - [ ] Upload de arquivos
   - [ ] WebSockets conecta

### 10.3 Script de Teste Completo

```powershell
# No PowerShell local
$publicIp = "SEU-ELASTIC-IP"

# Testar health
Invoke-RestMethod -Uri "http://$publicIp/api/health"

# Testar registro
$body = @{
    name = "Test User"
    email = "test@example.com"
    password = "Test123456"
    role = "client"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://$publicIp/api/auth/register" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

---

## 🎯 TROUBLESHOOTING

### Problema: Site não carrega
```bash
# Verificar Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log

# Verificar PM2
pm2 logs
pm2 restart chat-backend
```

### Problema: MongoDB não conecta
```bash
# Verificar connection string
cat backend/.env | grep MONGODB

# Testar conexão
npm install -g mongodb
mongosh "sua-connection-string"
```

### Problema: Upload S3 não funciona
```bash
# Verificar credenciais AWS
aws s3 ls

# Verificar permissões do bucket
aws s3api get-bucket-policy --bucket seu-bucket
```

---

## ✅ CHECKLIST FINAL

- [ ] EC2 rodando e acessível
- [ ] MongoDB Atlas conectado
- [ ] S3 buckets criados e configurados
- [ ] Aplicação deployada com PM2
- [ ] Nginx configurado
- [ ] CloudWatch monitorando
- [ ] Site acessível via HTTP
- [ ] Login/Register funcionando
- [ ] Chat funcionando
- [ ] Upload de arquivos funcionando
- [ ] WebSockets conectando

---

## 🚀 PRÓXIMOS PASSOS

1. **Configurar Domínio**: Route 53 ou seu DNS
2. **Adicionar SSL**: Let's Encrypt com Certbot
3. **Backup Automático**: Script cron para MongoDB
4. **CI/CD**: GitHub Actions para deploy automático
5. **Staging Environment**: Duplicar setup para testes

Parabéns! Seu sistema está rodando na AWS! 🎉
