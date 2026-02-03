/**
 * WebSocket Service Layer
 * Handles real-time connections for notifications and updates
 */

const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'wss://ws.securebase.dev';
const RECONNECT_INTERVAL = 3000;
const RECONNECT_MAX_RETRIES = 10;

class WebSocketService {
  constructor() {
    this.ws = null;
    this.url = WEBSOCKET_URL;
    this.reconnectAttempts = 0;
    this.reconnectInterval = RECONNECT_INTERVAL;
    this.listeners = new Map();
    this.messageQueue = [];
    this.isConnecting = false;
  }

  /**
   * Connect to WebSocket server
   */
  connect(token) {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        resolve();
        return;
      }

      this.isConnecting = true;

      try {
        // Create WebSocket connection with auth token
        const urlWithAuth = `${this.url}?token=${token}`;
        this.ws = new WebSocket(urlWithAuth);

        // On open
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          
          // Send queued messages
          this.flushMessageQueue();
          
          // Emit connected event
          this.emit('connected', { timestamp: Date.now() });
          
          resolve();
        };

        // On message
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        // On error
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', { error: error.message });
        };

        // On close
        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isConnecting = false;
          this.emit('disconnected', { timestamp: Date.now() });
          
          // Attempt reconnect
          this.attemptReconnect(token);
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to event type
   */
  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(eventType);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Unsubscribe from event type
   */
  unsubscribe(eventType, callback) {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  emit(eventType, data) {
    const callbacks = this.listeners.get(eventType) || [];
    callbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${eventType} listener:`, error);
      }
    });
  }

  /**
   * Send message to server
   */
  send(type, payload) {
    const message = {
      type,
      payload,
      timestamp: Date.now(),
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message if not connected
      this.messageQueue.push(message);
      console.warn('WebSocket not connected. Message queued.');
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(message) {
    const { type, payload, id } = message;

    switch (type) {
      case 'notification':
        this.emit('notification', payload);
        break;

      case 'ticket_update':
        this.emit('ticket_update', payload);
        break;

      case 'metrics_update':
        this.emit('metrics_update', payload);
        break;

      case 'compliance_update':
        this.emit('compliance_update', payload);
        break;

      case 'invoice_created':
        this.emit('invoice_created', payload);
        break;

      case 'heartbeat':
        // Server heartbeat - respond with pong
        this.send('pong', { id });
        break;

      default:
        console.warn('Unknown message type:', type);
    }
  }

  /**
   * Flush queued messages
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      } else {
        this.messageQueue.unshift(message);
        break;
      }
    }
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect(token) {
    if (this.reconnectAttempts >= RECONNECT_MAX_RETRIES) {
      console.error('Max reconnection attempts reached');
      this.emit('reconnect_failed', { attempts: this.reconnectAttempts });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * this.reconnectAttempts; // Exponential backoff

    console.log(`Attempting to reconnect... (attempt ${this.reconnectAttempts}/${RECONNECT_MAX_RETRIES})`);

    setTimeout(() => {
      this.connect(token).catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get ready state
   */
  getReadyState() {
    if (!this.ws) return 'CLOSED';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
}

export const websocketService = new WebSocketService();
