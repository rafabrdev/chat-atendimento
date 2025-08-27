const LockService = require('../../services/lockService');

describe('LockService', () => {
  let lockService;
  const testResource = 'test-resource';
  const testTenant = 'test-tenant';

  beforeEach(() => {
    // Use in-memory lock for testing
    lockService = new LockService();
  });

  afterEach(() => {
    // Clear all locks after each test
    lockService.locks.clear();
  });

  describe('acquireLock', () => {
    it('should acquire a lock successfully for a new resource', async () => {
      const lockAcquired = await lockService.acquireLock(testResource, testTenant);
      expect(lockAcquired).toBe(true);
      expect(lockService.locks.has(testResource)).toBe(true);
    });

    it('should fail to acquire lock when resource is already locked', async () => {
      // First lock should succeed
      const firstLock = await lockService.acquireLock(testResource, testTenant);
      expect(firstLock).toBe(true);

      // Second lock from different tenant should fail
      const secondLock = await lockService.acquireLock(testResource, 'other-tenant');
      expect(secondLock).toBe(false);
    });

    it('should handle lock timeout', async () => {
      const shortTTL = 100; // 100ms
      const lockAcquired = await lockService.acquireLock(testResource, testTenant, shortTTL);
      expect(lockAcquired).toBe(true);

      // Wait for lock to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be able to acquire lock again
      const newLock = await lockService.acquireLock(testResource, 'new-tenant');
      expect(newLock).toBe(true);
    });

    it('should handle multiple concurrent lock attempts', async () => {
      const attempts = 10;
      const results = await Promise.all(
        Array(attempts).fill().map((_, i) => 
          lockService.acquireLock(testResource, `tenant-${i}`)
        )
      );

      // Only one should succeed
      const successCount = results.filter(r => r === true).length;
      expect(successCount).toBe(1);
    });
  });

  describe('releaseLock', () => {
    it('should release an acquired lock', async () => {
      await lockService.acquireLock(testResource, testTenant);
      expect(lockService.locks.has(testResource)).toBe(true);

      await lockService.releaseLock(testResource, testTenant);
      expect(lockService.locks.has(testResource)).toBe(false);
    });

    it('should not release lock owned by different tenant', async () => {
      await lockService.acquireLock(testResource, testTenant);
      
      await lockService.releaseLock(testResource, 'other-tenant');
      // Lock should still exist
      expect(lockService.locks.has(testResource)).toBe(true);
    });

    it('should handle releasing non-existent lock gracefully', async () => {
      await expect(
        lockService.releaseLock('non-existent', testTenant)
      ).resolves.not.toThrow();
    });
  });

  describe('isLocked', () => {
    it('should return true for locked resource', async () => {
      await lockService.acquireLock(testResource, testTenant);
      const isLocked = await lockService.isLocked(testResource);
      expect(isLocked).toBe(true);
    });

    it('should return false for unlocked resource', async () => {
      const isLocked = await lockService.isLocked(testResource);
      expect(isLocked).toBe(false);
    });

    it('should return false for expired lock', async () => {
      const shortTTL = 50;
      await lockService.acquireLock(testResource, testTenant, shortTTL);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const isLocked = await lockService.isLocked(testResource);
      expect(isLocked).toBe(false);
    });
  });

  describe('withLock', () => {
    it('should execute function with lock', async () => {
      let executed = false;
      
      await lockService.withLock(testResource, testTenant, async () => {
        executed = true;
        // Check lock exists during execution
        expect(lockService.locks.has(testResource)).toBe(true);
      });

      expect(executed).toBe(true);
      // Lock should be released after execution
      expect(lockService.locks.has(testResource)).toBe(false);
    });

    it('should release lock even if function throws', async () => {
      const error = new Error('Test error');
      
      await expect(
        lockService.withLock(testResource, testTenant, async () => {
          throw error;
        })
      ).rejects.toThrow(error);

      // Lock should still be released
      expect(lockService.locks.has(testResource)).toBe(false);
    });

    it('should prevent concurrent execution', async () => {
      let counter = 0;
      const increment = async () => {
        const current = counter;
        await new Promise(resolve => setTimeout(resolve, 10));
        counter = current + 1;
      };

      // Without lock, these would result in race condition
      const results = await Promise.allSettled([
        lockService.withLock(testResource, 'tenant1', increment),
        lockService.withLock(testResource, 'tenant2', increment),
        lockService.withLock(testResource, 'tenant3', increment)
      ]);

      // Only one should succeed
      const successes = results.filter(r => r.status === 'fulfilled').length;
      expect(successes).toBe(1);
      expect(counter).toBe(1);
    });
  });

  describe('clearExpiredLocks', () => {
    it('should clear expired locks', async () => {
      const shortTTL = 50;
      
      // Create multiple locks with short TTL
      await lockService.acquireLock('resource1', 'tenant1', shortTTL);
      await lockService.acquireLock('resource2', 'tenant2', shortTTL);
      await lockService.acquireLock('resource3', 'tenant3', 1000);

      expect(lockService.locks.size).toBe(3);

      // Wait for first two to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      lockService.clearExpiredLocks();
      
      expect(lockService.locks.size).toBe(1);
      expect(lockService.locks.has('resource3')).toBe(true);
    });
  });
});
