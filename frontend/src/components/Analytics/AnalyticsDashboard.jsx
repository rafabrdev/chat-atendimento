import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import {
  FiTrendingUp,
  FiActivity,
  FiUsers,
  FiMessageSquare,
  FiClock,
  FiStar,
  FiDownload,
  FiCalendar
} from 'react-icons/fi';
import { format } from 'date-fns';
import api from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const AnalyticsDashboard = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [groupBy, setGroupBy] = useState('day');

  // Fetch analytics data
  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        groupBy
      });

      const response = await api.get(`/history/analytics?${params}`);
      setAnalytics(response.data.analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Falha ao carregar dados de análise');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(() => {
      fetchAnalytics();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [dateRange, groupBy]);

  // Colors for charts
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  // Format data for timeline chart
  const formatTimelineData = () => {
    if (!analytics?.timeline) return [];
    return analytics.timeline.map(item => ({
      date: item._id,
      total: item.total,
      active: item.active,
      closed: item.closed,
      waiting: item.waiting
    }));
  };

  // Format satisfaction data for pie chart
  const formatSatisfactionData = () => {
    if (!analytics?.satisfaction) return [];
    return analytics.satisfaction.map(item => ({
      name: `${item._id} Estrela${item._id > 1 ? 's' : ''}`,
      value: item.count,
      rating: item._id
    }));
  };

  // Export analytics report
  const exportReport = async () => {
    try {
      const response = await api.get('/history/export/analytics/pdf', {
        params: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics-report-${dateRange.startDate}-to-${dateRange.endDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Relatório exportado com sucesso');
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Falha ao exportar relatório');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Painel de Análise</h1>
          <p className="text-gray-600 mt-1">Insights e métricas de desempenho</p>
        </div>
        <button
          onClick={exportReport}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center"
        >
          <FiDownload className="mr-2" />
          Exportar Relatório
        </button>
      </div>

      {/* Date Range and Grouping Controls */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agrupar Por
            </label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="day">Dia</option>
              <option value="week">Semana</option>
              <option value="month">Mês</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {analytics?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Conversas</p>
                <p className="text-2xl font-bold text-gray-800">
                  {analytics.summary.totalConversations}
                </p>
              </div>
              <FiMessageSquare className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Conversas Fechadas</p>
                <p className="text-2xl font-bold text-gray-800">
                  {analytics.summary.closedConversations}
                </p>
              </div>
              <FiActivity className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Taxa de Resolução</p>
                <p className="text-2xl font-bold text-gray-800">
                  {analytics.summary.resolutionRate}%
                </p>
              </div>
              <FiTrendingUp className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avaliação Média</p>
                <p className="text-2xl font-bold text-gray-800 flex items-center">
                  {analytics.summary.averageRating || '0.0'}
                  <FiStar className="w-5 h-5 ml-1 text-yellow-400 fill-current" />
                </p>
              </div>
              <FiStar className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversation Timeline */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Linha do Tempo das Conversas</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={formatTimelineData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="total" stackId="1" stroke="#3B82F6" fill="#3B82F6" />
              <Area type="monotone" dataKey="closed" stackId="2" stroke="#10B981" fill="#10B981" />
              <Area type="monotone" dataKey="active" stackId="2" stroke="#F59E0B" fill="#F59E0B" />
              <Area type="monotone" dataKey="waiting" stackId="2" stroke="#EF4444" fill="#EF4444" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Satisfaction Distribution */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Satisfação do Cliente</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={formatSatisfactionData()}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {formatSatisfactionData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.rating - 1]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Distribuição de Status ao Longo do Tempo</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={formatTimelineData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="active" stroke="#10B981" strokeWidth={2} />
              <Line type="monotone" dataKey="waiting" stroke="#F59E0B" strokeWidth={2} />
              <Line type="monotone" dataKey="closed" stroke="#6B7280" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Average Rating Trend */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Tendência de Avaliação Média</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics?.timeline || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="_id" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="avgRating" 
                stroke="#8B5CF6" 
                strokeWidth={2}
                name="Avaliação Média"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Response Time Analytics */}
      {analytics?.responseTime && analytics.responseTime.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Análise de Tempo de Resposta</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.responseTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="_id" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="avgResponseTime" fill="#3B82F6" name="Tempo Médio de Resposta (segundos)" />
              <Bar dataKey="totalMessages" fill="#10B981" name="Total de Mensagens" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detailed Statistics Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Estatísticas Detalhadas</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ativo
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aguardando
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fechado
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avaliação Média
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avaliado
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics?.timeline?.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {item._id}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {item.total}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {item.active}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {item.waiting}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {item.closed}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {item.avgRating ? item.avgRating.toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {item.totalRated}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
