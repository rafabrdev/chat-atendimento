/**
 * Refresh Token Test Component
 * 
 * Component to test the refresh token queue functionality
 * Simulates 10 concurrent requests with expired token
 * Should only trigger 1 refresh call
 */

import React, { useState } from 'react';
import api, { testConcurrentRefresh } from '../../config/api';
import authService from '../../services/authService';

const RefreshTokenTest = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { 
      message, 
      type, 
      timestamp: new Date().toISOString().split('T')[1].split('.')[0] 
    }]);
  };

  const simulateConcurrentRequests = async () => {
    setTesting(true);
    setResults(null);
    setLogs([]);
    
    addLog('🚀 Starting refresh token queue test...', 'info');
    addLog('Simulating 10 concurrent requests with expired token', 'info');
    
    try {
      const testResults = await testConcurrentRefresh(10);
      
      const successCount = testResults.filter(r => r.value?.status === 'success').length;
      const failCount = testResults.filter(r => r.value?.status === 'failed').length;
      
      setResults({
        total: testResults.length,
        success: successCount,
        failed: failCount,
        details: testResults
      });
      
      if (successCount === 10) {
        addLog(`✅ SUCCESS: All ${successCount} requests succeeded!`, 'success');
        addLog('✅ Only 1 refresh call was made (check Network tab)', 'success');
      } else {
        addLog(`⚠️ WARNING: ${successCount} succeeded, ${failCount} failed`, 'warning');
      }
      
    } catch (error) {
      addLog(`❌ ERROR: ${error.message}`, 'error');
      setResults({ error: error.message });
    } finally {
      setTesting(false);
    }
  };

  const forceTokenExpiry = () => {
    const token = authService.getAccessToken();
    if (!token) {
      addLog('❌ No token found', 'error');
      return;
    }
    
    // Create an expired token (set exp to past time)
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    payload.exp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    
    const newPayload = btoa(JSON.stringify(payload));
    const expiredToken = `${parts[0]}.${newPayload}.${parts[2]}`;
    
    authService.setAccessToken(expiredToken);
    addLog('⏰ Token forcefully expired', 'warning');
  };

  const checkTokenStatus = () => {
    const token = authService.getAccessToken();
    if (!token) {
      addLog('❌ No token found', 'error');
      return;
    }
    
    const isExpired = authService.isTokenExpired(token);
    const timeUntilExpiry = authService.getTimeUntilExpiry(token);
    const decoded = authService.decodeToken(token);
    
    addLog(`Token Status: ${isExpired ? '❌ EXPIRED' : '✅ VALID'}`, isExpired ? 'error' : 'success');
    
    if (!isExpired) {
      const minutes = Math.floor(timeUntilExpiry / 60000);
      const seconds = Math.floor((timeUntilExpiry % 60000) / 1000);
      addLog(`Time until expiry: ${minutes}m ${seconds}s`, 'info');
    }
    
    if (decoded) {
      addLog(`User ID: ${decoded.id || decoded.sub || 'N/A'}`, 'info');
      addLog(`Tenant ID: ${decoded.tenantId || 'N/A'}`, 'info');
      addLog(`Role: ${decoded.role || 'N/A'}`, 'info');
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setResults(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6">🧪 Refresh Token Queue Test</h2>
        
        {/* Control Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={simulateConcurrentRequests}
            disabled={testing}
            className={`px-4 py-2 rounded font-medium ${
              testing 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {testing ? '⏳ Testing...' : '🚀 Run Concurrent Test'}
          </button>
          
          <button
            onClick={forceTokenExpiry}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded font-medium"
          >
            ⏰ Force Token Expiry
          </button>
          
          <button
            onClick={checkTokenStatus}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium"
          >
            🔍 Check Token Status
          </button>
          
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded font-medium"
          >
            🗑️ Clear Logs
          </button>
        </div>

        {/* Test Description */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">What this test does:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Simulates 10 concurrent API requests with an expired token</li>
            <li>• All requests should wait for a single token refresh</li>
            <li>• Only 1 refresh API call should be made (check Network tab)</li>
            <li>• All 10 requests should succeed after the refresh completes</li>
          </ul>
        </div>

        {/* Results */}
        {results && (
          <div className={`mb-6 p-4 rounded-lg ${
            results.error ? 'bg-red-50' : 
            results.success === results.total ? 'bg-green-50' : 'bg-yellow-50'
          }`}>
            <h3 className="font-semibold mb-2">Results:</h3>
            {results.error ? (
              <p className="text-red-700">{results.error}</p>
            ) : (
              <div className="space-y-1">
                <p>Total Requests: {results.total}</p>
                <p className="text-green-700">✅ Successful: {results.success}</p>
                <p className="text-red-700">❌ Failed: {results.failed}</p>
                <div className="mt-3">
                  <p className="font-semibold text-sm">
                    {results.success === results.total ? 
                      '🎉 Perfect! Refresh queue is working correctly!' : 
                      '⚠️ Some requests failed. Check the logs for details.'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-4 text-sm font-mono">
            <h3 className="text-white font-semibold mb-3">Console Logs:</h3>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {logs.map((log, index) => (
                <div 
                  key={index}
                  className={`flex gap-2 ${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    log.type === 'warning' ? 'text-yellow-400' :
                    'text-gray-300'
                  }`}
                >
                  <span className="text-gray-500">[{log.timestamp}]</span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">📋 Test Instructions:</h3>
          <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>Open your browser's Developer Tools (F12)</li>
            <li>Go to the Network tab</li>
            <li>Clear the Network log</li>
            <li>Click "Run Concurrent Test"</li>
            <li>Watch the Network tab - you should see only 1 refresh call</li>
            <li>Check that all 10 profile requests succeed after refresh</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default RefreshTokenTest;
