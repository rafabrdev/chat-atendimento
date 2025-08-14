@echo off
echo ===========================================
echo Sistema de Chat com Atendimento
echo ===========================================
echo.
echo IMPORTANTE: Campo empresa agora e obrigatorio!
echo.
echo Iniciando backend...
cd backend
start cmd /k "npm run dev"

echo Aguardando backend iniciar...
timeout /t 3 /nobreak > nul

echo Iniciando frontend...
cd ../frontend
start cmd /k "npm run dev"

echo.
echo ===========================================
echo Servidores iniciados!
echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
echo.
echo MUDANCAS IMPLEMENTADAS:
echo - Campo empresa obrigatorio no cadastro
echo - Nomes exibidos: "Nome Usuario (Empresa)"
echo - Tags de role: Cliente, Suporte, Admin, Fila
echo - Sistema 100%% em portugues
echo - Historico com export PDF/CSV
echo - Hierarquia: admin > agent > client
echo ===========================================
pause
