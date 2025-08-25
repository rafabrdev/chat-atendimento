const swaggerJsdoc = require('swagger-jsdoc');
const fs = require('fs');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chat Atendimento API',
      version: '1.0.0',
      description: `
        API REST para sistema de chat de atendimento em tempo real.
        
        ## Funcionalidades
        - Autenticação JWT
        - Chat em tempo real com WebSocket
        - Upload de arquivos (AWS S3)
        - Gerenciamento de atendentes
        - Fila de atendimento
        - Dashboard administrativo
        - Histórico e análises
        
        ## Ambientes
        - **Desenvolvimento**: http://localhost:5000
        - **Staging**: http://52.90.17.204:5000
        - **Produção**: https://api.brsi.com.br
        
        ## Autenticação
        Todas as rotas (exceto login e register) requerem autenticação via JWT.
        Envie o token no header: Authorization: Bearer {token}
      `,
      contact: {
        name: 'BR Sistemas',
        email: 'suporte@brsi.com.br',
        url: 'https://brsi.com.br'
      },
      license: {
        name: 'Proprietary',
        url: 'https://brsi.com.br/terms'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Servidor de Desenvolvimento (Local)'
      },
      {
        url: 'http://52.90.17.204:5000/api',
        description: 'Servidor de Staging (Testes)'
      },
      {
        url: 'https://api.brsi.com.br/api',
        description: 'Servidor de Produção'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Digite o token JWT obtido no login'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { 
              type: 'string',
              description: 'ID único do usuário',
              example: '60d0fe4f5311236168a109ca'
            },
            name: { 
              type: 'string',
              description: 'Nome completo do usuário',
              example: 'João Silva'
            },
            email: { 
              type: 'string', 
              format: 'email',
              description: 'Email do usuário',
              example: 'joao@brsi.com.br'
            },
            role: { 
              type: 'string', 
              enum: ['agent', 'admin', 'client'],
              description: 'Papel do usuário no sistema',
              example: 'agent'
            },
            status: {
              type: 'string',
              enum: ['online', 'away', 'busy', 'offline'],
              description: 'Status atual do usuário',
              example: 'online'
            },
            isActive: { 
              type: 'boolean',
              description: 'Se o usuário está ativo',
              example: true
            },
            avatar: {
              type: 'string',
              description: 'URL do avatar do usuário',
              example: 'https://chat-staging.s3.amazonaws.com/avatars/user123.jpg'
            },
            createdAt: { 
              type: 'string', 
              format: 'date-time',
              description: 'Data de criação',
              example: '2024-01-15T10:30:00Z'
            },
            updatedAt: { 
              type: 'string', 
              format: 'date-time',
              description: 'Última atualização',
              example: '2024-01-20T15:45:00Z'
            }
          }
        },
        Chat: {
          type: 'object',
          properties: {
            _id: { 
              type: 'string',
              description: 'ID único da conversa',
              example: '60d0fe4f5311236168a109cb'
            },
            subject: {
              type: 'string',
              description: 'Assunto da conversa',
              example: 'Dúvida sobre produto'
            },
            customer: {
              type: 'object',
              description: 'Dados do cliente',
              properties: {
                _id: { type: 'string' },
                name: { 
                  type: 'string',
                  example: 'Maria Santos'
                },
                email: { 
                  type: 'string', 
                  format: 'email',
                  example: 'maria@example.com'
                }
              }
            },
            agent: { 
              type: 'string',
              description: 'ID do agente atribuído',
              example: '60d0fe4f5311236168a109ca'
            },
            status: { 
              type: 'string', 
              enum: ['waiting', 'active', 'closed'],
              description: 'Status atual da conversa',
              example: 'active'
            },
            department: {
              type: 'string',
              description: 'Departamento responsável',
              example: 'vendas'
            },
            rating: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: 'Avaliação do atendimento',
              example: 5
            },
            ratingComment: {
              type: 'string',
              description: 'Comentário da avaliação',
              example: 'Atendimento excelente!'
            },
            createdAt: { 
              type: 'string', 
              format: 'date-time',
              description: 'Data de criação'
            },
            closedAt: { 
              type: 'string', 
              format: 'date-time',
              description: 'Data de encerramento'
            },
            lastActivity: {
              type: 'string',
              format: 'date-time',
              description: 'Última atividade na conversa'
            }
          }
        },
        Message: {
          type: 'object',
          properties: {
            _id: { 
              type: 'string',
              description: 'ID único da mensagem'
            },
            conversationId: { 
              type: 'string',
              description: 'ID da conversa'
            },
            sender: { 
              type: 'string',
              description: 'ID do remetente'
            },
            senderType: { 
              type: 'string', 
              enum: ['customer', 'agent', 'system'],
              description: 'Tipo do remetente'
            },
            content: { 
              type: 'string',
              description: 'Conteúdo da mensagem',
              example: 'Olá, como posso ajudar?'
            },
            type: {
              type: 'string',
              enum: ['text', 'image', 'file', 'audio'],
              description: 'Tipo de mensagem',
              example: 'text'
            },
            file: { 
              type: 'object',
              description: 'Arquivo anexado (se houver)',
              properties: {
                url: { type: 'string' },
                name: { type: 'string' },
                size: { type: 'number' },
                mimetype: { type: 'string' }
              }
            },
            readBy: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  readAt: { type: 'string', format: 'date-time' }
                }
              },
              description: 'Usuários que leram a mensagem'
            },
            createdAt: { 
              type: 'string', 
              format: 'date-time',
              description: 'Data de envio'
            }
          }
        },
        File: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            filename: { 
              type: 'string',
              description: 'Nome do arquivo',
              example: 'documento.pdf'
            },
            originalName: { 
              type: 'string',
              description: 'Nome original do arquivo'
            },
            mimetype: { 
              type: 'string',
              description: 'Tipo MIME',
              example: 'application/pdf'
            },
            size: { 
              type: 'number',
              description: 'Tamanho em bytes',
              example: 1024000
            },
            s3Key: {
              type: 'string',
              description: 'Chave no S3'
            },
            s3Bucket: {
              type: 'string',
              description: 'Bucket do S3',
              example: 'chat-staging'
            },
            url: { 
              type: 'string',
              description: 'URL pública do arquivo'
            },
            conversationId: {
              type: 'string',
              description: 'ID da conversa associada'
            },
            uploadedBy: {
              type: 'string',
              description: 'ID do usuário que fez o upload'
            },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { 
              type: 'boolean', 
              default: false,
              example: false
            },
            error: { 
              type: 'string',
              description: 'Mensagem de erro',
              example: 'Token inválido ou expirado'
            },
            details: {
              type: 'object',
              description: 'Detalhes adicionais do erro'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              default: true,
              example: true
            },
            message: {
              type: 'string',
              description: 'Mensagem de sucesso',
              example: 'Operação realizada com sucesso'
            },
            data: {
              type: 'object',
              description: 'Dados retornados'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Auth',
        description: 'Autenticação e autorização de usuários'
      },
      {
        name: 'Chat',
        description: 'Gerenciamento de conversas de chat'
      },
      {
        name: 'Messages',
        description: 'Mensagens dentro das conversas'
      },
      {
        name: 'Users',
        description: 'Gerenciamento de usuários e agentes'
      },
      {
        name: 'Files',
        description: 'Upload e gerenciamento de arquivos'
      },
      {
        name: 'History',
        description: 'Histórico e análises de conversas'
      },
      {
        name: 'Health',
        description: 'Status e saúde do servidor'
      }
    ]
  },
  apis: [
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../server.js')
  ]
};

try {
  // Gerar a especificação Swagger
  const swaggerSpec = swaggerJsdoc(options);
  
  // Adicionar informações extras
  swaggerSpec.info.version = require('../package.json').version || '1.0.0';
  
  // Salvar em arquivo JSON
  const outputPath = path.join(__dirname, '../swagger.json');
  fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));
  
  console.log('✅ Arquivo swagger.json gerado com sucesso!');
  console.log(`📁 Localização: ${outputPath}`);
  console.log(`📊 Total de endpoints documentados: ${Object.keys(swaggerSpec.paths || {}).length}`);
  console.log(`🌐 Ambientes configurados: ${swaggerSpec.servers.length}`);
  
  // Mostrar resumo dos endpoints
  if (swaggerSpec.paths) {
    console.log('\n📋 Endpoints documentados:');
    
    // Agrupar por tag
    const endpointsByTag = {};
    
    Object.keys(swaggerSpec.paths).forEach(path => {
      const methods = Object.keys(swaggerSpec.paths[path]);
      methods.forEach(method => {
        const endpoint = swaggerSpec.paths[path][method];
        const tags = endpoint.tags || ['Outros'];
        
        tags.forEach(tag => {
          if (!endpointsByTag[tag]) {
            endpointsByTag[tag] = [];
          }
          endpointsByTag[tag].push({
            method: method.toUpperCase(),
            path,
            summary: endpoint.summary || 'Sem descrição'
          });
        });
      });
    });
    
    // Exibir agrupado por tag
    Object.keys(endpointsByTag).sort().forEach(tag => {
      console.log(`\n  [${tag}]`);
      endpointsByTag[tag].forEach(endpoint => {
        console.log(`    ${endpoint.method.padEnd(7)} ${endpoint.path}`);
        console.log(`            ${endpoint.summary}`);
      });
    });
  }
  
  console.log('\n✨ Para visualizar a documentação interativa:');
  console.log('   1. Inicie o servidor: npm run dev');
  console.log('   2. Acesse: http://localhost:5000/api-docs');
  
} catch (error) {
  console.error('❌ Erro ao gerar swagger.json:', error);
  process.exit(1);
}
