import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity,
  RefreshCcw,
  CheckCircle2 as HealthyIcon,
  AlertTriangle as WarningIcon,
  XCircle as ErrorIcon,
  Server,
  Gauge,
  Bug as BugIcon,
  BarChart3 as MetricsIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../config/api';

function MonitoringDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('health');
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // State for different monitoring data
  const [healthData, setHealthData] = useState(null);
  const [metricsData, setMetricsData] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  
  // Log search filters
  const [logLevel, setLogLevel] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logLimit, setLogLimit] = useState(100);

  // Fetch health data
  const fetchHealthData = useCallback(async () => {
    try {
      const response = await api.get('/monitoring/health/detailed');
      setHealthData(response.data);
    } catch (err) {
      console.error('Error fetching health data:', err);
    }
  }, []);

  // Fetch dashboard metrics
  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await api.get('/monitoring/dashboard');
      setDashboardData(response.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  }, []);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await api.get('/monitoring/metrics/json');
      setMetricsData(response.data);
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/monitoring/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Search logs
  const searchLogs = useCallback(async () => {
    try {
      const params = {};
      if (logLevel) params.level = logLevel;
      if (logSearch) params.search = logSearch;
      params.limit = logLimit;
      
      const response = await api.get('/monitoring/logs', { params });
      setLogs(response.data);
    } catch (err) {
      console.error('Error searching logs:', err);
    }
  }, [logLevel, logSearch, logLimit]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([
          fetchHealthData(),
          fetchDashboardData(),
          fetchMetrics(),
          fetchStats(),
          searchLogs()
        ]);
      } catch (err) {
        setError('Failed to load monitoring data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fetchHealthData, fetchDashboardData, fetchMetrics, fetchStats, searchLogs]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchHealthData();
      fetchDashboardData();
      fetchMetrics();
      fetchStats();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealthData, fetchDashboardData, fetchMetrics, fetchStats]);

  // Handle manual refresh
  const handleRefresh = () => {
    fetchHealthData();
    fetchDashboardData();
    fetchMetrics();
    fetchStats();
    searchLogs();
  };

  // Get health status icon
  const getHealthIcon = (status) => {
    const cls = status === 'healthy'
      ? 'text-green-600'
      : status === 'unhealthy'
      ? 'text-red-600'
      : 'text-yellow-600';
    if (status === 'healthy') return <HealthyIcon className={cls} size={20} />;
    if (status === 'unhealthy') return <ErrorIcon className={cls} size={20} />;
    if (status === 'warning' || status === 'degraded') return <WarningIcon className={cls} size={20} />;
    return null;
  };

  // Get health status color
  const getHealthBadgeClass = (status) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-700';
      case 'degraded':
      case 'warning':
        return 'bg-yellow-100 text-yellow-700';
      case 'unhealthy':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Format bytes
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Format uptime
  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-2 p-3 rounded bg-red-50 text-red-700">{error}</div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Activity size={20} /> System Monitoring
        </h2>
        <div className="flex items-center gap-2">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={autoRefresh ? 'on' : 'off'}
            onChange={(e) => setAutoRefresh(e.target.value === 'on')}
          >
            <option value="on">Auto Refresh (30s)</option>
            <option value="off">Manual</option>
          </select>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-primary-600 text-white hover:bg-primary-700"
          >
            <RefreshCcw size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex border-b mb-4 gap-2">
        {[
          { id: 'health', label: 'Health' },
          { id: 'metrics', label: 'Metrics' },
          { id: 'stats', label: 'Statistics' },
          { id: 'logs', label: 'Logs' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 -mb-px border-b-2 ${tab === t.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'health' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="col-span-1 md:col-span-3 bg-white rounded shadow p-4 flex items-center gap-3">
            {getHealthIcon(healthData?.status)}
            <div className="font-medium">System Status: {(healthData?.status || '').toUpperCase()}</div>
            <span className="ml-auto text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded">
              Uptime: {formatUptime(healthData?.uptime || 0)}
            </span>
          </div>

          {healthData?.checks && Object.entries(healthData.checks).map(([key, check]) => (
            <div key={key} className="bg-white rounded shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold capitalize">{key}</div>
                {getHealthIcon(check.status)}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${getHealthBadgeClass(check.status)}`}>
                {check.status}
              </span>
              {check.usage && (
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  {Object.entries(check.usage).map(([metric, value]) => (
                    <div key={metric} className="flex justify-between">
                      <span>{metric}</span>
                      <span className="font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              )}
              {check.latency && (
                <div className="text-sm text-gray-600 mt-2">Latency: {check.latency}ms</div>
              )}
              {check.error && (
                <div className="mt-2 p-2 rounded bg-red-50 text-red-700 text-sm">{check.error}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'metrics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {dashboardData?.system && (
            <div className="bg-white rounded shadow p-4">
              <div className="font-semibold mb-2 flex items-center gap-2"><Server size={18} /> System Information</div>
              <div className="text-sm text-gray-700 space-y-1">
                <div className="flex justify-between"><span>Hostname</span><span className="font-mono">{dashboardData.system.hostname}</span></div>
                <div className="flex justify-between"><span>Platform</span><span className="font-mono">{dashboardData.system.platform}</span></div>
                <div className="flex justify-between"><span>CPU Cores</span><span className="font-mono">{dashboardData.system.cpu?.cores}</span></div>
                <div className="flex justify-between"><span>Total Memory</span><span className="font-mono">{dashboardData.system.memory?.total}</span></div>
                <div className="flex justify-between"><span>Free Memory</span><span className="font-mono">{dashboardData.system.memory?.free}</span></div>
              </div>
            </div>
          )}

          {dashboardData?.metrics && (
            <div className="bg-white rounded shadow p-4">
              <div className="font-semibold mb-2 flex items-center gap-2"><Gauge size={18} /> Performance Metrics</div>
              <div className="text-sm text-gray-700 space-y-1">
                <div className="flex justify-between"><span>HTTP Requests</span><span className="font-mono">{dashboardData.metrics.http?.totalRequests || 0}</span></div>
                <div className="flex justify-between"><span>Avg Response Time</span><span className="font-mono">{dashboardData.metrics.http?.avgResponseTime || 'N/A'}</span></div>
                <div className="flex justify-between"><span>Active Connections</span><span className="font-mono">{dashboardData.metrics.socket?.activeConnections || 0}</span></div>
                <div className="flex justify-between"><span>Total Messages</span><span className="font-mono">{dashboardData.metrics.socket?.totalMessages || 0}</span></div>
                <div className="flex justify-between"><span>Load Average</span><span className="font-mono">{dashboardData.system?.loadAverage?.map(l => l.toFixed(2)).join(', ')}</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'stats' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-white rounded shadow p-4">
            <div className="text-gray-600 text-sm">Total Conversations</div>
            <div className="text-3xl font-semibold">{stats.conversations?.total || 0}</div>
            <div className="text-xs text-green-700 bg-green-50 inline-block px-2 py-0.5 rounded mt-1">Active: {stats.conversations?.active || 0}</div>
          </div>
          <div className="bg-white rounded shadow p-4">
            <div className="text-gray-600 text-sm">Total Messages</div>
            <div className="text-3xl font-semibold">{stats.messages?.total || 0}</div>
            <div className="text-xs text-primary-700 bg-primary-50 inline-block px-2 py-0.5 rounded mt-1">Today: {stats.messages?.today || 0}</div>
          </div>
          <div className="bg-white rounded shadow p-4">
            <div className="text-gray-600 text-sm">Total Users</div>
            <div className="text-3xl font-semibold">{stats.users?.total || 0}</div>
            <div className="text-xs text-green-700 bg-green-50 inline-block px-2 py-0.5 rounded mt-1">Online: {stats.users?.online || 0}</div>
          </div>
          <div className="bg-white rounded shadow p-4">
            <div className="text-gray-600 text-sm">Queue Size</div>
            <div className="text-3xl font-semibold">{stats.queue?.size || 0}</div>
            <div className="text-xs text-gray-700 bg-gray-50 inline-block px-2 py-0.5 rounded mt-1">Avg Wait: {stats.queue?.avgWaitTime || 'N/A'}</div>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div>
          <div className="flex flex-wrap gap-2 items-end mb-3">
            <div>
              <label className="text-xs text-gray-600">Level</label>
              <select
                className="border rounded px-2 py-1"
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
              >
                <option value="">All</option>
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-gray-600">Search</label>
              <input
                className="border rounded px-2 py-1 w-full"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search logs..."
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Limit</label>
              <select
                className="border rounded px-2 py-1"
                value={logLimit}
                onChange={(e) => setLogLimit(Number(e.target.value))}
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>
            <button
              className="px-3 py-1.5 rounded bg-gray-900 text-white"
              onClick={searchLogs}
            >
              Search Logs
            </button>
          </div>

          <div className="overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-2">Timestamp</th>
                  <th className="p-2">Level</th>
                  <th className="p-2">Message</th>
                  <th className="p-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-2 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        log.level === 'error' ? 'bg-red-100 text-red-700' :
                        log.level === 'warn' ? 'bg-yellow-100 text-yellow-700' :
                        log.level === 'info' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{log.level}</span>
                    </td>
                    <td className="p-2">{log.message}</td>
                    <td className="p-2 font-mono text-xs">{log.meta ? JSON.stringify(log.meta) : ''}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td className="p-3 text-center text-gray-500" colSpan={4}>No logs found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default MonitoringDashboard;
