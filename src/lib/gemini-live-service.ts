import { GoogleGenAI, Modality } from '@google/genai';

export interface GeminiSession {
  session: any;
  sessionHandle: string | null;
  isConnected: boolean;
  isProcessing: boolean;
}

export interface AudioChunk {
  data: string; // base64 encoded audio
  mimeType: string;
  timestamp: number;
}

export interface VideoFrame {
  data: string; // base64 encoded image
  timestamp: number;
  width: number;
  height: number;
}

export interface SessionConfig {
  responseModalities: Modality[];
  systemInstruction?: string;
  contextWindowCompression?: {
    slidingWindow: {};
  };
  sessionResumption?: {
    handle: string | null;
  };
}

export class GeminiLiveService {
  private ai: GoogleGenAI | null = null;
  private model: string;
  private currentSession: GeminiSession | null = null;
  private sessionHandle: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastActivityTime = Date.now();
  private inactivityTimeout = 5 * 60 * 1000; // 5 minutes
  private currentToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private tokenRefreshInterval: NodeJS.Timeout | null = null;
  private isRefreshingToken = false;

  constructor() {
    // Using the correct model for Gemini Live API
    this.model = "models/gemini-2.0-flash-exp";
    this.startHealthCheck();
  }

  private startHealthCheck() {
    this.healthCheckInterval = setInterval(() => {
      this.checkSessionHealth();
    }, 30000); // Check every 30 seconds
  }

  private checkSessionHealth() {
    const now = Date.now();
    if (this.currentSession && this.currentSession.isConnected) {
      if (now - this.lastActivityTime > this.inactivityTimeout) {
        console.log('Session inactive, checking connection...');
        this.reconnectSession();
      }
    }
  }

  private async reconnectSession() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.cleanupSession();
      return;
    }

    try {
      console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      await this.connectSession();
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('Reconnection failed:', error);
      this.reconnectAttempts++;
      setTimeout(() => this.reconnectSession(), this.reconnectDelay * this.reconnectAttempts);
    }
  }

  async connectSession(): Promise<GeminiSession> {
    try {
      console.log('Starting Gemini Live connection...');
      
      // Ensure we have a valid ephemeral token
      const hasValidToken = await this.ensureValidToken();
      console.log('Token validation result:', hasValidToken);
      
      if (!hasValidToken || !this.ai) {
        console.error('Token validation failed:', { hasValidToken, hasAI: !!this.ai });
        throw new Error('Failed to obtain valid ephemeral token');
      }

      console.log('Creating session configuration...');

      const config: SessionConfig = {
        responseModalities: [Modality.AUDIO],
        systemInstruction: "You are an AI assistant that serves as 'eyes for the blind'. You receive both audio questions from the user and real-time video from their camera. Describe what you see in detail, answer questions about the visual environment, help with navigation, identify objects, read text, and provide helpful guidance. Be descriptive, clear, and concise. Always respond with audio output to help blind users understand their surroundings.",
        contextWindowCompression: { slidingWindow: {} },
        sessionResumption: { handle: this.sessionHandle }
      };

      console.log('Attempting to connect with model:', this.model);
      console.log('Using AI client with token');
      
      try {
        const session = await this.ai.live.connect({
          model: this.model,
          callbacks: {
          onopen: () => {
            console.log('Gemini Live session opened');
            this.lastActivityTime = Date.now();
          },
          onmessage: (message) => {
            this.handleMessage(message);
            this.lastActivityTime = Date.now();
          },
          onerror: (error) => {
            console.error('Gemini Live session error:', error);
            console.error('Error details:', {
              message: error?.message,
              type: error?.type,
              target: error?.target?.url
            });
            this.handleSessionError(error);
          },
          onclose: (event) => {
            console.log('Gemini Live session closed:', event.reason);
            this.handleSessionClose(event);
          },
        },
        config: config,
      });

      this.currentSession = {
        session,
        sessionHandle: this.sessionHandle,
        isConnected: true,
        isProcessing: false,
      };

      return this.currentSession;
    } catch (error: any) {
      console.error('Failed to connect to Gemini Live:', error);
      console.error('Connection error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        stack: error?.stack
      });
      
      // Check if it's an authentication error
      if (error?.message?.includes('401') || error?.message?.includes('403')) {
        console.error('Authentication error - token may be invalid');
        this.currentToken = null;
        this.tokenExpiresAt = null;
      }
      
      throw error;
    }
  }

  private handleMessage(message: any) {
    if (message.sessionResumptionUpdate) {
      if (message.sessionResumptionUpdate.resumable && message.sessionResumptionUpdate.newHandle) {
        this.sessionHandle = message.sessionResumptionUpdate.newHandle;
        console.log('Session resumption handle updated:', this.sessionHandle);
      }
    }

    if (message.goAway) {
      console.log('Session will terminate soon, time left:', message.goAway.timeLeft);
      this.handleGoAway(message.goAway);
    }

    if (message.serverContent && message.serverContent.generationComplete) {
      console.log('Generation complete');
      this.currentSession!.isProcessing = false;
    }
  }

  private handleSessionError(error: any) {
    console.error('Session error occurred:', error);
    console.error('Session state:', {
      isConnected: this.currentSession?.isConnected,
      sessionExists: !!this.currentSession,
      hasToken: !!this.currentToken
    });
    
    if (this.currentSession) {
      this.currentSession.isConnected = false;
    }
    
    // Only attempt reconnection if we have a valid token
    if (this.currentToken && this.isTokenValid()) {
      this.reconnectSession();
    } else {
      console.log('Token invalid, not attempting reconnection');
    }
  }

  private handleSessionClose(event: any) {
    console.log('Session closed:', event.reason);
    if (this.currentSession) {
      this.currentSession.isConnected = false;
    }
    
    if (event.reason === 'ABORTED') {
      this.reconnectSession();
    }
  }

  private handleGoAway(goAway: any) {
    const timeLeft = goAway.timeLeft;
    console.log(`Session will terminate in ${timeLeft} seconds`);
    
    // Attempt to extend session or prepare for resumption
    setTimeout(() => {
      if (this.currentSession && this.currentSession.isConnected) {
        this.reconnectSession();
      }
    }, (parseInt(timeLeft) - 10) * 1000); // Reconnect 10 seconds before termination
  }

  async sendAudioChunk(audioChunk: AudioChunk): Promise<void> {
    if (!this.currentSession || !this.currentSession.isConnected) {
      throw new Error('No active session');
    }

    if (this.currentSession.isProcessing) {
      console.log('Session is processing, queuing audio chunk');
      // In a real implementation, you might want to queue this
      return;
    }

    try {
      this.currentSession.isProcessing = true;
      this.lastActivityTime = Date.now();

      await this.currentSession.session.sendRealtimeInput({
        audio: {
          data: audioChunk.data,
          mimeType: audioChunk.mimeType
        }
      });

      console.log('Audio chunk sent successfully');
    } catch (error) {
      console.error('Failed to send audio chunk:', error);
      this.currentSession.isProcessing = false;
      throw error;
    }
  }

  async sendVideoFrame(videoFrame: VideoFrame): Promise<void> {
    if (!this.currentSession || !this.currentSession.isConnected) {
      throw new Error('No active session');
    }

    try {
      this.lastActivityTime = Date.now();

      await this.currentSession.session.sendRealtimeInput({
        image: {
          data: videoFrame.data,
          mimeType: 'image/jpeg'
        }
      });

      console.log('Video frame sent successfully');
    } catch (error) {
      console.error('Failed to send video frame:', error);
      throw error;
    }
  }

  async sendMultimodalInput(audioChunk?: AudioChunk, videoFrame?: VideoFrame): Promise<void> {
    if (!this.currentSession || !this.currentSession.isConnected) {
      throw new Error('No active session');
    }

    if (this.currentSession.isProcessing && audioChunk) {
      console.log('Session is processing, skipping multimodal input');
      return;
    }

    try {
      if (audioChunk) {
        this.currentSession.isProcessing = true;
      }
      this.lastActivityTime = Date.now();

      const input: any = {};
      
      if (audioChunk) {
        input.audio = {
          data: audioChunk.data,
          mimeType: audioChunk.mimeType
        };
      }
      
      if (videoFrame) {
        input.image = {
          data: videoFrame.data,
          mimeType: 'image/jpeg'
        };
      }

      await this.currentSession.session.sendRealtimeInput(input);

      console.log('Multimodal input sent successfully');
    } catch (error) {
      console.error('Failed to send multimodal input:', error);
      if (audioChunk) {
        this.currentSession.isProcessing = false;
      }
      throw error;
    }
  }

  async sendTextMessage(text: string): Promise<void> {
    if (!this.currentSession || !this.currentSession.isConnected) {
      throw new Error('No active session');
    }

    try {
      this.lastActivityTime = Date.now();
      
      await this.currentSession.session.sendClientContent({
        turns: text
      });

      console.log('Text message sent successfully');
    } catch (error) {
      console.error('Failed to send text message:', error);
      throw error;
    }
  }

  async disconnectSession(): Promise<void> {
    if (this.currentSession && this.currentSession.session) {
      try {
        await this.currentSession.session.close();
      } catch (error) {
        console.error('Error closing session:', error);
      }
    }
    this.cleanupSession();
  }

  private cleanupSession() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.tokenRefreshInterval) {
      clearTimeout(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
    
    this.currentSession = null;
    this.reconnectAttempts = 0;
    this.currentToken = null;
    this.tokenExpiresAt = null;
    this.isRefreshingToken = false;
  }

  getSessionStatus(): GeminiSession | null {
    return this.currentSession;
  }

  isSessionActive(): boolean {
    return this.currentSession !== null && this.currentSession.isConnected;
  }

  // Method to request new ephemeral token from backend
  async requestNewToken(): Promise<string | null> {
    try {
      console.log('Requesting new ephemeral token...');
      
      const response = await fetch('/api/auth/ephemeral-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Token request response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token request failed:', response.status, response.statusText, errorText);
        throw new Error(`Failed to get ephemeral token: ${response.status}`);
      }

      const data = await response.json();
      console.log('Got ephemeral token response:', { 
        hasToken: !!data.token, 
        expiresAt: data.expiresAt,
        tokenPreview: data.token?.substring(0, 30) + '...'
      });
      
      this.currentToken = data.token;
      this.tokenExpiresAt = new Date(data.expiresAt);
      
      console.log('Ephemeral token obtained, expires at:', this.tokenExpiresAt);
      
      // Schedule token refresh
      this.scheduleTokenRefresh();
      
      return data.token;
    } catch (error) {
      console.error('Failed to request ephemeral token:', error);
      return null;
    }
  }

  // Check if current token is still valid
  private isTokenValid(): boolean {
    if (!this.currentToken || !this.tokenExpiresAt) {
      return false;
    }
    
    // Check if token expires in the next 2 minutes (buffer time)
    const bufferTime = 2 * 60 * 1000;
    return Date.now() < (this.tokenExpiresAt.getTime() - bufferTime);
  }

  // Schedule token refresh before expiration
  private scheduleTokenRefresh(): void {
    // Clear any existing refresh timer
    if (this.tokenRefreshInterval) {
      clearTimeout(this.tokenRefreshInterval);
    }

    if (!this.tokenExpiresAt) {
      return;
    }

    // Schedule refresh 3 minutes before expiration (safe buffer)
    const refreshTime = this.tokenExpiresAt.getTime() - Date.now() - (3 * 60 * 1000);
    
    if (refreshTime > 0) {
      console.log(`Token refresh scheduled in ${Math.round(refreshTime / 1000)} seconds`);
      
      this.tokenRefreshInterval = setTimeout(async () => {
        await this.refreshToken();
      }, refreshTime);
    } else {
      // Token expires very soon, refresh immediately
      console.log('Token expires soon, refreshing immediately');
      this.refreshToken();
    }
  }

  // Refresh token proactively
  private async refreshToken(): Promise<boolean> {
    if (this.isRefreshingToken) {
      console.log('Token refresh already in progress');
      return false;
    }

    this.isRefreshingToken = true;
    console.log('Refreshing ephemeral token...');

    try {
      const newToken = await this.requestNewToken();
      
      if (newToken) {
        // Update the AI client with new token
        this.ai = new GoogleGenAI({ apiKey: newToken });
        console.log('Token refreshed successfully');
        
        // If we have an active session, we might need to handle session resumption
        if (this.currentSession && this.currentSession.isConnected) {
          console.log('Active session detected during token refresh');
          // The session should continue working with the new token automatically
          // due to session resumption mechanisms in Gemini Live API
        }
        
        return true;
      } else {
        console.error('Failed to refresh token');
        return false;
      }
    } catch (error) {
      console.error('Error during token refresh:', error);
      return false;
    } finally {
      this.isRefreshingToken = false;
    }
  }

  // Ensure we have a valid token
  private async ensureValidToken(): Promise<boolean> {
    // If token is being refreshed, wait a bit and check again
    if (this.isRefreshingToken) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.isTokenValid();
    }

    if (this.isTokenValid()) {
      return true;
    }

    const token = await this.requestNewToken();
    if (token) {
      this.ai = new GoogleGenAI({ apiKey: token });
      return true;
    }

    return false;
  }
}
