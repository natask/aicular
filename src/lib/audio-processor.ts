export interface AudioProcessorConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  chunkSize: number;
}

export interface ProcessedAudioChunk {
  data: string; // base64 encoded
  mimeType: string;
  timestamp: number;
  duration: number;
}

export class AudioProcessor {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private config: AudioProcessorConfig;
  private isRecording = false;
  private audioChunks: Blob[] = [];
  private onAudioChunk: ((chunk: ProcessedAudioChunk) => void) | null = null;

  constructor(config: AudioProcessorConfig = {
    sampleRate: 16000,
    channels: 1,
    bitDepth: 16,
    chunkSize: 1000 // 1 second chunks
  }) {
    this.config = config;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      return true;
    } catch (error) {
      console.error('Failed to get audio permissions:', error);
      return false;
    }
  }

  async startRecording(onChunk: (chunk: ProcessedAudioChunk) => void): Promise<void> {
    if (!this.stream) {
      throw new Error('No audio stream available. Call requestPermissions() first.');
    }

    this.onAudioChunk = onChunk;
    this.isRecording = true;
    this.audioChunks = [];

    // Create audio context for processing
    this.audioContext = new AudioContext({
      sampleRate: this.config.sampleRate,
      latencyHint: 'interactive'
    });

    // Create media recorder with specific settings
    const options: MediaRecorderOptions = {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: this.config.sampleRate * this.config.channels * this.config.bitDepth / 8
    };

    this.mediaRecorder = new MediaRecorder(this.stream, options);

    this.mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        await this.processAudioChunk(event.data);
      }
    };

    this.mediaRecorder.start(this.config.chunkSize);
    console.log('Audio recording started');
  }

  private async processAudioChunk(blob: Blob): Promise<void> {
    try {
      // Convert blob to base64
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = this.arrayBufferToBase64(arrayBuffer);
      
      // Convert to required format (16-bit PCM, 16kHz, mono)
      const processedAudio = await this.convertToPCM(arrayBuffer);
      
      const chunk: ProcessedAudioChunk = {
        data: processedAudio,
        mimeType: 'audio/pcm;rate=16000',
        timestamp: Date.now(),
        duration: blob.size / (this.config.sampleRate * this.config.channels * this.config.bitDepth / 8) * 1000
      };

      if (this.onAudioChunk) {
        this.onAudioChunk(chunk);
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }

  private async convertToPCM(arrayBuffer: ArrayBuffer): Promise<string> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    try {
      // Decode the audio data
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Get the audio data
      const channelData = audioBuffer.getChannelData(0); // Mono
      
      // Convert to 16-bit PCM
      const pcmData = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        // Convert float32 to int16
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }
      
      // Convert to base64
      return this.arrayBufferToBase64(pcmData.buffer);
    } catch (error) {
      console.error('Error converting to PCM:', error);
      // Fallback: return original data as base64
      return this.arrayBufferToBase64(arrayBuffer);
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      console.log('Audio recording stopped');
    }
  }

  pauseRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.pause();
      console.log('Audio recording paused');
    }
  }

  resumeRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.resume();
      console.log('Audio recording resumed');
    }
  }

  isActive(): boolean {
    return this.isRecording;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  async cleanup(): Promise<void> {
    this.stopRecording();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    
    this.mediaRecorder = null;
    this.onAudioChunk = null;
    console.log('Audio processor cleaned up');
  }

  // Method to get audio level for visualization
  getAudioLevel(): number {
    if (!this.stream) return 0;
    
    // This is a simplified audio level detection
    // In a real implementation, you'd use Web Audio API to analyze the audio stream
    return Math.random() * 100; // Placeholder
  }
}
