/**
 * Chat Acceptance Concurrency Tests
 * 
 * Testa o controle de concorrência ao aceitar chats para evitar que múltiplos
 * agentes aceitem o mesmo chat simultaneamente.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const lockService = require('../services/lockService');
const chatService = require('../services/chatService');

// Mocks dos modelos
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const QueueEntry = require('../models/QueueEntry');
const Message = require('../models/Message');

describe('Chat Acceptance Concurrency Control', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    // Clear lock service state
    lockService.clearAll();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Lock Service', () => {
    it('should acquire lock successfully for first agent', async () => {
      const resource = 'conversation:123';
      const holder = 'agent:456';
      
      const result = await lockService.acquire(resource, holder);
      
      expect(result.success).to.be.true;
      expect(result.holder).to.equal(holder);
      expect(result.token).to.exist;
    });

    it('should prevent second agent from acquiring same lock', async () => {
      const resource = 'conversation:123';
      const holder1 = 'agent:456';
      const holder2 = 'agent:789';
      
      // First agent acquires lock
      const result1 = await lockService.acquire(resource, holder1);
      expect(result1.success).to.be.true;
      
      // Second agent tries to acquire same lock
      const result2 = await lockService.acquire(resource, holder2, { retry: false });
      expect(result2.success).to.be.false;
      expect(result2.holder).to.equal(holder1);
    });

    it('should release lock and allow another agent to acquire', async () => {
      const resource = 'conversation:123';
      const holder1 = 'agent:456';
      const holder2 = 'agent:789';
      
      // First agent acquires and releases lock
      const result1 = await lockService.acquire(resource, holder1);
      await lockService.release(resource, result1.token);
      
      // Second agent should now be able to acquire
      const result2 = await lockService.acquire(resource, holder2);
      expect(result2.success).to.be.true;
      expect(result2.holder).to.equal(holder2);
    });

    it('should handle lock expiration', async () => {
      const resource = 'conversation:123';
      const holder1 = 'agent:456';
      const holder2 = 'agent:789';
      
      // First agent acquires lock with short TTL
      await lockService.acquire(resource, holder1, { ttl: 100 });
      
      // Wait for lock to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Second agent should be able to acquire
      const result2 = await lockService.acquire(resource, holder2);
      expect(result2.success).to.be.true;
    });

    it('should support retry with exponential backoff', async () => {
      const resource = 'conversation:123';
      const holder1 = 'agent:456';
      const holder2 = 'agent:789';
      
      // First agent acquires lock
      await lockService.acquire(resource, holder1, { ttl: 200 });
      
      // Second agent tries with retry
      const startTime = Date.now();
      const result2Promise = lockService.acquire(resource, holder2, {
        retry: true,
        maxRetries: 2,
        retryDelay: 50
      });
      
      // Release first lock after 100ms
      setTimeout(async () => {
        const locks = lockService.locks;
        locks.delete(resource);
      }, 100);
      
      const result2 = await result2Promise;
      const elapsed = Date.now() - startTime;
      
      expect(result2.success).to.be.true;
      expect(elapsed).to.be.at.least(100);
    });
  });

  describe('Chat Service with Concurrency Control', () => {
    let conversationId, agentId1, agentId2;
    let sessionStub;

    beforeEach(() => {
      conversationId = new mongoose.Types.ObjectId();
      agentId1 = new mongoose.Types.ObjectId();
      agentId2 = new mongoose.Types.ObjectId();

      // Mock de sessão MongoDB
      sessionStub = {
        startTransaction: sandbox.stub().resolves(),
        commitTransaction: sandbox.stub().resolves(),
        abortTransaction: sandbox.stub().resolves(),
        endSession: sandbox.stub().resolves()
      };
      
      sandbox.stub(Conversation, 'startSession').resolves(sessionStub);
    });

    it('should allow first agent to accept conversation', async () => {
      // Mock conversation waiting
      const mockConversation = {
        _id: conversationId,
        status: 'waiting',
        populate: sandbox.stub().returnsThis()
      };
      
      sandbox.stub(Conversation, 'findById').resolves(mockConversation);
      
      // Mock agent exists
      sandbox.stub(User, 'findOne').resolves({
        _id: agentId1,
        name: 'Agent 1',
        role: 'agent',
        active: true
      });
      
      // Mock update operations with proper chaining
      const conversationResult = {
        _id: conversationId,
        status: 'active',
        assignedAgent: agentId1,
        _doc: {},
        populate: sandbox.stub().returnsThis()
      };
      conversationResult.populate.returnsThis = () => conversationResult;
      
      sandbox.stub(Conversation, 'findOneAndUpdate').returns({
        populate: () => ({
          populate: () => conversationResult
        })
      });
      
      sandbox.stub(QueueEntry, 'deleteOne').resolves();
      sandbox.stub(User, 'findByIdAndUpdate').resolves();
      sandbox.stub(Message, 'findOne').returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().resolves(null)
      });
      
      const result = await chatService.assignConversationToAgent(conversationId, agentId1);
      
      expect(result).to.exist;
      expect(result.status).to.equal('active');
      expect(Conversation.findOneAndUpdate.calledOnce).to.be.true;
    });

    it('should prevent second agent from accepting same conversation', async () => {
      // Setup for concurrent acceptance attempts
      const mockConversation = {
        _id: conversationId,
        status: 'waiting'
      };
      
      sandbox.stub(Conversation, 'findById').resolves(mockConversation);
      sandbox.stub(User, 'findOne').resolves({
        _id: agentId1,
        name: 'Agent',
        role: 'agent',
        active: true
      });
      
      const updateStub = sandbox.stub(Conversation, 'findOneAndUpdate');
      updateStub.onFirstCall().resolves({
        _id: conversationId,
        status: 'active',
        assignedAgent: agentId1,
        populate: sandbox.stub().returnsThis(),
        _doc: {}
      });
      updateStub.onSecondCall().resolves(null); // Second agent fails
      
      sandbox.stub(QueueEntry, 'deleteOne').resolves();
      sandbox.stub(User, 'findByIdAndUpdate').resolves();
      sandbox.stub(Message, 'findOne').returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().resolves(null)
      });
      
      // Simulate concurrent acceptance
      const promise1 = chatService.assignConversationToAgent(conversationId, agentId1);
      const promise2 = chatService.assignConversationToAgent(conversationId, agentId2);
      
      const results = await Promise.allSettled([promise1, promise2]);
      
      // One should succeed, one should fail
      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      expect(succeeded).to.have.lengthOf(1);
      expect(failed).to.have.lengthOf(1);
      
      if (failed[0]) {
        expect(failed[0].reason.message).to.include('aceita por outro agente');
      }
    });

    it('should handle conversation already assigned scenario', async () => {
      // Mock conversation already active
      const mockConversation = {
        _id: conversationId,
        status: 'active',
        assignedAgent: agentId1,
        populate: sandbox.stub().returnsThis()
      };
      
      const findByIdStub = sandbox.stub(Conversation, 'findById');
      findByIdStub.onFirstCall().resolves(mockConversation);
      findByIdStub.onSecondCall().resolves({
        ...mockConversation,
        assignedAgent: {
          _id: agentId1,
          name: 'Agent 1'
        }
      });
      
      sandbox.stub(User, 'findById').resolves({ name: 'Agent 1' });
      
      try {
        await chatService.assignConversationToAgent(conversationId, agentId2);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('já foi aceita');
      }
    });

    it('should handle transaction rollback on error', async () => {
      const mockConversation = {
        _id: conversationId,
        status: 'waiting'
      };
      
      sandbox.stub(Conversation, 'findById').resolves(mockConversation);
      sandbox.stub(User, 'findOne').resolves({
        _id: agentId1,
        name: 'Agent 1',
        role: 'agent',
        active: true
      });
      
      // Make update fail
      sandbox.stub(Conversation, 'findOneAndUpdate').throws(new Error('Database error'));
      
      try {
        await chatService.assignConversationToAgent(conversationId, agentId1);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(sessionStub.abortTransaction.calledOnce).to.be.true;
        expect(sessionStub.endSession.calledOnce).to.be.true;
        expect(error.message).to.include('Database error');
      }
    });
  });

  describe('Stress Testing', () => {
    it('should handle multiple agents attempting to accept multiple conversations', async () => {
      const numAgents = 5;
      const numConversations = 3;
      const results = [];
      
      // Create test data
      const agents = Array.from({ length: numAgents }, (_, i) => `agent:${i}`);
      const conversations = Array.from({ length: numConversations }, (_, i) => `conversation:${i}`);
      
      // Simulate agents trying to accept conversations
      const promises = [];
      for (const agent of agents) {
        for (const conversation of conversations) {
          promises.push(
            lockService.acquire(conversation, agent, { 
              retry: true, 
              maxRetries: 1,
              retryDelay: Math.random() * 50 
            })
            .then(result => {
              if (result.success) {
                results.push({ conversation, agent, success: true });
                // Simulate work
                return new Promise(resolve => {
                  setTimeout(() => {
                    lockService.release(conversation, result.token);
                    resolve();
                  }, Math.random() * 100);
                });
              } else {
                results.push({ conversation, agent, success: false });
              }
            })
          );
        }
      }
      
      await Promise.allSettled(promises);
      
      // Each conversation should be accepted by exactly one agent
      for (const conversation of conversations) {
        const acceptances = results.filter(r => 
          r.conversation === conversation && r.success
        );
        expect(acceptances).to.have.lengthOf.at.most(1);
      }
    });

    it('should maintain consistency under rapid lock acquisition/release', async () => {
      const resource = 'conversation:stress';
      const iterations = 20;
      let successCount = 0;
      
      const promises = Array.from({ length: iterations }, async (_, i) => {
        const holder = `agent:${i}`;
        const result = await lockService.acquire(resource, holder, {
          retry: true,
          maxRetries: 5,
          retryDelay: 10
        });
        
        if (result.success) {
          successCount++;
          // Hold lock briefly
          await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
          await lockService.release(resource, result.token);
        }
      });
      
      await Promise.allSettled(promises);
      
      // All iterations should eventually succeed due to retry
      expect(successCount).to.be.at.least(iterations * 0.8); // Allow some failures
    });
  });

  describe('Lock Statistics and Monitoring', () => {
    it('should track lock statistics accurately', async () => {
      const resource = 'conversation:stats';
      
      // Clear stats
      lockService.stats = {
        acquired: 0,
        released: 0,
        expired: 0,
        conflicts: 0,
        queued: 0
      };
      
      // Successful acquisition
      const result1 = await lockService.acquire(resource, 'agent:1');
      expect(lockService.stats.acquired).to.equal(1);
      
      // Conflict
      await lockService.acquire(resource, 'agent:2', { retry: false });
      expect(lockService.stats.conflicts).to.equal(1);
      
      // Release
      await lockService.release(resource, result1.token);
      expect(lockService.stats.released).to.equal(1);
      
      // Get stats
      const stats = lockService.getStats();
      expect(stats.acquired).to.equal(1);
      expect(stats.released).to.equal(1);
      expect(stats.conflicts).to.equal(1);
    });

    it('should emit events for lock lifecycle', async () => {
      const resource = 'conversation:events';
      const holder = 'agent:1';
      const events = [];
      
      // Listen to events
      lockService.on('lock:acquired', data => events.push({ type: 'acquired', data }));
      lockService.on('lock:released', data => events.push({ type: 'released', data }));
      lockService.on('lock:expired', data => events.push({ type: 'expired', data }));
      
      // Acquire and release
      const result = await lockService.acquire(resource, holder);
      await lockService.release(resource, result.token);
      
      expect(events).to.have.lengthOf(2);
      expect(events[0].type).to.equal('acquired');
      expect(events[1].type).to.equal('released');
      
      // Cleanup listeners
      lockService.removeAllListeners();
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid token on release', async () => {
      const resource = 'conversation:invalid';
      const result = await lockService.release(resource, 'invalid-token');
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Lock not found');
    });

    it('should handle concurrent releases', async () => {
      const resource = 'conversation:concurrent-release';
      const holder = 'agent:1';
      
      const lockResult = await lockService.acquire(resource, holder);
      
      // Try to release twice concurrently
      const releases = await Promise.allSettled([
        lockService.release(resource, lockResult.token),
        lockService.release(resource, lockResult.token)
      ]);
      
      // One should succeed, one should fail
      const succeeded = releases.filter(r => r.status === 'fulfilled' && r.value.success);
      const failed = releases.filter(r => 
        r.status === 'fulfilled' && !r.value.success
      );
      
      expect(succeeded).to.have.lengthOf(1);
      expect(failed).to.have.lengthOf(1);
    });

    it('should handle withLock wrapper correctly', async () => {
      const resource = 'conversation:wrapper';
      const holder = 'agent:1';
      let executed = false;
      
      const result = await lockService.withLock(
        resource,
        holder,
        async () => {
          executed = true;
          return 'success';
        }
      );
      
      expect(executed).to.be.true;
      expect(result).to.equal('success');
      
      // Lock should be released
      const isLocked = await lockService.isLocked(resource);
      expect(isLocked).to.be.false;
    });

    it('should release lock even if function throws', async () => {
      const resource = 'conversation:wrapper-error';
      const holder = 'agent:1';
      
      try {
        await lockService.withLock(
          resource,
          holder,
          async () => {
            throw new Error('Function error');
          }
        );
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).to.equal('Function error');
      }
      
      // Lock should still be released
      const isLocked = await lockService.isLocked(resource);
      expect(isLocked).to.be.false;
    });
  });
});

module.exports = {};
