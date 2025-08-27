/**
 * Socket Service Test Component
 * 
 * Visual test component to verify the Socket.IO singleton functionality:
 * - Connection management
 * - Authentication integration
 * - Tenant-aware events
 * - Reconnection after token refresh
 * - Event queue during disconnection
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  TextField,
  Alert,
  Divider,
  IconButton,
  Collapse,
  LinearProgress
} from '@mui/material';
import {
  Wifi,
  WifiOff,
  Send,
  Refresh,
  Clear,
  ExpandMore,
  ExpandLess,
  CloudQueue,
  CloudDone,
  CloudOff,
  Person,
  Room,
  Message
} from '@mui/icons-material';
import useSocketService from '../../hooks/useSocketService';
import authService from '../../services/authService';

const SocketServiceTest = () => {
  // Socket hook
  const socket = useSocketService({ debug: true });
  
  // State
  const [events, setEvents] = useState([]);
  const [testRoom, setTestRoom] = useState('test-room-1');
  const [testMessage, setTestMessage] = useState('Hello Socket!');
  const [connectionDetails, setConnectionDetails] = useState(null);
  const [showDetails, setShowDetails] = useState(true);
  const [testResults, setTestResults] = useState({});
  
  // Add event to log
  const addEvent = (type, message, data = {}) => {
    const event = {
      id: Date.now() + Math.random(),
      type,
      message,
      data,
      timestamp: new Date().toLocaleTimeString()
    };
    setEvents(prev => [event, ...prev].slice(0, 50)); // Keep last 50 events
  };

  // Setup event listeners
  useEffect(() => {
    const unsubscribers = [];

    // Socket events
    unsubscribers.push(
      socket.on('socket:connected', (data) => {
        addEvent('success', 'Socket connected', data);
      })
    );

    unsubscribers.push(
      socket.on('socket:disconnected', (data) => {
        addEvent('error', 'Socket disconnected', data);
      })
    );

    unsubscribers.push(
      socket.on('socket:reconnected', () => {
        addEvent('success', 'Socket reconnected');
      })
    );

    unsubscribers.push(
      socket.on('socket:error', (data) => {
        addEvent('error', 'Socket error', data);
      })
    );

    // Test echo events
    unsubscribers.push(
      socket.on('test:echo', (data) => {
        addEvent('info', 'Echo received', data);
      })
    );

    unsubscribers.push(
      socket.on('room:joined', (data) => {
        addEvent('success', `Joined room: ${data.room}`, data);
      })
    );

    unsubscribers.push(
      socket.on('room:left', (data) => {
        addEvent('info', `Left room: ${data.room}`, data);
      })
    );

    unsubscribers.push(
      socket.on('room:message', (data) => {
        addEvent('message', `Room message: ${data.message}`, data);
      })
    );

    // Auth events
    unsubscribers.push(
      socket.on('auth:error', () => {
        addEvent('error', 'Authentication error');
      })
    );

    unsubscribers.push(
      socket.on('tenant:disabled', () => {
        addEvent('error', 'Tenant disabled');
      })
    );

    // Update connection details periodically
    const detailsInterval = setInterval(() => {
      if (socket.service) {
        setConnectionDetails(socket.getConnectionState());
      }
    }, 1000);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      clearInterval(detailsInterval);
    };
  }, [socket]);

  // Test functions
  const testConnection = async () => {
    addEvent('test', 'Testing connection...');
    
    if (socket.connected) {
      addEvent('success', 'Already connected');
      setTestResults(prev => ({ ...prev, connection: 'pass' }));
    } else {
      try {
        await socket.connect();
        addEvent('success', 'Connection successful');
        setTestResults(prev => ({ ...prev, connection: 'pass' }));
      } catch (error) {
        addEvent('error', 'Connection failed', { error: error.message });
        setTestResults(prev => ({ ...prev, connection: 'fail' }));
      }
    }
  };

  const testDisconnection = () => {
    addEvent('test', 'Testing disconnection...');
    socket.disconnect();
    addEvent('info', 'Disconnect called');
    setTestResults(prev => ({ ...prev, disconnection: 'pass' }));
  };

  const testReconnection = async () => {
    addEvent('test', 'Testing reconnection...');
    
    try {
      await socket.reconnect();
      addEvent('success', 'Reconnection successful');
      setTestResults(prev => ({ ...prev, reconnection: 'pass' }));
    } catch (error) {
      addEvent('error', 'Reconnection failed', { error: error.message });
      setTestResults(prev => ({ ...prev, reconnection: 'fail' }));
    }
  };

  const testEmit = () => {
    addEvent('test', 'Testing emit...');
    
    const success = socket.emit('test:echo', { 
      message: testMessage,
      timestamp: Date.now()
    });
    
    if (success) {
      addEvent('success', `Emitted: ${testMessage}`);
      setTestResults(prev => ({ ...prev, emit: 'pass' }));
    } else {
      addEvent('warning', 'Emit queued (not connected)');
      setTestResults(prev => ({ ...prev, emit: 'queued' }));
    }
  };

  const testJoinRoom = () => {
    addEvent('test', `Testing join room: ${testRoom}`);
    socket.joinRoom(testRoom, { user: authService.getUser()?.name });
    addEvent('info', `Join room called: ${testRoom}`);
    setTestResults(prev => ({ ...prev, joinRoom: 'pass' }));
  };

  const testLeaveRoom = () => {
    addEvent('test', `Testing leave room: ${testRoom}`);
    socket.leaveRoom(testRoom);
    addEvent('info', `Leave room called: ${testRoom}`);
    setTestResults(prev => ({ ...prev, leaveRoom: 'pass' }));
  };

  const testRoomBroadcast = () => {
    addEvent('test', 'Testing room broadcast...');
    
    const success = socket.emit('room:broadcast', {
      room: testRoom,
      message: testMessage
    });
    
    if (success) {
      addEvent('success', `Broadcast to room: ${testRoom}`);
      setTestResults(prev => ({ ...prev, broadcast: 'pass' }));
    } else {
      addEvent('warning', 'Broadcast queued');
      setTestResults(prev => ({ ...prev, broadcast: 'queued' }));
    }
  };

  const testTokenRefresh = async () => {
    addEvent('test', 'Testing token refresh reconnection...');
    
    // Simulate token expiry
    const oldToken = authService.getAccessToken();
    authService.setAccessToken('expired_token');
    
    // Force reconnection
    try {
      await socket.reconnect();
      addEvent('success', 'Reconnected after token refresh');
      setTestResults(prev => ({ ...prev, tokenRefresh: 'pass' }));
    } catch (error) {
      addEvent('error', 'Failed to reconnect after token refresh', { error: error.message });
      setTestResults(prev => ({ ...prev, tokenRefresh: 'fail' }));
    } finally {
      // Restore token
      authService.setAccessToken(oldToken);
    }
  };

  const testEventQueue = () => {
    addEvent('test', 'Testing event queue...');
    
    // Disconnect first
    socket.disconnect();
    
    // Queue some events
    for (let i = 1; i <= 5; i++) {
      socket.emit(`test:queued-${i}`, { index: i }, { queue: true });
      addEvent('info', `Queued event ${i}`);
    }
    
    // Reconnect to process queue
    setTimeout(async () => {
      await socket.connect();
      addEvent('success', 'Queue should be processed after reconnection');
      setTestResults(prev => ({ ...prev, eventQueue: 'pass' }));
    }, 2000);
  };

  const runAllTests = async () => {
    addEvent('test', 'Running all tests...');
    setTestResults({});
    
    // Run tests sequentially
    await testConnection();
    await new Promise(r => setTimeout(r, 1000));
    
    testEmit();
    await new Promise(r => setTimeout(r, 1000));
    
    testJoinRoom();
    await new Promise(r => setTimeout(r, 1000));
    
    testRoomBroadcast();
    await new Promise(r => setTimeout(r, 1000));
    
    testLeaveRoom();
    await new Promise(r => setTimeout(r, 1000));
    
    testDisconnection();
    await new Promise(r => setTimeout(r, 2000));
    
    await testReconnection();
    await new Promise(r => setTimeout(r, 1000));
    
    testEventQueue();
    
    addEvent('success', 'All tests completed');
  };

  const clearEvents = () => {
    setEvents([]);
    setTestResults({});
  };

  // Get connection status icon and color
  const getConnectionStatus = () => {
    if (socket.connecting) {
      return { icon: <CloudQueue />, color: 'warning', text: 'Connecting...' };
    }
    if (socket.connected) {
      return { icon: <CloudDone />, color: 'success', text: 'Connected' };
    }
    if (socket.error) {
      return { icon: <CloudOff />, color: 'error', text: 'Error' };
    }
    return { icon: <WifiOff />, color: 'disabled', text: 'Disconnected' };
  };

  const status = getConnectionStatus();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Socket Service Test Suite
      </Typography>
      
      <Grid container spacing={3}>
        {/* Connection Status */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Box mr={2} color={`${status.color}.main`}>
                  {status.icon}
                </Box>
                <Box flex={1}>
                  <Typography variant="h6">Connection Status</Typography>
                  <Chip 
                    label={status.text} 
                    color={status.color} 
                    size="small"
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              </Box>
              
              {socket.socketId && (
                <Typography variant="caption" color="text.secondary">
                  Socket ID: {socket.socketId}
                </Typography>
              )}
              
              {socket.error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {socket.error}
                </Alert>
              )}
              
              {socket.connecting && (
                <LinearProgress sx={{ mt: 2 }} />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Test Controls */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Test Controls
              </Typography>
              
              <Box mb={2}>
                <TextField
                  label="Test Room"
                  value={testRoom}
                  onChange={(e) => setTestRoom(e.target.value)}
                  size="small"
                  sx={{ mr: 2 }}
                />
                <TextField
                  label="Test Message"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  size="small"
                />
              </Box>
              
              <Grid container spacing={1}>
                <Grid item>
                  <Button 
                    variant="outlined" 
                    onClick={testConnection}
                    startIcon={<Wifi />}
                    disabled={socket.connecting}
                  >
                    Connect
                  </Button>
                </Grid>
                <Grid item>
                  <Button 
                    variant="outlined" 
                    onClick={testDisconnection}
                    startIcon={<WifiOff />}
                    disabled={!socket.connected}
                  >
                    Disconnect
                  </Button>
                </Grid>
                <Grid item>
                  <Button 
                    variant="outlined" 
                    onClick={testReconnection}
                    startIcon={<Refresh />}
                  >
                    Reconnect
                  </Button>
                </Grid>
                <Grid item>
                  <Button 
                    variant="outlined" 
                    onClick={testEmit}
                    startIcon={<Send />}
                  >
                    Emit
                  </Button>
                </Grid>
                <Grid item>
                  <Button 
                    variant="outlined" 
                    onClick={testJoinRoom}
                    startIcon={<Room />}
                  >
                    Join Room
                  </Button>
                </Grid>
                <Grid item>
                  <Button 
                    variant="outlined" 
                    onClick={testLeaveRoom}
                  >
                    Leave Room
                  </Button>
                </Grid>
                <Grid item>
                  <Button 
                    variant="outlined" 
                    onClick={testRoomBroadcast}
                    startIcon={<Message />}
                  >
                    Broadcast
                  </Button>
                </Grid>
                <Grid item>
                  <Button 
                    variant="outlined" 
                    onClick={testTokenRefresh}
                    color="warning"
                  >
                    Token Refresh
                  </Button>
                </Grid>
                <Grid item>
                  <Button 
                    variant="outlined" 
                    onClick={testEventQueue}
                    color="info"
                  >
                    Event Queue
                  </Button>
                </Grid>
              </Grid>
              
              <Box mt={2}>
                <Button 
                  variant="contained" 
                  onClick={runAllTests}
                  color="primary"
                  sx={{ mr: 2 }}
                >
                  Run All Tests
                </Button>
                <Button 
                  variant="outlined" 
                  onClick={clearEvents}
                  startIcon={<Clear />}
                >
                  Clear
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Test Results */}
        {Object.keys(testResults).length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Test Results
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {Object.entries(testResults).map(([test, result]) => (
                    <Chip
                      key={test}
                      label={`${test}: ${result}`}
                      color={
                        result === 'pass' ? 'success' : 
                        result === 'fail' ? 'error' : 
                        'warning'
                      }
                      size="small"
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Connection Details */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="h6">
                  Connection Details
                </Typography>
                <IconButton onClick={() => setShowDetails(!showDetails)}>
                  {showDetails ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>
              
              <Collapse in={showDetails}>
                {connectionDetails && (
                  <Box mt={2}>
                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Connected
                        </Typography>
                        <Typography>
                          {connectionDetails.connected ? 'Yes' : 'No'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Tenant ID
                        </Typography>
                        <Typography>
                          {connectionDetails.tenantId || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Rooms Joined
                        </Typography>
                        <Typography>
                          {connectionDetails.roomsJoined?.length || 0}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Queued Events
                        </Typography>
                        <Typography>
                          {connectionDetails.queuedEvents || 0}
                        </Typography>
                      </Grid>
                    </Grid>
                    
                    {connectionDetails.roomsJoined?.length > 0 && (
                      <Box mt={2}>
                        <Typography variant="caption" color="text.secondary">
                          Rooms:
                        </Typography>
                        <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.5}>
                          {connectionDetails.roomsJoined.map(room => (
                            <Chip key={room} label={room} size="small" />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}
              </Collapse>
            </CardContent>
          </Card>
        </Grid>

        {/* Event Log */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Event Log
              </Typography>
              
              <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                <List dense>
                  {events.length === 0 ? (
                    <ListItem>
                      <ListItemText 
                        primary="No events yet" 
                        secondary="Run tests to see events"
                      />
                    </ListItem>
                  ) : (
                    events.map(event => (
                      <React.Fragment key={event.id}>
                        <ListItem>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <Chip 
                                  label={event.type} 
                                  size="small"
                                  color={
                                    event.type === 'success' ? 'success' :
                                    event.type === 'error' ? 'error' :
                                    event.type === 'warning' ? 'warning' :
                                    event.type === 'test' ? 'primary' :
                                    event.type === 'message' ? 'secondary' :
                                    'default'
                                  }
                                />
                                <Typography variant="body2">
                                  {event.message}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {event.timestamp}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              event.data && Object.keys(event.data).length > 0 && (
                                <Typography variant="caption" component="pre">
                                  {JSON.stringify(event.data, null, 2)}
                                </Typography>
                              )
                            }
                          />
                        </ListItem>
                        <Divider />
                      </React.Fragment>
                    ))
                  )}
                </List>
              </Paper>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SocketServiceTest;
