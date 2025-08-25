const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

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
      `,
      contact: {
        name: 'BR Sistemas',
        email: 'suporte@brsi.com.br',
        url: 'https://brsi.com.br'
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
          description: 'Digite o token JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['agent', 'admin'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Chat: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            customer: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string', format: 'email' }
              }
            },
            agent: { type: 'string' },
            status: { type: 'string', enum: ['waiting', 'active', 'closed'] },
            createdAt: { type: 'string', format: 'date-time' },
            closedAt: { type: 'string', format: 'date-time' }
          }
        },
        Message: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            chat: { type: 'string' },
            sender: { type: 'string' },
            senderType: { type: 'string', enum: ['customer', 'agent'] },
            content: { type: 'string' },
            file: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', default: false },
            error: { type: 'string' }
          }
        }
      }
    },
    tags: [
      {
        name: 'Auth',
        description: 'Autenticação e autorização'
      },
      {
        name: 'Chat',
        description: 'Gerenciamento de chats'
      },
      {
        name: 'Messages',
        description: 'Mensagens do chat'
      },
      {
        name: 'Users',
        description: 'Gerenciamento de usuários'
      },
      {
        name: 'Files',
        description: 'Upload e gerenciamento de arquivos'
      },
      {
        name: 'Health',
        description: 'Status do servidor'
      }
    ]
  },
  apis: ['./routes/*.js', './server.js'] // Arquivos onde estão as rotas documentadas
};

const swaggerSpec = swaggerJsdoc(options);

function setupSwagger(app) {
  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Chat Atendimento - API Docs',
    customfavIcon: '/favicon.ico'
  }));
  
  // JSON para ferramentas externas
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  
  console.log('📚 Swagger docs disponível em: /api-docs');
}

module.exports = { setupSwagger, swaggerSpec };
