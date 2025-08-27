/**
 * Tenant Provider Test Component
 * 
 * Visual test component for TenantProvider and FeatureGate functionality
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  Switch,
  FormControlLabel,
  TextField,
  IconButton,
  Collapse
} from '@mui/material';
import {
  Business,
  Check,
  Clear,
  ExpandMore,
  ExpandLess,
  Lock,
  LockOpen,
  Refresh,
  Palette,
  Diamond,
  EmojiEvents
} from '@mui/icons-material';
import { useTenant } from '../../providers/TenantProvider';
import { FeatureGate, FeatureButton, FeatureBadge, PlanLimit, TenantStatusGate } from '../FeatureGate';
import tenantService from '../../services/tenantService';

const TenantProviderTest = () => {
  const {
    tenant,
    loading,
    error,
    features,
    reloadTenant,
    isFeatureAllowed,
    getTenantLimit,
    isLimitExceeded,
    getBrandingColors,
    getLogoUrl,
    getPlanInfo,
    isTenantActive,
    isTenantSuspended
  } = useTenant();

  const [expandedSections, setExpandedSections] = useState({
    info: true,
    features: true,
    limits: true,
    branding: true,
    tests: true
  });

  const [testFeature, setTestFeature] = useState('analytics');
  const [testLimit, setTestLimit] = useState('maxUsers');
  const [testValue, setTestValue] = useState(10);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Sample features to test
  const sampleFeatures = [
    'analytics',
    'advanced_reports',
    'api_access',
    'custom_branding',
    'priority_support',
    'bulk_operations',
    'webhooks',
    'white_label',
    'sso',
    'audit_logs'
  ];

  // Sample limits to test
  const sampleLimits = [
    { key: 'maxUsers', label: 'Usuários', current: 5 },
    { key: 'maxAgents', label: 'Agentes', current: 3 },
    { key: 'maxConversations', label: 'Conversas', current: 45 },
    { key: 'maxStorage', label: 'Armazenamento (MB)', current: 850 }
  ];

  const planInfo = getPlanInfo();
  const brandingColors = getBrandingColors();

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Carregando informações do tenant...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Tenant Provider Test Suite
      </Typography>

      <Grid container spacing={3}>
        {/* Tenant Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box display="flex" alignItems="center">
                  <Business sx={{ mr: 1 }} />
                  <Typography variant="h6">Informações do Tenant</Typography>
                </Box>
                <IconButton onClick={() => toggleSection('info')} size="small">
                  {expandedSections.info ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>

              <Collapse in={expandedSections.info}>
                <Box mt={2}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">ID</Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {tenant?._id || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Key</Typography>
                      <Typography variant="body2">{tenant?.key || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Nome</Typography>
                      <Typography variant="body2">{tenant?.name || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Status</Typography>
                      <Chip
                        label={tenant?.status || 'unknown'}
                        size="small"
                        color={
                          tenant?.status === 'active' ? 'success' :
                          tenant?.status === 'suspended' ? 'warning' :
                          'error'
                        }
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Plano</Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2">{planInfo.name}</Typography>
                        {planInfo.level === 3 && <Diamond sx={{ fontSize: 16, color: 'gold' }} />}
                        {planInfo.level === 2 && <EmojiEvents sx={{ fontSize: 16, color: 'silver' }} />}
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Nível</Typography>
                      <Typography variant="body2">{planInfo.level}</Typography>
                    </Grid>
                  </Grid>

                  <Box mt={2}>
                    <Button
                      variant="outlined"
                      startIcon={<Refresh />}
                      onClick={reloadTenant}
                      size="small"
                      fullWidth
                    >
                      Recarregar Tenant
                    </Button>
                  </Box>
                </Box>
              </Collapse>
            </CardContent>
          </Card>
        </Grid>

        {/* Plan Features */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Features do Plano</Typography>
                <IconButton onClick={() => toggleSection('features')} size="small">
                  {expandedSections.features ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>

              <Collapse in={expandedSections.features}>
                <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {sampleFeatures.map(feature => {
                    const allowed = isFeatureAllowed(feature);
                    return (
                      <ListItem key={feature}>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                              <Typography variant="body2">{feature}</Typography>
                              <Box display="flex" alignItems="center" gap={1}>
                                {allowed ? (
                                  <Chip
                                    label="Disponível"
                                    size="small"
                                    color="success"
                                    icon={<Check />}
                                  />
                                ) : (
                                  <Chip
                                    label="Bloqueado"
                                    size="small"
                                    color="error"
                                    icon={<Lock />}
                                  />
                                )}
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </Collapse>
            </CardContent>
          </Card>
        </Grid>

        {/* Plan Limits */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Limites do Plano</Typography>
                <IconButton onClick={() => toggleSection('limits')} size="small">
                  {expandedSections.limits ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>

              <Collapse in={expandedSections.limits}>
                <Box mt={2}>
                  {sampleLimits.map(limit => (
                    <Box key={limit.key} mb={2}>
                      <PlanLimit
                        limitKey={limit.key}
                        current={limit.current}
                        label={limit.label}
                        showProgress={true}
                      />
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </CardContent>
          </Card>
        </Grid>

        {/* Branding */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box display="flex" alignItems="center">
                  <Palette sx={{ mr: 1 }} />
                  <Typography variant="h6">Branding</Typography>
                </Box>
                <IconButton onClick={() => toggleSection('branding')} size="small">
                  {expandedSections.branding ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>

              <Collapse in={expandedSections.branding}>
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>Cores</Typography>
                  <Grid container spacing={1}>
                    {Object.entries(brandingColors).map(([key, value]) => (
                      <Grid item xs={6} key={key}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              backgroundColor: value,
                              border: '1px solid #ccc',
                              borderRadius: 1
                            }}
                          />
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {key}
                            </Typography>
                            <Typography variant="caption" display="block">
                              {value}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>

                  <Box mt={2}>
                    <Typography variant="subtitle2" gutterBottom>Logo URL</Typography>
                    <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                      {getLogoUrl()}
                    </Typography>
                  </Box>
                </Box>
              </Collapse>
            </CardContent>
          </Card>
        </Grid>

        {/* Interactive Tests */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Testes Interativos</Typography>
                <IconButton onClick={() => toggleSection('tests')} size="small">
                  {expandedSections.tests ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>

              <Collapse in={expandedSections.tests}>
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  {/* Test Feature Access */}
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Testar Acesso a Feature
                      </Typography>
                      
                      <TextField
                        label="Feature"
                        value={testFeature}
                        onChange={(e) => setTestFeature(e.target.value)}
                        size="small"
                        fullWidth
                        sx={{ mb: 2 }}
                      />
                      
                      <FeatureGate feature={testFeature}>
                        <Alert severity="success">
                          Feature "{testFeature}" está disponível! ✅
                        </Alert>
                      </FeatureGate>
                      
                      <FeatureGate 
                        feature={testFeature}
                        fallback={
                          <Alert severity="warning">
                            Feature "{testFeature}" não está disponível no seu plano 🔒
                          </Alert>
                        }
                      />
                    </Paper>
                  </Grid>

                  {/* Test Limit Check */}
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Testar Limite
                      </Typography>
                      
                      <TextField
                        label="Limite"
                        value={testLimit}
                        onChange={(e) => setTestLimit(e.target.value)}
                        size="small"
                        fullWidth
                        sx={{ mb: 1 }}
                      />
                      
                      <TextField
                        label="Valor Atual"
                        type="number"
                        value={testValue}
                        onChange={(e) => setTestValue(Number(e.target.value))}
                        size="small"
                        fullWidth
                        sx={{ mb: 2 }}
                      />
                      
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          Limite: {getTenantLimit(testLimit) || 'Sem limite'}
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          Excedido: {isLimitExceeded(testLimit, testValue) ? '❌ Sim' : '✅ Não'}
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>

                  {/* Test Feature Button */}
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Botões com Feature Gate
                      </Typography>
                      
                      <Box display="flex" gap={2} flexWrap="wrap">
                        <FeatureButton feature="analytics">
                          Analytics
                        </FeatureButton>
                        
                        <FeatureButton feature="advanced_reports" variant="contained">
                          Relatórios Avançados
                        </FeatureButton>
                        
                        <FeatureButton feature="api_access" variant="outlined">
                          API Access
                        </FeatureButton>
                      </Box>
                    </Paper>
                  </Grid>

                  {/* Test Feature Badges */}
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Badges de Feature
                      </Typography>
                      
                      <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
                        <Box>
                          <Typography variant="body2">Analytics</Typography>
                          <FeatureBadge feature="analytics" />
                        </Box>
                        
                        <Box>
                          <Typography variant="body2">API Access</Typography>
                          <FeatureBadge feature="api_access" />
                        </Box>
                        
                        <Box>
                          <Typography variant="body2">White Label</Typography>
                          <FeatureBadge feature="white_label" />
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>

                  {/* Test Tenant Status Gate */}
                  <Grid item xs={12}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Tenant Status Gate
                      </Typography>
                      
                      <TenantStatusGate>
                        <Alert severity="success">
                          Tenant está ativo! Todos os recursos estão disponíveis.
                        </Alert>
                      </TenantStatusGate>
                    </Paper>
                  </Grid>
                </Grid>
              </Collapse>
            </CardContent>
          </Card>
        </Grid>

        {/* Raw Data */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Dados Brutos (Debug)
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                <pre style={{ fontSize: '0.75rem', margin: 0 }}>
                  {JSON.stringify({ tenant, features, planInfo }, null, 2)}
                </pre>
              </Paper>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TenantProviderTest;
