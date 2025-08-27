# Chat Acceptance Concurrency Control Documentation

## Overview

This document describes the concurrency control system implemented to prevent race conditions when multiple agents attempt to accept the same chat conversation simultaneously. The system ensures that only one agent can successfully accept a chat, maintaining data consistency and providing clear feedback to agents.

## Problem Statement

In a multi-agent chat system, multiple agents might try to accept the same waiting conversation at the exact same moment. Without proper concurrency control, this can lead to:

- **Race Conditions**: Multiple agents thinking they've accepted the same chat
- **Data Inconsistency**: Database showing conflicting assignment states  
- **Poor User Experience**: Agents working on the same conversation unknowingly
- **Resource Waste**: Multiple agents spending time on the same customer

## Solution Architecture

### Components

```
┌─────────────────────┐
│   Chat Routes       │
│  /accept endpoint   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Chat Service      │
│ assignConversation  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Lock Service      │
│ Distributed Locks   │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌────────┐  ┌────────────┐
│ Redis  │  │  In-Memory │
│(if avl)│  │  Fallback  │
└────────┘  └────────────┘
```

### Key Features

1. **Distributed Lock System**: Prevents multiple agents from modifying the same conversation
2. **Automatic Retry Logic**: Exponential backoff for failed attempts
3. **Transaction Support**: MongoDB transactions ensure atomicity
4. **Graceful Degradation**: Falls back to in-memory locks if Redis unavailable
5. **Lock Expiration**: Automatic cleanup of abandoned locks
6. **Event Monitoring**: Track lock lifecycle and statistics

## Implementation Details

### Lock Service

The `lockService.js` provides a robust locking mechanism:

```javascript
// Acquire a lock for accepting a chat
const lockResult = await lockService.acquire(
  `conversation:${conversationId}`,  // Resource identifier
  `agent:${agentId}`,                 // Lock holder
  {
    ttl: 10000,        // 10 second timeout
    retry: true,       // Enable retry
    maxRetries: 3,     // Max 3 attempts
    retryDelay: 200    // 200ms initial delay
  }
);

if (lockResult.success) {
  try {
    // Perform chat acceptance logic
    await acceptChat();
  } finally {
    // Always release the lock
    await lockService.release(resource, lockResult.token);
  }
} else {
  // Another agent has the lock
  throw new Error(`Chat already being accepted by another agent`);
}
```

### Chat Service Integration

The `chatService.js` uses locks when accepting conversations:

```javascript
async assignConversationToAgent(conversationId, agentId) {
  // 1. Acquire exclusive lock
  const lockResource = `conversation:${conversationId}`;
  const lockHolder = `agent:${agentId}`;
  const lockResult = await lockService.acquire(lockResource, lockHolder, {
    ttl: 10000,
    retry: true,
    maxRetries: 3,
    retryDelay: 200
  });

  if (!lockResult.success) {
    // Handle lock failure
    throw new Error('Conversation already accepted by another agent');
  }

  try {
    // 2. Start MongoDB transaction
    const session = await Conversation.startSession();
    await session.startTransaction();

    try {
      // 3. Atomically update conversation
      const conversation = await Conversation.findOneAndUpdate(
        { _id: conversationId, status: 'waiting' },
        { 
          assignedAgent: agentId,
          status: 'active'
        },
        { new: true, session }
      );

      if (!conversation) {
        throw new Error('Conversation no longer available');
      }

      // 4. Update related entities
      await QueueEntry.deleteOne({ conversationId }, { session });
      await User.findByIdAndUpdate(agentId, { status: 'busy' }, { session });

      // 5. Commit transaction
      await session.commitTransaction();
      return conversation;
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } finally {
    // 6. Always release lock
    await lockService.release(lockResource, lockResult.token);
  }
}
```

## API Usage

### Accept Chat Endpoint

**Endpoint**: `PATCH /api/chat/conversations/:id/accept`

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Success Response** (200):
```json
{
  "_id": "conversation123",
  "status": "active",
  "assignedAgent": {
    "_id": "agent456",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "client": {
    "_id": "client789",
    "name": "Jane Smith"
  }
}
```

**Concurrency Error Response** (400):
```json
{
  "error": "Conversa já foi aceita por Maria Silva"
}
```

## Lock Mechanisms

### 1. Redis Locks (Preferred)

When Redis is available, the system uses atomic SET NX operations:

```redis
SET lock:conversation:123 {"holder":"agent:456","token":"abc123"} NX PX 10000
```

- **NX**: Only set if key doesn't exist
- **PX**: Expiration in milliseconds
- **Atomic**: Single operation, no race conditions

### 2. In-Memory Locks (Fallback)

When Redis is unavailable, uses JavaScript Map with timeouts:

```javascript
locks.set('conversation:123', {
  holder: 'agent:456',
  token: 'abc123',
  expiresAt: Date.now() + 10000
});
```

**Limitations**:
- Not distributed across multiple servers
- Lost on server restart
- Suitable for single-server deployments

## Retry Strategy

The system implements exponential backoff for retries:

```
Attempt 1: Immediate
Attempt 2: Wait 200ms
Attempt 3: Wait 400ms
Attempt 4: Wait 800ms
```

Formula: `delay = initialDelay * (2 ^ attemptNumber)`

## Error Handling

### Common Scenarios

1. **Lock Acquisition Failure**
   - Cause: Another agent holds the lock
   - Response: Clear error message with holder info
   - User Action: Try accepting a different chat

2. **Lock Timeout**
   - Cause: Operation took longer than TTL
   - Response: Timeout error
   - User Action: Retry the operation

3. **Transaction Failure**
   - Cause: Database error during update
   - Response: Database error message
   - System Action: Automatic rollback, lock release

4. **Network Partition**
   - Cause: Redis connection lost
   - Response: Fallback to in-memory locks
   - System Action: Continue with degraded functionality

## Monitoring and Statistics

### Available Metrics

```javascript
const stats = lockService.getStats();
// Returns:
{
  acquired: 150,        // Successful lock acquisitions
  released: 145,        // Locks released
  expired: 5,           // Locks that expired
  conflicts: 23,        // Lock conflicts detected
  queued: 0,            // Requests in queue
  currentLocks: 2,      // Active locks
  backend: 'redis'      // Current backend (redis/memory)
}
```

### Event Monitoring

The lock service emits events for monitoring:

```javascript
lockService.on('lock:acquired', (data) => {
  console.log(`Lock acquired: ${data.resource} by ${data.holder}`);
});

lockService.on('lock:released', (data) => {
  console.log(`Lock released: ${data.resource}`);
});

lockService.on('lock:expired', (data) => {
  console.log(`Lock expired: ${data.resource}`);
  // Alert: Possible slow operation or crash
});

lockService.on('lock:conflict', (data) => {
  console.log(`Lock conflict: ${data.resource}`);
  // Metric: Track concurrency pressure
});
```

## Best Practices

### 1. Always Release Locks

```javascript
// Good: Using try/finally
const lock = await lockService.acquire(resource, holder);
try {
  await doWork();
} finally {
  await lockService.release(resource, lock.token);
}

// Better: Using withLock wrapper
await lockService.withLock(resource, holder, async () => {
  await doWork();
  // Lock automatically released even if error thrown
});
```

### 2. Set Appropriate TTLs

```javascript
// Short operation (< 1s): Use 5-10 second TTL
const lockOptions = { ttl: 5000 };

// Long operation (1-5s): Use 15-30 second TTL  
const lockOptions = { ttl: 20000 };

// Very long operation: Consider breaking into steps
```

### 3. Handle Lock Failures Gracefully

```javascript
try {
  await chatService.assignConversationToAgent(convId, agentId);
  showSuccessMessage('Chat accepted successfully');
} catch (error) {
  if (error.message.includes('já foi aceita')) {
    showWarningMessage('This chat was already accepted by another agent');
    refreshChatQueue();
  } else {
    showErrorMessage('Failed to accept chat. Please try again.');
  }
}
```

### 4. Monitor Lock Expiration

```javascript
// Set up monitoring for expired locks
lockService.on('lock:expired', async (data) => {
  // Log for investigation
  logger.warn('Lock expired', {
    resource: data.resource,
    holder: data.holder,
    previousHolder: data.previousHolder
  });
  
  // Alert if frequent expirations
  if (await getExpirationRate() > 0.05) { // > 5% expiration rate
    alertOps('High lock expiration rate detected');
  }
});
```

## Testing

### Unit Tests

Test the lock service in isolation:

```javascript
describe('Lock Service', () => {
  it('should prevent concurrent access', async () => {
    const resource = 'test:resource';
    
    // First agent gets lock
    const lock1 = await lockService.acquire(resource, 'agent:1');
    expect(lock1.success).to.be.true;
    
    // Second agent blocked
    const lock2 = await lockService.acquire(resource, 'agent:2', { retry: false });
    expect(lock2.success).to.be.false;
    
    // Release and retry
    await lockService.release(resource, lock1.token);
    const lock3 = await lockService.acquire(resource, 'agent:2');
    expect(lock3.success).to.be.true;
  });
});
```

### Integration Tests

Test the complete flow:

```javascript
describe('Chat Acceptance', () => {
  it('should handle concurrent acceptance attempts', async () => {
    const conversationId = 'conv123';
    
    // Simulate two agents accepting simultaneously
    const [result1, result2] = await Promise.allSettled([
      agentService.acceptChat(conversationId, 'agent1'),
      agentService.acceptChat(conversationId, 'agent2')
    ]);
    
    // Only one should succeed
    const successes = [result1, result2].filter(r => r.status === 'fulfilled');
    const failures = [result1, result2].filter(r => r.status === 'rejected');
    
    expect(successes).to.have.lengthOf(1);
    expect(failures).to.have.lengthOf(1);
  });
});
```

### Load Testing

Simulate high concurrency:

```javascript
// Stress test with 100 agents, 10 chats
const results = await loadTest({
  agents: 100,
  chats: 10,
  duration: '30s'
});

expect(results.successRate).to.be.above(0.95);
expect(results.avgResponseTime).to.be.below(500); // ms
expect(results.errors.duplicateAssignment).to.equal(0);
```

## Troubleshooting

### Issue: "Lock acquisition timeout"

**Symptoms**: Agents frequently see timeout errors

**Possible Causes**:
1. Lock TTL too short for operation
2. Deadlock situation
3. Lock not being released properly

**Solutions**:
```javascript
// 1. Increase TTL
const lockOptions = { ttl: 20000 }; // Increase from 10s to 20s

// 2. Check for deadlocks
const locks = await lockService.getCurrentLocks();
locks.forEach(lock => {
  if (Date.now() - lock.acquiredAt > 30000) {
    logger.error('Possible deadlock detected', lock);
  }
});

// 3. Ensure proper release
// Check logs for lock:acquired without corresponding lock:released
```

### Issue: "High conflict rate"

**Symptoms**: Many agents failing to accept chats

**Solutions**:
```javascript
// 1. Implement queue assignment
await queueService.assignNextAvailable(agentId);

// 2. Add jitter to reduce thundering herd
const jitter = Math.random() * 100;
await sleep(jitter);
await acceptChat(conversationId);

// 3. Implement agent zones/sharding
const zone = getAgentZone(agentId);
const chats = await getChatsForZone(zone);
```

### Issue: "Redis connection lost"

**Symptoms**: Fallback to in-memory locks

**Impact**: 
- Locks not distributed across servers
- Possible duplicate assignments in multi-server setup

**Solutions**:
```javascript
// 1. Monitor backend status
const health = lockService.getHealth();
if (health.backend === 'memory') {
  logger.warn('Operating without Redis - concurrency protection degraded');
}

// 2. Implement server affinity temporarily
// Route agents to specific servers during Redis outage

// 3. Set up Redis Sentinel for HA
const redis = new Redis({
  sentinels: [
    { host: 'sentinel1', port: 26379 },
    { host: 'sentinel2', port: 26379 }
  ],
  name: 'mymaster'
});
```

## Performance Considerations

### Lock Granularity

Use specific resource identifiers:

```javascript
// Good: Specific lock per conversation
const lock = `conversation:${conversationId}`;

// Bad: Global lock for all conversations
const lock = 'conversations:all';

// Better: Sharded locks for scale
const shard = conversationId.charCodeAt(0) % 10;
const lock = `conversation:shard:${shard}:${conversationId}`;
```

### Optimization Tips

1. **Batch Operations**: Acquire multiple locks at once when needed
2. **Lock-Free Reads**: Don't lock for read-only operations
3. **Optimistic Locking**: Use version fields for simple updates
4. **Circuit Breaker**: Fail fast when system is overloaded

## Security Considerations

1. **Lock Token Security**: Tokens are cryptographically random
2. **Lock Hijacking Prevention**: Only token holder can release
3. **Audit Trail**: All lock operations are logged
4. **Rate Limiting**: Prevent lock acquisition DoS

## Migration Guide

### From No Concurrency Control

1. **Phase 1**: Deploy lock service, monitor only
```javascript
// Log but don't block
const lock = await lockService.acquire(resource, holder, { 
  monitoring: true 
});
```

2. **Phase 2**: Enable for new conversations
```javascript
if (conversation.createdAt > MIGRATION_DATE) {
  // Use locks
} else {
  // Old behavior
}
```

3. **Phase 3**: Full enforcement
```javascript
// All conversations require locks
```

## Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_LOCK_TTL=10000

# Lock Service Configuration  
LOCK_DEFAULT_TTL=10000
LOCK_MAX_RETRIES=3
LOCK_RETRY_DELAY=200
LOCK_ENABLE_STATS=true
LOCK_ENABLE_EVENTS=true

# Fallback Configuration
LOCK_MEMORY_CLEANUP_INTERVAL=60000
LOCK_MEMORY_MAX_LOCKS=10000
```

### Runtime Configuration

```javascript
// Configure lock service at startup
lockService.configure({
  defaultTTL: 15000,
  enableQueue: true,
  statsInterval: 60000,
  eventEmitter: customEventEmitter
});
```

## Future Enhancements

1. **Distributed Queue**: Fair chat distribution algorithm
2. **Priority Locks**: VIP customers get priority
3. **Lock Metrics Dashboard**: Real-time visualization
4. **Smart Retry**: ML-based retry delay optimization
5. **Cross-Region Locks**: Global lock coordination

---

*Last Updated: January 2025*
*Version: 1.0.0*
