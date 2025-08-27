/**
 * CORS Multi-Tenant Usage Examples
 * 
 * This file demonstrates how to use the CORS multi-tenant system
 * in various scenarios.
 */

const axios = require('axios');

// ============================================
// 1. ADMIN PANEL - Managing CORS for a Tenant
// ============================================

class CORSManager {
  constructor(apiUrl, authToken) {
    this.api = axios.create({
      baseURL: `${apiUrl}/api/cors`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // Get current allowed origins
  async getOrigins() {
    try {
      const response = await this.api.get('/origins');
      console.log('Current origins:', response.data.origins);
      return response.data.origins;
    } catch (error) {
      console.error('Error fetching origins:', error.response?.data || error.message);
      throw error;
    }
  }

  // Add a new origin
  async addOrigin(origin) {
    try {
      const response = await this.api.post('/origins', { origin });
      console.log(`Origin ${origin} added successfully`);
      return response.data;
    } catch (error) {
      console.error('Error adding origin:', error.response?.data || error.message);
      throw error;
    }
  }

  // Add multiple origins at once
  async addMultipleOrigins(origins) {
    const results = [];
    for (const origin of origins) {
      try {
        const result = await this.addOrigin(origin);
        results.push({ origin, success: true, data: result });
      } catch (error) {
        results.push({ origin, success: false, error: error.message });
      }
    }
    return results;
  }

  // Remove an origin
  async removeOrigin(origin) {
    try {
      const response = await this.api.delete('/origins', { data: { origin } });
      console.log(`Origin ${origin} removed successfully`);
      return response.data;
    } catch (error) {
      console.error('Error removing origin:', error.response?.data || error.message);
      throw error;
    }
  }

  // Validate if an origin is allowed
  async validateOrigin(origin) {
    try {
      const response = await this.api.post('/validate', { origin });
      const { allowed, reason, suggestion } = response.data;
      
      if (allowed) {
        console.log(`✅ ${origin} is allowed (${reason})`);
      } else {
        console.log(`❌ ${origin} is blocked (${reason})`);
        if (suggestion) {
          console.log(`💡 Suggestion: Add pattern "${suggestion}"`);
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('Error validating origin:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get CORS statistics
  async getStatistics() {
    try {
      const response = await this.api.get('/stats');
      const stats = response.data.stats;
      
      console.log('=== CORS Statistics ===');
      console.log(`Total Requests: ${stats.totalRequests}`);
      console.log('\nTop Allowed Origins:');
      stats.allowed.slice(0, 5).forEach(item => {
        console.log(`  - ${item.origin}: ${item.count} requests`);
      });
      
      console.log('\nTop Blocked Origins:');
      stats.blocked.slice(0, 5).forEach(item => {
        console.log(`  - ${item.origin}: ${item.count} attempts`);
      });
      
      return stats;
    } catch (error) {
      console.error('Error fetching statistics:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get suggestions for frequently blocked origins
  async getSuggestions() {
    try {
      const response = await this.api.get('/suggestions');
      const suggestions = response.data.suggestions;
      
      if (suggestions.length > 0) {
        console.log('=== Origin Suggestions ===');
        suggestions.forEach(sugg => {
          console.log(`\n${sugg.origin}`);
          console.log(`  Blocked: ${sugg.blockedCount} times`);
          console.log(`  Suggested Pattern: ${sugg.suggestedPattern}`);
          console.log(`  Action: Consider adding "${sugg.suggestedPattern}" to allowed origins`);
        });
      } else {
        console.log('No suggestions available');
      }
      
      return suggestions;
    } catch (error) {
      console.error('Error fetching suggestions:', error.response?.data || error.message);
      throw error;
    }
  }

  // Clear cache
  async clearCache() {
    try {
      const response = await this.api.post('/cache/clear');
      console.log('Cache cleared successfully');
      return response.data;
    } catch (error) {
      console.error('Error clearing cache:', error.response?.data || error.message);
      throw error;
    }
  }

  // Health check
  async checkHealth() {
    try {
      const response = await this.api.get('/health');
      const health = response.data.health;
      
      console.log('=== CORS Service Health ===');
      console.log(`Status: ${health.status}`);
      console.log(`Cache Keys: ${health.cache.keys}`);
      console.log(`Total Allowed: ${health.stats.totalAllowed}`);
      console.log(`Total Blocked: ${health.stats.totalBlocked}`);
      console.log(`Active Tenants: ${health.stats.tenants}`);
      
      return health;
    } catch (error) {
      console.error('Error checking health:', error.response?.data || error.message);
      throw error;
    }
  }
}

// ============================================
// 2. PRACTICAL USAGE SCENARIOS
// ============================================

async function exampleUsage() {
  // Initialize the CORS manager
  const corsManager = new CORSManager(
    'https://api.example.com',
    'your-auth-token-here'
  );

  console.log('=== CORS Multi-Tenant Management Examples ===\n');

  // Scenario 1: Setting up CORS for a new tenant
  console.log('1. Setting up CORS for a new tenant:');
  try {
    // Add production origins
    await corsManager.addOrigin('https://app.example.com');
    await corsManager.addOrigin('https://www.example.com');
    
    // Add staging environment with wildcard
    await corsManager.addOrigin('*.staging.example.com');
    
    // Add development localhost
    await corsManager.addOrigin('http://localhost:*');
    
    console.log('✓ Initial CORS setup complete\n');
  } catch (error) {
    console.error('Setup failed:', error.message);
  }

  // Scenario 2: Validating origins before deployment
  console.log('2. Validating origins before deployment:');
  const originsToTest = [
    'https://app.example.com',        // Should be allowed
    'https://staging.example.com',    // Should be allowed (wildcard)
    'http://localhost:3000',          // Should be allowed (port wildcard)
    'https://malicious.site.com'      // Should be blocked
  ];

  for (const origin of originsToTest) {
    await corsManager.validateOrigin(origin);
  }
  console.log();

  // Scenario 3: Monitoring and optimization
  console.log('3. Monitoring CORS usage:');
  const stats = await corsManager.getStatistics();
  
  // Check if any origin has excessive blocked attempts
  const highBlockCount = stats.blocked.filter(b => b.count > 100);
  if (highBlockCount.length > 0) {
    console.log('\n⚠️  High block count detected for:');
    highBlockCount.forEach(item => {
      console.log(`  - ${item.origin}: ${item.count} blocks`);
    });
    
    // Get suggestions for these blocked origins
    const suggestions = await corsManager.getSuggestions();
    if (suggestions.length > 0) {
      console.log('\n💡 Consider adding these patterns:');
      suggestions.forEach(s => {
        console.log(`  - ${s.suggestedPattern} for ${s.origin}`);
      });
    }
  }
  console.log();

  // Scenario 4: Cleanup unused origins
  console.log('4. Cleaning up unused origins:');
  const currentOrigins = await corsManager.getOrigins();
  const allowedStats = stats.allowed.map(a => a.origin);
  
  // Find origins that haven't been used in the stats
  const unusedOrigins = currentOrigins.filter(origin => 
    !allowedStats.includes(origin) && 
    !origin.includes('*') // Don't remove wildcards
  );
  
  if (unusedOrigins.length > 0) {
    console.log('Found unused origins:');
    for (const origin of unusedOrigins) {
      console.log(`  - Removing: ${origin}`);
      await corsManager.removeOrigin(origin);
    }
  } else {
    console.log('No unused origins found');
  }
  console.log();

  // Scenario 5: Health monitoring
  console.log('5. System health check:');
  await corsManager.checkHealth();
}

// ============================================
// 3. AUTOMATED CORS MANAGEMENT
// ============================================

class AutomatedCORSManager extends CORSManager {
  constructor(apiUrl, authToken) {
    super(apiUrl, authToken);
    this.autoApproveThreshold = 10; // Auto-approve after 10 blocks
  }

  // Automatically approve frequently blocked origins
  async autoApproveOrigins() {
    try {
      const suggestions = await this.getSuggestions();
      const toApprove = suggestions.filter(s => s.blockedCount >= this.autoApproveThreshold);
      
      if (toApprove.length === 0) {
        console.log('No origins meet auto-approval threshold');
        return [];
      }

      console.log(`Auto-approving ${toApprove.length} origins:`);
      const approved = [];
      
      for (const suggestion of toApprove) {
        try {
          // Use the suggested pattern instead of exact origin
          const pattern = suggestion.suggestedPattern || suggestion.origin;
          await this.addOrigin(pattern);
          console.log(`  ✓ Approved: ${pattern}`);
          approved.push(pattern);
        } catch (error) {
          console.error(`  ✗ Failed to approve ${suggestion.origin}:`, error.message);
        }
      }
      
      return approved;
    } catch (error) {
      console.error('Auto-approval failed:', error);
      throw error;
    }
  }

  // Monitor and alert on suspicious activity
  async monitorSuspiciousActivity() {
    try {
      const stats = await this.getStatistics();
      const alerts = [];
      
      // Check for suspicious patterns
      stats.blocked.forEach(item => {
        // Alert on SQL injection attempts
        if (item.origin.includes('UNION') || item.origin.includes('SELECT')) {
          alerts.push({
            type: 'SQL_INJECTION_ATTEMPT',
            origin: item.origin,
            count: item.count
          });
        }
        
        // Alert on XSS attempts
        if (item.origin.includes('<script>') || item.origin.includes('javascript:')) {
          alerts.push({
            type: 'XSS_ATTEMPT',
            origin: item.origin,
            count: item.count
          });
        }
        
        // Alert on unusual port usage
        const portMatch = item.origin.match(/:(\d+)/);
        if (portMatch) {
          const port = parseInt(portMatch[1]);
          if (port > 10000 || [1337, 8888, 9999].includes(port)) {
            alerts.push({
              type: 'UNUSUAL_PORT',
              origin: item.origin,
              port: port,
              count: item.count
            });
          }
        }
      });
      
      if (alerts.length > 0) {
        console.log('⚠️  Security Alerts:');
        alerts.forEach(alert => {
          console.log(`  - ${alert.type}: ${alert.origin} (${alert.count} attempts)`);
        });
      }
      
      return alerts;
    } catch (error) {
      console.error('Monitoring failed:', error);
      throw error;
    }
  }

  // Scheduled maintenance task
  async performMaintenance() {
    console.log('=== Performing CORS Maintenance ===');
    
    // 1. Check health
    console.log('\n1. Health Check:');
    const health = await this.checkHealth();
    
    // 2. Clean cache if needed
    if (health.cache.keys > 100) {
      console.log('\n2. Clearing cache (too many keys)...');
      await this.clearCache();
    }
    
    // 3. Auto-approve frequently blocked origins
    console.log('\n3. Auto-approval check:');
    await this.autoApproveOrigins();
    
    // 4. Security monitoring
    console.log('\n4. Security monitoring:');
    await this.monitorSuspiciousActivity();
    
    // 5. Generate report
    console.log('\n5. Generating statistics report:');
    await this.getStatistics();
    
    console.log('\n✓ Maintenance complete');
  }
}

// ============================================
// 4. INTEGRATION WITH EXPRESS ROUTES
// ============================================

// Example: Custom route handler that checks CORS dynamically
function createCORSProtectedRoute(corsService) {
  return async (req, res, next) => {
    const origin = req.headers.origin;
    const tenantId = req.tenant?._id;
    
    if (!origin) {
      return next(); // No origin header, proceed
    }
    
    try {
      const validation = await corsService.validateRequest(origin, tenantId);
      
      if (validation.allowed) {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // Log the access
        corsService.logAccess(origin, tenantId, true);
        
        next();
      } else {
        // Log the blocked attempt
        corsService.logAccess(origin, tenantId, false);
        
        // Return CORS error
        res.status(403).json({
          error: 'CORS_BLOCKED',
          message: 'Origin not allowed',
          origin: origin,
          suggestion: validation.suggestion
        });
      }
    } catch (error) {
      console.error('CORS validation error:', error);
      res.status(500).json({
        error: 'CORS_ERROR',
        message: 'Failed to validate origin'
      });
    }
  };
}

// ============================================
// 5. MIGRATION HELPER
// ============================================

class CORSMigrationHelper {
  constructor(corsManager) {
    this.corsManager = corsManager;
  }

  // Migrate from a static CORS configuration
  async migrateFromStatic(staticOrigins) {
    console.log('=== Migrating from Static CORS ===');
    console.log(`Migrating ${staticOrigins.length} origins...`);
    
    const results = {
      success: [],
      failed: [],
      skipped: []
    };
    
    // Get current origins to avoid duplicates
    const currentOrigins = await this.corsManager.getOrigins();
    
    for (const origin of staticOrigins) {
      if (currentOrigins.includes(origin)) {
        console.log(`  ⊘ Skipping ${origin} (already exists)`);
        results.skipped.push(origin);
        continue;
      }
      
      try {
        await this.corsManager.addOrigin(origin);
        console.log(`  ✓ Migrated ${origin}`);
        results.success.push(origin);
      } catch (error) {
        console.log(`  ✗ Failed to migrate ${origin}: ${error.message}`);
        results.failed.push({ origin, error: error.message });
      }
    }
    
    console.log('\nMigration Summary:');
    console.log(`  Success: ${results.success.length}`);
    console.log(`  Failed: ${results.failed.length}`);
    console.log(`  Skipped: ${results.skipped.length}`);
    
    return results;
  }

  // Convert common patterns to wildcards
  convertToWildcards(origins) {
    const patterns = new Map();
    
    origins.forEach(origin => {
      // Extract domain from origin
      const match = origin.match(/^(https?):\/\/([^\/]+)/);
      if (!match) return;
      
      const protocol = match[1];
      const domain = match[2];
      
      // Check for subdomain pattern
      const parts = domain.split('.');
      if (parts.length > 2) {
        const baseDomain = parts.slice(-2).join('.');
        const key = `${protocol}://*.${baseDomain}`;
        
        if (!patterns.has(key)) {
          patterns.set(key, []);
        }
        patterns.get(key).push(origin);
      }
    });
    
    // Suggest wildcards for domains with multiple subdomains
    const suggestions = [];
    patterns.forEach((origins, pattern) => {
      if (origins.length >= 3) {
        suggestions.push({
          pattern,
          replaces: origins,
          savings: origins.length - 1
        });
      }
    });
    
    return suggestions;
  }
}

// ============================================
// 6. RUN EXAMPLES
// ============================================

// Uncomment to run examples
// (async () => {
//   try {
//     await exampleUsage();
//     
//     // Run automated management
//     const autoManager = new AutomatedCORSManager(
//       'https://api.example.com',
//       'your-auth-token-here'
//     );
//     await autoManager.performMaintenance();
//     
//   } catch (error) {
//     console.error('Example failed:', error);
//   }
// })();

module.exports = {
  CORSManager,
  AutomatedCORSManager,
  CORSMigrationHelper,
  createCORSProtectedRoute
};
