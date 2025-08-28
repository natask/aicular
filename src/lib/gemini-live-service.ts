import { GoogleGenAI, Modality } from '@google/genai';

interface LiveSession {
  sendRealtimeInput: (input: unknown) => void;
  close: () => Promise<void>;
}

export interface GeminiSession {
  session: LiveSession;
  isConnected: boolean;
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

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private currentSession: GeminiSession | null = null;
  private model = "gemini-2.5-flash-preview-native-audio-dialog";

  constructor() {
    // Get API key from environment variable
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('NEXT_PUBLIC_GOOGLE_AI_API_KEY environment variable is required');
    }
    
    this.ai = new GoogleGenAI({ apiKey });
    console.log('GeminiLiveService initialized with direct API key');
  }

  async connectSession(): Promise<void> {
    try {
      console.log('Connecting to Gemini Live session...');
      
      if (this.currentSession?.isConnected) {
        console.log('Session already connected');
        return;
      }

      const config = {
        responseModalities: [Modality.AUDIO],
        systemInstruction: "You are an AI assistant that serves as 'eyes for the blind'. You receive both audio questions from the user and real-time video from their camera. Describe what you see in detail, answer questions about the visual environment, help with navigation, identify objects, read text, and provide helpful guidance. Be descriptive, clear, and concise. Always respond with audio output to help blind users understand their surroundings."
      };

      console.log('Attempting to connect with model:', this.model);
      
      const session = await this.ai.live.connect({
        model: this.model,
        callbacks: {
          onopen: () => {
            console.log('Gemini Live session opened successfully');
          },
          onmessage: (message) => {
            console.log('Received message from Gemini Live:', message);
            this.handleMessage(message);
          },
          onerror: (error) => {
            console.error('Gemini Live session error:', error);
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
        session: session as unknown as LiveSession,
        isConnected: true,
      };

      console.log('Gemini Live session connected successfully');
    } catch (error: unknown) {
      console.error('Failed to connect to Gemini Live:', error);
      const errorObj = error as Error;
      console.error('Error details:', {
        message: errorObj?.message,
        name: errorObj?.name,
        stack: errorObj?.stack?.substring(0, 500)
      });
      throw error;
    }
  }

  private handleMessage(message: unknown) {
    // Handle different types of messages from Gemini Live
    console.log('Processing message:', message);
  }

  private handleSessionError(error: Event) {
    console.error('Session error occurred:', error);
    if (this.currentSession) {
      this.currentSession.isConnected = false;
    }
  }

  private handleSessionClose(event: CloseEvent) {
    console.log('Session closed:', event.reason);
    if (this.currentSession) {
      this.currentSession.isConnected = false;
    }
  }

  async sendAudioChunk(audioChunk: AudioChunk): Promise<void> {
    if (!this.currentSession?.session || !this.currentSession.isConnected) {
      throw new Error('No active Gemini Live session');
    }

    try {
      this.currentSession.session.sendRealtimeInput({
        audio: {
          data: audioChunk.data,
          mimeType: audioChunk.mimeType
        }
      });
      console.log('Audio chunk sent successfully');
    } catch (error) {
      console.error('Failed to send audio chunk:', error);
      throw error;
    }
  }

  async sendVideoFrame(videoFrame: VideoFrame): Promise<void> {
    if (!this.currentSession?.session || !this.currentSession.isConnected) {
      throw new Error('No active Gemini Live session');
    }

    try {
      this.currentSession.session.sendRealtimeInput({
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

  async sendMultimodalInput(audioChunk: AudioChunk, videoFrame?: VideoFrame): Promise<void> {
    if (!this.currentSession?.session || !this.currentSession.isConnected) {
      throw new Error('No active Gemini Live session');
    }

    try {
      const input: Record<string, unknown> = {
        audio: {
          data: audioChunk.data,
          mimeType: audioChunk.mimeType
        }
      };

      if (videoFrame) {
        input.image = {
          data: videoFrame.data,
          mimeType: 'image/jpeg'
        };
      }

      this.currentSession.session.sendRealtimeInput(input);
      console.log('Multimodal input sent successfully');
    } catch (error) {
      console.error('Failed to send multimodal input:', error);
      throw error;
    }
  }

  async disconnectSession(): Promise<void> {
    if (this.currentSession?.session) {
      try {
        await this.currentSession.session.close();
        console.log('Gemini Live session disconnected');
      } catch (error) {
        console.error('Error disconnecting session:', error);
      }
    }
    this.currentSession = null;
  }

  isConnected(): boolean {
    return this.currentSession?.isConnected || false;
  }

  async cleanup(): Promise<void> {
    await this.disconnectSession();
  }
}
