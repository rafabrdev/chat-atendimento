import React, { useState, useEffect } from 'react';
import {
  Send,
  Copy,
  Trash2,
  RefreshCw,
  UserPlus,
  Mail,
  Link,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const InviteManager = () => {
  const { user, tenantId } = useAuth();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'client',
    message: ''
  });
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Carregar convites existentes
  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'agent') {
      loadInvitations();
    }
  }, [user]);

  const loadInvitations = async () => {
    setLoading(true);
    try {
      const response = await api.get('/invitations');
      setInvitations(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar convites:', error);
      toast.error('Erro ao carregar convites');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async () => {
    if (!formData.email || !formData.name) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSending(true);
    try {
      const response = await api.post('/invitations/send', {
        ...formData,
        tenantId
      });

      toast.success('Convite enviado com sucesso!');
      setOpenDialog(false);
      setFormData({ email: '', name: '', role: 'client', message: '' });
      loadInvitations();
    } catch (error) {
      const message = error.response?.data?.message || 'Erro ao enviar convite';
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const handleCancelInvite = async (inviteId) => {
    if (!window.confirm('Tem certeza que deseja cancelar este convite?')) {
      return;
    }

    try {
      await api.delete(`/invitations/${inviteId}`);
      toast.success('Convite cancelado');
      loadInvitations();
    } catch (error) {
      toast.error('Erro ao cancelar convite');
    }
  };

  const handleResendInvite = async (inviteId) => {
    try {
      await api.post(`/invitations/${inviteId}/resend`);
      toast.success('Convite reenviado');
      loadInvitations();
    } catch (error) {
      toast.error('Erro ao reenviar convite');
    }
  };

  const copyInviteLink = (invitation) => {
    const link = `${window.location.origin}/register?invite=${invitation.token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(invitation._id);
    toast.success('Link copiado!');
    setTimeout(() => setCopiedId(null), 3000);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'accepted':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'expired':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <AccessTimeIcon fontSize="small" />;
      case 'accepted':
        return <CheckCircleIcon fontSize="small" />;
      case 'cancelled':
        return <CancelIcon fontSize="small" />;
      default:
        return null;
    }
  };

  const getRoleLabel = (role) => {
    const roles = {
      admin: 'Administrador',
      agent: 'Agente',
      client: 'Cliente'
    };
    return roles[role] || role;
  };

  if (user?.role !== 'admin' && user?.role !== 'agent') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Você não tem permissão para gerenciar convites
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h2">
            Gerenciar Convites
          </Typography>
          <Box>
            <IconButton onClick={loadInvitations} disabled={loading}>
              <RefreshIcon />
            </IconButton>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setOpenDialog(true)}
              disabled={loading}
            >
              Novo Convite
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : invitations.length === 0 ? (
          <Alert severity="info">
            Nenhum convite enviado ainda
          </Alert>
        ) : (
          <List>
            {invitations.map((invitation) => (
              <ListItem
                key={invitation._id}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1">
                        {invitation.name}
                      </Typography>
                      <Chip
                        label={getRoleLabel(invitation.role)}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                      <Chip
                        label={invitation.status}
                        size="small"
                        color={getStatusColor(invitation.status)}
                        icon={getStatusIcon(invitation.status)}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        <MailIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                        {invitation.email}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Enviado em {format(new Date(invitation.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {invitation.expiresAt && (
                          <> • Expira em {format(new Date(invitation.expiresAt), 'dd/MM/yyyy', { locale: ptBR })}</>
                        )}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  {invitation.status === 'pending' && (
                    <>
                      <Tooltip title="Copiar link">
                        <IconButton
                          edge="end"
                          onClick={() => copyInviteLink(invitation)}
                          color={copiedId === invitation._id ? 'success' : 'default'}
                        >
                          {copiedId === invitation._id ? <CheckCircleIcon /> : <CopyIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reenviar convite">
                        <IconButton
                          edge="end"
                          onClick={() => handleResendInvite(invitation._id)}
                        >
                          <SendIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Cancelar convite">
                        <IconButton
                          edge="end"
                          onClick={() => handleCancelInvite(invitation._id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Dialog para novo convite */}
      <Dialog
        open={openDialog}
        onClose={() => !sending && setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonAddIcon />
            Enviar Novo Convite
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nome"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={sending}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="E-mail"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={sending}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MailIcon />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Tipo de Usuário</InputLabel>
                <Select
                  value={formData.role}
                  label="Tipo de Usuário"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  disabled={sending || user?.role !== 'admin'}
                >
                  <MenuItem value="client">Cliente</MenuItem>
                  {user?.role === 'admin' && (
                    <>
                      <MenuItem value="agent">Agente</MenuItem>
                      <MenuItem value="admin">Administrador</MenuItem>
                    </>
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Mensagem personalizada (opcional)"
                multiline
                rows={3}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                disabled={sending}
                helperText="Esta mensagem será incluída no e-mail de convite"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSendInvite}
            variant="contained"
            disabled={sending || !formData.email || !formData.name}
            startIcon={sending ? <CircularProgress size={20} /> : <SendIcon />}
          >
            {sending ? 'Enviando...' : 'Enviar Convite'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InviteManager;
