'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiLiveService } from '../lib/gemini-live-service-simple';
import { MediaService, MediaInput } from '../lib/media-service';

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [voiceFeedback, setVoiceFeedback] = useState<string>('');
  const [permissionsGranted, setPermissionsGranted] = useState({ audio: false, video: false });
  const [isMediaActive, setIsMediaActive] = useState(false);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());

  const geminiService = useRef<GeminiLiveService | null>(null);
  const mediaService = useRef<MediaService | null>(null);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize Gemini service (direct API key)
        geminiService.current = new GeminiLiveService();
        
        // Initialize unified media service (audio + video)
        mediaService.current = new MediaService({
          audio: {
            sampleRate: 16000,
            channels: 1,
            bitDepth: 16,
            chunkSize: 1000
          },
          video: {
            width: 640,
            height: 480,
            frameRate: 2, // 2 FPS for efficiency
            facingMode: 'environment' // Back camera to see the world
          }
        });

        // Request unified permissions (audio + video together)
        const permissions = await mediaService.current.requestPermissions();
        setPermissionsGranted(permissions);

        if (permissions.audio && permissions.video) {
          setStatus('connecting');
          setVoiceFeedback('Connecting to AI assistant...');
          
          // Auto-connect to Gemini Live API
          try {
            await geminiService.current!.connectSession();
            setIsConnected(true);
            setStatus('connected');
            setVoiceFeedback('Connected! I can see and hear you now.');

            // Start unified media capture (audio + video together)
            await mediaService.current!.startCapture(async (mediaInput: MediaInput) => {
              try {
                // Send combined audio + video to Gemini Live
                await geminiService.current!.sendMultimodalInput(
                  mediaInput.audio,
                  mediaInput.video
                );
                setIsProcessing(true);
                setLastActivity(new Date());
              } catch (error) {
                console.error('Failed to send multimodal input:', error);
                setVoiceFeedback('Error sending audio/video. Please try again.');
              }
            });

            setIsRecording(true);
            setIsMediaActive(true);
            startInactivityMonitoring();
          } catch (error) {
            console.error('Failed to auto-connect:', error);
            setStatus('error');
            setErrorMessage('Failed to connect. Please refresh the page.');
            setVoiceFeedback('Connection failed. Please refresh the page.');
          }
        } else {
          setStatus('error');
          const missingPerms = [];
          if (!permissions.audio) missingPerms.push('microphone');
          if (!permissions.video) missingPerms.push('camera');
          setErrorMessage(`${missingPerms.join(' and ')} permissions denied. Please enable access.`);
        }
      } catch (error) {
        console.error('Failed to initialize services:', error);
        setStatus('error');
        setErrorMessage('Failed to initialize. Please refresh the page.');
      }
    };

    initializeServices();

    return () => {
      cleanup();
    };
  }, []);

  // Cleanup function
  const cleanup = useCallback(async () => {
    if (geminiService.current) {
      await geminiService.current.cleanup();
    }
    if (mediaService.current) {
      await mediaService.current.cleanup();
    }
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
  }, []);



  // Stop recording (not used in auto-mode, but kept for potential future use)
  const stopRecording = useCallback(async () => {
    if (mediaService.current && isRecording) {
      mediaService.current.stopCapture();
      setIsRecording(false);
      setIsMediaActive(false);
      setVoiceFeedback('Recording stopped.');
    }
  }, [isRecording]);

  // Start inactivity monitoring
  const startInactivityMonitoring = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    inactivityTimer.current = setTimeout(() => {
      if (isConnected && !isRecording) {
        setVoiceFeedback('I haven\'t heard from you in a while. You can start speaking anytime.');
      }
    }, 30000); // 30 seconds
  }, [isConnected, isRecording]);

  return (
    <main 
      className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden p-8"
      tabIndex={0}
      role="main"
      aria-label="AIcular Blind Assistant"
    >
      {/* Simple Status Indicator */}
      <div className="absolute top-8 right-8 z-20">
        <div className={`
          w-4 h-4 rounded-full
          ${status === 'idle' ? 'bg-gray-500' : ''}
          ${status === 'connecting' ? 'bg-yellow-500 animate-pulse' : ''}
          ${status === 'connected' ? 'bg-green-500' : ''}
          ${status === 'error' ? 'bg-red-500' : ''}
        `} title={`Status: ${status}`}>
        </div>
      </div>

      {/* Main Content - Centered and Clean */}
      <div className="flex flex-col items-center justify-center text-center max-w-lg mx-auto px-6">
        {/* App Title */}
        <div className="mb-8">
          <h1 className="text-5xl md:text-6xl font-bold text-green-500 mb-2">
            AIcular
          </h1>
          
          {/* Subtitle */}
          <p className="text-lg md:text-xl text-gray-300">
            Your AI-powered eyes
          </p>
        </div>

        {/* Status Message */}
        <div className="w-full space-y-6">
          {(!permissionsGranted.audio || !permissionsGranted.video) ? (
            <div className="space-y-4">
              <p className="text-lg text-gray-300">
                Enable camera and microphone to start
              </p>
              <button
                onClick={async () => {
                  if (mediaService.current && geminiService.current) {
                    const permissions = await mediaService.current.requestPermissions();
                    setPermissionsGranted(permissions);
                    
                    if (permissions.audio && permissions.video) {
                      setStatus('connecting');
                      setVoiceFeedback('Connecting to AI assistant...');
                      
                      try {
                        // Auto-connect to Gemini Live API
                        await geminiService.current.connectSession();
                        setIsConnected(true);
                        setStatus('connected');
                        setVoiceFeedback('Connected! I can see and hear you now.');

                        // Start unified media capture (audio + video together)
                        await mediaService.current.startCapture(async (mediaInput: MediaInput) => {
                          try {
                            // Send combined audio + video to Gemini Live
                            await geminiService.current!.sendMultimodalInput(
                              mediaInput.audio,
                              mediaInput.video
                            );
                            setIsProcessing(true);
                            setLastActivity(new Date());
                          } catch (error) {
                            console.error('Failed to send multimodal input:', error);
                            setVoiceFeedback('Error sending audio/video. Please try again.');
                          }
                        });

                        setIsRecording(true);
                        setIsMediaActive(true);
                        startInactivityMonitoring();
                      } catch (error) {
                        console.error('Failed to auto-connect:', error);
                        setStatus('error');
                        setErrorMessage('Failed to connect. Please refresh the page.');
                        setVoiceFeedback('Connection failed. Please refresh the page.');
                      }
                    } else {
                      const missingPerms = [];
                      if (!permissions.audio) missingPerms.push('microphone');
                      if (!permissions.video) missingPerms.push('camera');
                      setErrorMessage(`${missingPerms.join(' and ')} permissions denied.`);
                    }
                  }
                }}
                className="w-full px-8 py-4 bg-green-500 text-black font-semibold rounded-lg text-lg hover:bg-green-600 transition-colors touch-target"
                aria-label="Enable camera and microphone permissions"
              >
                Enable Camera & Microphone
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-lg text-gray-300">
                {status === 'connected' ? 'Ready - I can see and hear you!' : 
                 status === 'connecting' ? 'Connecting to AI assistant...' : 
                 status === 'error' ? 'Connection error - Please refresh' :
                 'Initializing...'}
              </p>
              
              {isMediaActive && (
                <div className="flex items-center justify-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-red-400 text-sm">Listening</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-blue-400 text-sm">Watching</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="w-full mt-6 p-4 bg-red-900/20 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">
              {errorMessage}
            </p>
          </div>
        )}
      </div>

      {/* Voice Feedback - Simplified */}
      {voiceFeedback && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 bg-gray-900 text-white px-6 py-3 rounded-full text-sm max-w-[90vw] text-center border border-gray-700">
          {voiceFeedback}
        </div>
      )}
      </main>
  );
}
