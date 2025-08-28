export interface MediaConfig {
  audio: {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    chunkSize: number;
  };
  video: {
    width: number;
    height: number;
    frameRate: number;
    facingMode: 'user' | 'environment';
  };
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

export interface MediaInput {
  audio: AudioChunk;
  video: VideoFrame;
  timestamp: number;
}

export class MediaService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private config: MediaConfig;
  private isCapturing = false;
  private frameInterval: NodeJS.Timeout | null = null;
  private onMediaInput: ((input: MediaInput) => void) | null = null;
  private currentVideoFrame: VideoFrame | null = null;

  constructor(config: MediaConfig = {
    audio: {
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16,
      chunkSize: 1000
    },
    video: {
      width: 640,
      height: 480,
      frameRate: 2,
      facingMode: 'environment'
    }
  }) {
    this.config = config;
    this.setupCanvas();
  }

  private setupCanvas(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.config.video.width;
    this.canvas.height = this.config.video.height;
    this.canvas.style.display = 'none';
    document.body.appendChild(this.canvas);
    this.context = this.canvas.getContext('2d');
  }

  async requestPermissions(): Promise<{ audio: boolean; video: boolean }> {
    try {
      console.log('Requesting unified audio + video permissions...');
      
      // Request both audio and video in a single call
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.audio.sampleRate,
          channelCount: this.config.audio.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: {
          width: { ideal: this.config.video.width },
          height: { ideal: this.config.video.height },
          frameRate: { ideal: this.config.video.frameRate },
          facingMode: this.config.video.facingMode
        }
      });

      console.log('Got unified media stream:', {
        audioTracks: this.stream.getAudioTracks().length,
        videoTracks: this.stream.getVideoTracks().length
      });

      // Setup video element
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      this.videoElement.style.display = 'none';
      document.body.appendChild(this.videoElement);

      // Setup audio context
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
        sampleRate: this.config.audio.sampleRate
      });

      return {
        audio: this.stream.getAudioTracks().length > 0,
        video: this.stream.getVideoTracks().length > 0
      };
    } catch (error) {
      console.error('Failed to get media permissions:', error);
      return { audio: false, video: false };
    }
  }

  async startCapture(onMediaInput: (input: MediaInput) => void): Promise<void> {
    if (!this.stream || !this.videoElement || !this.canvas || !this.context) {
      throw new Error('Media not initialized. Call requestPermissions() first.');
    }

    this.onMediaInput = onMediaInput;
    this.isCapturing = true;

    console.log('Starting unified media capture...');

    // Wait for video to be ready
    await new Promise<void>((resolve) => {
      this.videoElement!.onloadedmetadata = () => {
        this.videoElement!.play();
        resolve();
      };
    });

    // Start video frame capture
    const frameIntervalMs = 1000 / this.config.video.frameRate;
    this.frameInterval = setInterval(() => {
      this.captureVideoFrame();
    }, frameIntervalMs);

    // Start audio recording
    await this.startAudioRecording();

    console.log(`Unified media capture started - Audio: ${this.config.audio.sampleRate}Hz, Video: ${this.config.video.frameRate}FPS`);
  }

  private async startAudioRecording(): Promise<void> {
    if (!this.stream || !this.audioContext) return;

    try {
      // Create MediaRecorder for audio chunks
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && this.currentVideoFrame && this.onMediaInput) {
          try {
            // Convert audio blob to base64
            const audioBase64 = await this.blobToBase64(event.data);
            
            const audioChunk: AudioChunk = {
              data: audioBase64,
              mimeType: 'audio/webm;codecs=opus',
              timestamp: Date.now()
            };

            // Combine with current video frame
            const mediaInput: MediaInput = {
              audio: audioChunk,
              video: this.currentVideoFrame,
              timestamp: Date.now()
            };

            this.onMediaInput(mediaInput);
          } catch (error) {
            console.error('Error processing audio chunk:', error);
          }
        }
      };

      // Record in chunks
      this.mediaRecorder.start(this.config.audio.chunkSize);
    } catch (error) {
      console.error('Failed to start audio recording:', error);
    }
  }

  private captureVideoFrame(): void {
    if (!this.videoElement || !this.canvas || !this.context || !this.isCapturing) {
      return;
    }

    try {
      // Draw current video frame to canvas
      this.context.drawImage(
        this.videoElement,
        0, 0,
        this.config.video.width,
        this.config.video.height
      );

      // Convert to base64 JPEG
      const imageData = this.canvas.toDataURL('image/jpeg', 0.8);
      
      this.currentVideoFrame = {
        data: imageData.split(',')[1], // Remove data:image/jpeg;base64, prefix
        timestamp: Date.now(),
        width: this.config.video.width,
        height: this.config.video.height
      };
    } catch (error) {
      console.error('Error capturing video frame:', error);
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:audio/webm;base64, prefix
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  stopCapture(): void {
    console.log('Stopping unified media capture...');
    
    this.isCapturing = false;

    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    this.onMediaInput = null;
    this.currentVideoFrame = null;
  }

  switchCamera(): Promise<boolean> {
    const newFacingMode = this.config.video.facingMode === 'user' ? 'environment' : 'user';
    this.config.video.facingMode = newFacingMode;
    return this.restartCapture();
  }

  private async restartCapture(): Promise<boolean> {
    const wasCapturing = this.isCapturing;
    const currentCallback = this.onMediaInput;

    this.stopCapture();
    await this.cleanup();

    const permissions = await this.requestPermissions();
    if (permissions.audio && permissions.video && wasCapturing && currentCallback) {
      await this.startCapture(currentCallback);
    }

    return permissions.audio && permissions.video;
  }

  isActive(): boolean {
    return this.isCapturing;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up unified media service...');
    
    this.stopCapture();

    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped ${track.kind} track`);
      });
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement.remove();
      this.videoElement = null;
    }

    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.context = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.mediaRecorder = null;
    this.onMediaInput = null;
    this.currentVideoFrame = null;
  }

  // Get available cameras and microphones
  async getAvailableDevices(): Promise<{
    cameras: MediaDeviceInfo[];
    microphones: MediaDeviceInfo[];
  }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        cameras: devices.filter(device => device.kind === 'videoinput'),
        microphones: devices.filter(device => device.kind === 'audioinput')
      };
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      return { cameras: [], microphones: [] };
    }
  }
}
