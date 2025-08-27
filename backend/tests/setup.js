// Test Setup File
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Setup before all tests
beforeAll(async () => {
  // Setup in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Close any existing connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  // Connect to in-memory database
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

// Cleanup after all tests
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Clear database between tests
afterEach(async () => {
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.AWS_ACCESS_KEY_ID = 'test-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
process.env.S3_BUCKET = 'test-bucket';
process.env.S3_REGION = 'us-east-1';
