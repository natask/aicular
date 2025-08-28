# AIcular - Blind Assistant Design Document

## 📋 Project Overview

**AIcular** is a Progressive Web App (PWA) that provides AI-powered assistance for blind users through Google's Gemini Live API. The application serves as "eyes for the blind" by offering real-time voice interaction and visual assistance capabilities.

## 🎯 Core Requirements

### Primary Objectives
- **Give eyes to the blind**: Enable visually impaired users to understand their environment
- **Phone-based assistance**: Use mobile devices as the primary interaction medium
- **Voice-only interface**: Complete interaction through audio input/output
- **Real-time processing**: Immediate AI responses using Gemini Live API
- **Mobile-optimized**: Progressive Web App for optimal mobile experience

### User Experience Goals
- **Zero learning curve**: Intuitive voice-only interaction
- **Continuous availability**: Always-on listening mode
- **Accessibility-first**: Designed specifically for blind users
- **High reliability**: Robust session management and error handling

## 🏗️ Technical Architecture

### Core Technology Stack
- **Frontend**: Next.js 15 with TypeScript
- **AI Service**: Google Gemini Live API via `@google/genai`
- **Audio Processing**: Web Audio API with real-time streaming
- **Camera Integration**: WebRTC getUserMedia API with real-time video capture
- **Multimodal Processing**: Combined audio + video input to Gemini Live API
- **PWA Features**: Service Worker, Web App Manifest
- **Styling**: Tailwind CSS with accessibility focus
- **Security**: Ephemeral token authentication

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Device   │    │   Backend API   │    │  Gemini Live    │
│   (PWA Client)  │    │   (Next.js)     │    │     API         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. Request Token      │                       │
         ├──────────────────────►│                       │
         │                       │ 2. Generate Token    │
         │                       ├──────────────────────►│
         │                       │ 3. Return Token      │
         │                       │◄──────────────────────┤
         │ 4. Ephemeral Token    │                       │
         │◄──────────────────────┤                       │
         │ 5. Direct Connection  │                       │
         ├───────────────────────────────────────────────►│
         │ 6. Audio + Video      │                       │
         │    Multimodal Stream  │                       │
         │◄──────────────────────────────────────────────►│
```

## 🔧 Implementation Specifications

### 1. Next.js Application Structure
```
src/
├── app/
│   ├── layout.tsx          # Root layout with PWA metadata
│   ├── page.tsx            # Main application interface
│   ├── globals.css         # Accessibility-focused styles
│   └── api/
│       └── auth/
│           └── ephemeral-token/
│               └── route.ts # Token generation endpoint
├── lib/
│   ├── gemini-live-service.ts  # Gemini Live API integration
│   ├── audio-processor.ts     # Real-time audio processing
│   └── camera-service.ts      # Real-time video capture
└── components/             # UI components (if needed)
```

### 2. Gemini Live API Integration
- **Model**: `gemini-2.5-flash-preview-native-audio-dialog`
- **Input Modalities**: Audio + Video (multimodal)
- **Response Modalities**: Audio output only
- **Session Management**: Sliding window compression + resumption
- **Token Management**: 10-minute ephemeral tokens with auto-refresh
- **System Instruction**: "Eyes for the blind" with visual scene analysis

### 3. Multimodal Processing Pipeline
```
Audio Pipeline:
Microphone Input → MediaRecorder → Audio Context → 
PCM Conversion → Base64 Encoding → Gemini Live API

Video Pipeline:
Camera Input → HTMLVideoElement → Canvas → 
JPEG Conversion → Base64 Encoding → Gemini Live API

Combined:
Audio Chunk + Video Frame → Multimodal Input → Gemini Live API
```

**Audio Specifications**:
- Sample Rate: 16kHz
- Channels: Mono (1 channel)
- Bit Depth: 16-bit
- Format: PCM
- Chunk Size: 1-second intervals

**Video Specifications**:
- Resolution: 640x480 (VGA)
- Frame Rate: 2 FPS (optimized for efficiency)
- Format: JPEG (80% quality)
- Camera: Environment-facing (back camera)
- Processing: Real-time frame capture via Canvas API

### 4. Security Architecture
- **Ephemeral Tokens**: 10-minute expiration with 3-minute refresh buffer
- **Server-side Generation**: API keys never exposed to client
- **Automatic Refresh**: Proactive token renewal before expiration
- **Session Resumption**: Maintain conversation context across reconnections

## 🎨 User Interface Design

### Design Principles
- **Minimalist**: Clean, uncluttered interface
- **High Contrast**: Enhanced visual accessibility
- **Large Touch Targets**: Minimum 44px for mobile interaction
- **Voice Feedback**: All interactions provide audio confirmation
- **Screen Reader Compatible**: Proper ARIA labels and semantic HTML

### Interface States
1. **Initial Load**: Permission request for camera and microphone
2. **Connecting**: Status indicator while establishing connection
3. **Ready**: Continuous listening and watching mode activated
4. **Processing**: Visual feedback during AI processing with audio/video indicators
5. **Error**: Clear error messages with recovery options

### Visual Hierarchy
```
┌─────────────────────────────────────┐
│              Status Dot             │ (top-right)
│                                     │
│                                     │
│            AIcular                  │ (main title)
│       Your AI-powered eyes          │ (subtitle)
│                                     │
│         Status Message              │ (dynamic)
│                                     │
│     [Enable Camera & Microphone]    │ (if needed)
│                                     │
│                                     │
│         Voice Feedback              │ (bottom)
└─────────────────────────────────────┘
```

## 🔄 Core Workflows

### 1. Initial Setup Flow
```
User loads app → Request camera & microphone permissions → 
Auto-connect to Gemini Live → Start continuous listening & video capture → Ready state
```

### 2. Conversation Flow
```
User speaks → Audio + Video capture → Send multimodal input to Gemini Live → 
AI processes visual scene + audio → Audio response → Play to user → Continue listening & watching
```

### 3. Token Refresh Flow
```
Token expires in 3 minutes → Request new token from backend → 
Update AI client → Continue session seamlessly
```

### 4. Error Recovery Flow
```
Connection lost → Attempt reconnection (max 3 tries) → 
If successful: Resume session → If failed: Show error + refresh option
```

## 📱 Progressive Web App Features

### PWA Manifest Configuration
```json
{
  "name": "AIcular - Blind Assistant",
  "short_name": "AIcular",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#000000",
  "theme_color": "#000000",
  "categories": ["accessibility", "productivity", "utilities"]
}
```

### Service Worker Capabilities
- **Offline Support**: Cache essential app resources
- **Background Sync**: Handle connection interruptions
- **Push Notifications**: Future feature for proactive assistance

### Mobile Optimizations
- **Viewport Configuration**: No zoom, fixed orientation
- **Safe Area Handling**: Support for device notches/bezels
- **Touch Optimization**: Large touch targets, haptic feedback
- **Battery Efficiency**: Optimized audio processing

## 🔒 Security & Privacy

### Authentication Flow
1. **Client Authentication**: User authenticates with application
2. **Server-side Token Generation**: Backend requests ephemeral token
3. **Short-lived Tokens**: 10-minute expiration reduces risk
4. **Direct Client Connection**: Low-latency communication with Gemini
5. **Automatic Refresh**: Seamless token renewal

### Privacy Protections
- **No Audio Storage**: Audio data not persisted locally
- **Ephemeral Sessions**: Conversation context expires with tokens
- **Secure Transmission**: HTTPS-only communication
- **Minimal Data Collection**: Only necessary for functionality

### Security Best Practices
- **API Key Protection**: Server-side only, never exposed to client
- **Token Validation**: Regular checks for token validity
- **Error Handling**: Secure error messages without sensitive data
- **Session Management**: Proper cleanup on disconnection

## 🎛️ Configuration Management

### Environment Variables
```bash
# Required
GOOGLE_AI_API_KEY=your_gemini_api_key

# Optional
NEXT_PUBLIC_APP_NAME=AIcular
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_GEMINI_MODEL=gemini-2.5-flash-preview-native-audio-dialog
```

### Token Configuration
```javascript
const tokenConfig = {
  uses: 1,                              // Single-use token
  expireTime: 10 * 60 * 1000,          // 10 minutes
  newSessionExpireTime: 60 * 1000,     // 1 minute to start
  refreshBuffer: 3 * 60 * 1000         // 3-minute refresh buffer
};
```

### Audio Configuration
```javascript
const audioConfig = {
  sampleRate: 16000,        // 16kHz required by Gemini Live
  channels: 1,              // Mono audio
  bitDepth: 16,            // 16-bit depth
  chunkSize: 1000,         // 1-second chunks
  echoCancellation: true,   // Noise reduction
  noiseSuppression: true,   // Audio quality
  autoGainControl: true     // Volume normalization
};
```

## 📊 Performance Requirements

### Response Time Targets
- **Token Generation**: < 500ms
- **Connection Establishment**: < 2 seconds
- **Audio Processing Latency**: < 100ms
- **AI Response Time**: < 3 seconds (depends on Gemini Live)

### Resource Constraints
- **Memory Usage**: < 50MB for audio processing
- **Network Bandwidth**: Optimized for mobile data
- **Battery Impact**: Minimal background processing
- **Storage**: < 5MB for PWA cache

### Scalability Considerations
- **Concurrent Users**: Backend can handle multiple token requests
- **Token Rate Limits**: Respect Gemini API quotas
- **Error Recovery**: Graceful degradation under load
- **Monitoring**: Track performance metrics and errors

## 🧪 Testing Strategy

### Unit Testing
- **Audio Processor**: Test PCM conversion and chunking
- **Token Management**: Verify refresh logic and validation
- **Session Management**: Test reconnection and resumption
- **Error Handling**: Validate error recovery flows

### Integration Testing
- **End-to-End Flow**: Complete user journey testing
- **API Integration**: Mock Gemini Live API responses
- **PWA Features**: Test installation and offline behavior
- **Accessibility**: Screen reader and keyboard navigation

### Performance Testing
- **Audio Latency**: Measure processing delays
- **Memory Usage**: Monitor for memory leaks
- **Network Efficiency**: Test under poor connections
- **Battery Impact**: Measure power consumption

## 🚀 Deployment & Operations

### Build Process
```bash
npm run build    # Production build with optimizations
npm run start    # Production server
```

### Environment Setup
- **Development**: Local development with hot reload
- **Staging**: Testing environment with production-like setup
- **Production**: Optimized build with PWA features enabled

### Monitoring & Logging
- **Error Tracking**: Client-side error reporting
- **Performance Monitoring**: Core Web Vitals tracking
- **API Metrics**: Token usage and success rates
- **User Analytics**: Accessibility usage patterns

### Maintenance
- **Token Rotation**: Regular API key updates
- **Dependency Updates**: Security patches and feature updates
- **Performance Optimization**: Ongoing improvements
- **User Feedback**: Accessibility improvements based on user input

## 🔮 Future Enhancements

### Phase 2 Features
- **Camera Integration**: Visual scene analysis
- **Multi-language Support**: Localized voice interfaces
- **Offline Capabilities**: Basic functionality without internet
- **Voice Training**: Personalized speech recognition

### Phase 3 Features
- **Smart Home Integration**: Control IoT devices via voice
- **Navigation Assistance**: GPS-based walking directions
- **Object Recognition**: Detailed item identification
- **Social Features**: Share experiences with family/caregivers

### Technical Improvements
- **Edge Computing**: Reduce latency with edge processing
- **Advanced Audio**: Spatial audio and noise cancellation
- **AI Optimization**: Fine-tuned models for accessibility
- **Platform Expansion**: Native mobile app versions

## 📝 Requirements Traceability

### ✅ Implemented Requirements
- [x] Next.js application with TypeScript
- [x] Gemini Live API integration using `@google/genai`
- [x] Audio output using `gemini-2.5-flash-preview-native-audio-dialog`
- [x] Ephemeral tokens with 10-minute expiration
- [x] Session management with sliding window compression
- [x] Session resumption capabilities
- [x] Voice-only interface (no press-and-hold required)
- [x] Real-time audio processing and streaming
- [x] **Camera integration for visual analysis ("eyes for the blind")**
- [x] **Real-time video capture and processing**
- [x] **Multimodal input (audio + video) to Gemini Live API**
- [x] **Scene description and visual AI assistance**
- [x] Progressive Web App with mobile optimization
- [x] Accessibility-first design for blind users
- [x] Automatic connection and continuous listening & watching
- [x] Clean, uncluttered user interface with proper spacing
- [x] Token refresh mechanism with proactive renewal
- [x] **Environment-facing camera for "seeing" the world**
- [x] **Real-time frame capture at optimized 2 FPS**

### 🔄 In Progress
- [ ] **Session connection debugging and error handling**

## 📚 References

- [Gemini Live API Documentation](https://ai.google.dev/gemini-api/docs/live)
- [Ephemeral Tokens Guide](https://ai.google.dev/gemini-api/docs/ephemeral-tokens)
- [Web Audio API Specification](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)
- [Web Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Document Version**: 2.0  
**Last Updated**: 2024-12-28  
**Status**: Core Implementation Complete (camera integration ✅)  
**Next Review**: After session connection debugging
