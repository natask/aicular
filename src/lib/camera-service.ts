export interface CameraConfig {
  width: number;
  height: number;
  frameRate: number;
  facingMode: 'user' | 'environment'; // front or back camera
}

export interface VideoFrame {
  imageData: string; // base64 encoded image
  timestamp: number;
  width: number;
  height: number;
}

export class CameraService {
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private stream: MediaStream | null = null;
  private config: CameraConfig;
  private isCapturing = false;
  private frameInterval: NodeJS.Timeout | null = null;
  private onFrame: ((frame: VideoFrame) => void) | null = null;

  constructor(config: CameraConfig = {
    width: 640,
    height: 480,
    frameRate: 2, // 2 FPS for efficiency
    facingMode: 'environment' // Back camera for "seeing" the world
  }) {
    this.config = config;
    this.setupCanvas();
  }

  private setupCanvas(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.config.width;
    this.canvas.height = this.config.height;
    this.context = this.canvas.getContext('2d');
  }

  async requestCameraPermissions(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: this.config.width },
          height: { ideal: this.config.height },
          frameRate: { ideal: this.config.frameRate },
          facingMode: this.config.facingMode
        },
        audio: false // Audio handled separately
      });

      // Create video element
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true; // Important for mobile

      return true;
    } catch (error) {
      console.error('Failed to get camera permissions:', error);
      return false;
    }
  }

  async startCapture(onFrame: (frame: VideoFrame) => void): Promise<void> {
    if (!this.stream || !this.videoElement || !this.canvas || !this.context) {
      throw new Error('Camera not initialized. Call requestCameraPermissions() first.');
    }

    this.onFrame = onFrame;
    this.isCapturing = true;

    // Wait for video to be ready
    await new Promise<void>((resolve) => {
      this.videoElement!.onloadedmetadata = () => {
        this.videoElement!.play();
        resolve();
      };
    });

    // Start capturing frames at specified interval
    const intervalMs = 1000 / this.config.frameRate;
    this.frameInterval = setInterval(() => {
      this.captureFrame();
    }, intervalMs);

    console.log(`Camera capture started at ${this.config.frameRate} FPS`);
  }

  private captureFrame(): void {
    if (!this.videoElement || !this.canvas || !this.context || !this.onFrame) {
      return;
    }

    try {
      // Draw current video frame to canvas
      this.context.drawImage(
        this.videoElement,
        0, 0,
        this.config.width,
        this.config.height
      );

      // Convert canvas to base64 image
      const imageData = this.canvas.toDataURL('image/jpeg', 0.8); // 80% quality for efficiency
      
      const frame: VideoFrame = {
        imageData: imageData.split(',')[1], // Remove data:image/jpeg;base64, prefix
        timestamp: Date.now(),
        width: this.config.width,
        height: this.config.height
      };

      this.onFrame(frame);
    } catch (error) {
      console.error('Error capturing frame:', error);
    }
  }

  stopCapture(): void {
    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }
    this.isCapturing = false;
    console.log('Camera capture stopped');
  }

  switchCamera(): Promise<boolean> {
    // Switch between front and back camera
    const newFacingMode = this.config.facingMode === 'user' ? 'environment' : 'user';
    this.config.facingMode = newFacingMode;
    
    // Restart camera with new facing mode
    return this.restartCamera();
  }

  private async restartCamera(): Promise<boolean> {
    const wasCapturing = this.isCapturing;
    const currentOnFrame = this.onFrame;

    // Stop current capture
    this.stopCapture();
    await this.cleanup();

    // Restart with new settings
    const success = await this.requestCameraPermissions();
    if (success && wasCapturing && currentOnFrame) {
      await this.startCapture(currentOnFrame);
    }

    return success;
  }

  isActive(): boolean {
    return this.isCapturing;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  // Get video element for optional display
  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  async cleanup(): Promise<void> {
    this.stopCapture();

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    this.onFrame = null;
    console.log('Camera service cleaned up');
  }

  // Utility method to test camera functionality
  async testCamera(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: this.config.facingMode } 
      });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Camera test failed:', error);
      return false;
    }
  }

  // Get available cameras
  async getAvailableCameras(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Failed to enumerate cameras:', error);
      return [];
    }
  }
}
