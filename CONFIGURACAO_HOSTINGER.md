# 🌐 GUIA DE CONFIGURAÇÃO DO DOMÍNIO HOSTINGER
*Para a equipe de TI da BR Sistemas*

## 📋 INFORMAÇÕES DO DOMÍNIO

- **Domínio Principal**: brsi.net.br
- **Subdomínio Necessário**: suporte.brsi.net.br
- **IP do Servidor EC2**: 52.90.17.204
- **Região AWS**: us-east-1 (Norte da Virgínia)

---

## 🔧 CONFIGURAÇÃO DNS NO HOSTINGER

### OPÇÃO 1: Registro A (Recomendado)

1. **Acessar o Painel Hostinger**
   - URL: https://hpanel.hostinger.com.br
   - Fazer login com as credenciais da empresa

2. **Localizar o Domínio**
   - No painel, procurar por "brsi.net.br"
   - Clicar em "Gerenciar" ou "DNS Zone Editor"

3. **Adicionar Registro A**
   ```
   Tipo: A
   Nome: suporte
   Valor: 52.90.17.204
   TTL: 3600 (ou deixar padrão)
   ```

4. **Salvar Alterações**
   - Clicar em "Adicionar Registro" ou "Salvar"
   - Aguardar propagação DNS (até 48 horas, normalmente 1-4 horas)

### OPÇÃO 2: Registro CNAME (Alternativa)

Se preferir usar CNAME (caso o IP possa mudar):

```
Tipo: CNAME
Nome: suporte
Valor: ec2-52-90-17-204.compute-1.amazonaws.com
TTL: 3600
```

---

## 🔍 VERIFICAÇÃO DA CONFIGURAÇÃO

### 1. Testar Propagação DNS

Após configurar, verificar se o DNS está propagando:

```bash
# Windows (CMD ou PowerShell)
nslookup suporte.brsi.net.br

# Linux/Mac
dig suporte.brsi.net.br

# Online
https://www.whatsmydns.net/#A/suporte.brsi.net.br
```

### 2. Resultado Esperado

```
suporte.brsi.net.br -> 52.90.17.204
```

### 3. Testar Acesso

Após propagação completa:
- HTTP: http://suporte.brsi.net.br
- HTTPS: https://suporte.brsi.net.br (após configurar SSL)

---

## 🔒 CONFIGURAÇÃO SSL/HTTPS (PRÓXIMO PASSO)

### Opção 1: Let's Encrypt (Gratuito)

Após o domínio estar funcionando, no servidor EC2:

```bash
# Instalar Certbot
sudo yum install -y certbot python3-certbot-nginx

# Gerar certificado
sudo certbot --nginx -d suporte.brsi.net.br

# Renovação automática
sudo certbot renew --dry-run
```

### Opção 2: SSL da Hostinger

Se a Hostinger oferecer SSL:
1. Ativar SSL no painel Hostinger
2. Configurar proxy reverso se necessário

### Opção 3: AWS Certificate Manager

Para usar com CloudFront ou ALB da AWS.

---

## 📧 CONFIGURAÇÕES ADICIONAIS DE EMAIL (Opcional)

Se quiserem emails @suporte.brsi.net.br:

### Registros MX
```
Tipo: MX
Nome: suporte
Prioridade: 10
Valor: [servidor de email]
```

### Registros SPF
```
Tipo: TXT
Nome: suporte
Valor: "v=spf1 include:_spf.google.com ~all"
```

---

## ⚠️ PONTOS IMPORTANTES

### 1. Backup das Configurações Atuais
Antes de fazer alterações:
- Tirar screenshot das configurações DNS atuais
- Anotar todos os registros existentes

### 2. Tempo de Propagação
- Mínimo: 30 minutos
- Típico: 1-4 horas
- Máximo: 48 horas

### 3. Cache DNS
Orientar usuários a limpar cache se necessário:
```bash
# Windows
ipconfig /flushdns

# Mac
sudo dscacheutil -flushcache

# Linux
sudo systemd-resolve --flush-caches
```

### 4. Firewall e Portas
Verificar se as portas estão abertas no EC2:
- Porta 80 (HTTP)
- Porta 443 (HTTPS)
- Porta 3001 (Backend API)

---

## 📞 SUPORTE E CONTATOS

### Hostinger
- Suporte: https://www.hostinger.com.br/contato
- Chat ao vivo disponível no painel

### AWS/EC2
- Console AWS: https://console.aws.amazon.com
- Verificar Security Groups do EC2

### Desenvolvimento
- Rafael França (@rafabrdev)
- Repositório: https://github.com/rafabrdev/chat-atendimento

---

## 🎯 CHECKLIST PARA A EQUIPE DE TI

- [ ] Acessar painel Hostinger
- [ ] Localizar domínio brsi.net.br
- [ ] Adicionar registro A ou CNAME para "suporte"
- [ ] Salvar configurações
- [ ] Aguardar propagação DNS
- [ ] Testar acesso via http://suporte.brsi.net.br
- [ ] Notificar equipe de desenvolvimento quando concluído
- [ ] Configurar SSL (após domínio funcionar)

---

## 💡 DICAS

1. **Teste Gradual**: Primeiro configure e teste, depois adicione SSL
2. **Documentação**: Mantenha registro de todas as alterações
3. **Rollback**: Anote configurações antigas para reverter se necessário
4. **Monitoramento**: Use ferramentas como UptimeRobot para monitorar

---

*Documento criado em: 22/01/2025*
*Para: Equipe de TI - BR Sistemas*
