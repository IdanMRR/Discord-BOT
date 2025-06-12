import { io, Socket } from 'socket.io-client';
import { WebSocketMessage, RealTimeUpdate } from '../types';
import toast from 'react-hot-toast';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isDisabled = false; // Re-enable WebSocket

  constructor() {
    if (!this.isDisabled) {
      this.connect();
    }
  }

  connect(): void {
    // Re-enable WebSocket connections
    if (this.isDisabled) {
      console.log('WebSocket connection disabled for now');
      return;
    }
    
    // Connect to the server port (3001) not the client port (3002)
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
    
    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      toast.success('Connected to real-time updates');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      toast.error('Lost connection to real-time updates');
      this.handleReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    });

    // Handle real-time updates
    this.socket.on('realtime_update', (update: RealTimeUpdate) => {
      this.handleRealTimeUpdate(update);
    });

    // Handle generic messages
    this.socket.on('message', (message: WebSocketMessage) => {
      this.notifyListeners(message.type, message.data);
    });

    // Handle specific event types
    this.socket.on('ticket_created', (data) => {
      this.notifyListeners('ticket_created', data);
      toast.success(`New ticket created: #${data.ticket_number}`);
    });

    this.socket.on('ticket_closed', (data) => {
      this.notifyListeners('ticket_closed', data);
      toast(`Ticket closed: #${data.ticket_number}`);
    });

    this.socket.on('warning_added', (data) => {
      this.notifyListeners('warning_added', data);
      toast.error(`New warning issued to ${data.user_id}`);
    });

    this.socket.on('server_joined', (data) => {
      this.notifyListeners('server_joined', data);
      toast.success(`Bot joined server: ${data.name}`);
    });

    this.socket.on('server_left', (data) => {
      this.notifyListeners('server_left', data);
      toast(`Bot left server: ${data.name}`);
    });
  }

  private handleReconnect(): void {
    if (this.isDisabled) return;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      toast.error('Failed to reconnect to real-time updates');
    }
  }

  private handleRealTimeUpdate(update: RealTimeUpdate): void {
    console.log('Real-time update received:', update);
    this.notifyListeners(update.type, update.data);
    
    // Show appropriate toast notification
    switch (update.type) {
      case 'ticket_created':
        toast.success(`New ticket: #${update.data.ticket_number}`);
        break;
      case 'ticket_closed':
        toast(`Ticket closed: #${update.data.ticket_number}`);
        break;
      case 'warning_added':
        toast.error('New warning issued');
        break;
      case 'server_joined':
        toast.success(`Joined server: ${update.data.name}`);
        break;
      case 'server_left':
        toast(`Left server: ${update.data.name}`);
        break;
    }
  }

  private notifyListeners(eventType: string, data: any): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket listener:', error);
        }
      });
    }
  }

  // Subscribe to specific events
  on(eventType: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  // Subscribe to all real-time updates
  onRealTimeUpdate(callback: (update: RealTimeUpdate) => void): () => void {
    return this.on('realtime_update', callback);
  }

  // Send message to server
  emit(eventType: string, data?: any): void {
    if (this.isDisabled) {
      console.warn('WebSocket is disabled, cannot emit:', eventType);
      return;
    }
    
    if (this.socket && this.socket.connected) {
      this.socket.emit(eventType, data);
    } else {
      console.warn('WebSocket not connected, cannot emit:', eventType);
    }
  }

  // Join a room (for guild-specific updates)
  joinRoom(roomId: string): void {
    this.emit('join_room', { roomId });
  }

  // Leave a room
  leaveRoom(roomId: string): void {
    this.emit('leave_room', { roomId });
  }

  // Get connection status
  isConnected(): boolean {
    if (this.isDisabled) return false;
    return this.socket?.connected || false;
  }

  // Disconnect
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  // Reconnect manually
  reconnect(): void {
    if (this.isDisabled) {
      console.log('WebSocket is disabled, cannot reconnect');
      return;
    }
    
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }
}

export const wsService = new WebSocketService();
export default wsService;
