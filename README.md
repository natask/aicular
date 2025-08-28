# AIcular - AI-Powered Blind Assistant

AIcular is a Progressive Web App (PWA) that gives eyes to the blind using Google's Gemini Live API. Users can interact with the AI assistant through voice commands and receive audio responses, making the world more accessible.

## 🌟 Features

- **Voice-Only Interface**: Complete voice interaction - no visual input required
- **Press & Hold Activation**: Simple press-and-hold gesture to start speaking
- **Real-time AI Processing**: Uses Gemini Live API for instant responses
- **Ephemeral Token Security**: Secure client-server architecture using [ephemeral tokens](https://ai.google.dev/gemini-api/docs/ephemeral-tokens)
- **Session Management**: Advanced session handling with sliding window compression and resumption
- **Mobile Optimized**: Progressive Web App with excellent mobile experience
- **Accessibility First**: Built specifically for blind users with high contrast and screen reader support

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Google AI API key for Gemini Live API
- Modern web browser with microphone support

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd aicular
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   GOOGLE_AI_API_KEY=your_api_key_here
   ```
   
   **Important**: This API key is used server-side to generate ephemeral tokens. The client never directly accesses your API key, enhancing security as recommended by [Google's ephemeral tokens documentation](https://ai.google.dev/gemini-api/docs/ephemeral-tokens).

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
npm start
```

## 🔒 Security Architecture

This application implements Google's recommended security model for client-side Live API access:

1. **Client Authentication**: User authenticates with your application
2. **Server-Side Token Generation**: Backend requests ephemeral token from Gemini API
3. **Short-Lived Tokens**: Tokens expire in 10 minutes as configured
4. **Direct Client Connection**: Client connects directly to Gemini using ephemeral token
5. **Automatic Refresh**: Tokens are automatically refreshed before expiration

This approach ensures that:
- ✅ API keys never exposed to client-side code
- ✅ Tokens are short-lived (10 minutes)
- ✅ Low latency direct connections to Gemini
- ✅ Enhanced security for production deployment

## 📱 PWA Installation

### Mobile (iOS)
1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. Tap "Add"

### Mobile (Android)
1. Open the app in Chrome
2. Tap the menu button
3. Select "Add to Home screen"
4. Tap "Add"

### Desktop
1. Open the app in Chrome/Edge
2. Click the install icon in the address bar
3. Click "Install"

## 🎯 How to Use

### Basic Operation
1. **Grant Permissions**: Allow microphone access when prompted
2. **Activate**: Press and hold anywhere on the screen for 500ms
3. **Speak**: Ask questions or describe what you need help with
4. **Listen**: The AI will respond with audio feedback
5. **Stop**: Release to stop recording

### Voice Commands Examples
- "What's in front of me?"
- "Describe the room I'm in"
- "What color is this object?"
- "Help me navigate to the door"
- "Read this text for me"

## 🏗️ Architecture

### Core Components
- **GeminiLiveService**: Manages Gemini Live API connections with ephemeral tokens
- **AudioProcessor**: Handles real-time audio capture and processing
- **Ephemeral Token API**: Server-side endpoint for secure token generation

### Session Management
- **Sliding Window Compression**: Extends session lifetime with context compression
- **Session Resumption**: Maintains conversation context across reconnections
- **Health Monitoring**: Automatic reconnection and error handling
- **Token Refresh**: Automatic ephemeral token renewal

### Audio Processing
- **Real-time Capture**: Continuous audio streaming
- **Format Conversion**: Converts to Gemini Live API requirements (16kHz, 16-bit PCM)
- **Noise Reduction**: Built-in echo cancellation and noise suppression
- **Chunk Processing**: Efficient audio chunk handling

## 🔧 Configuration

### Ephemeral Token Settings
```typescript
const tokenConfig = {
  uses: 1,                    // Single use token
  expireTime: 10 * 60 * 1000, // 10 minutes
  newSessionExpireTime: 60 * 1000, // 1 minute to start session
  model: "gemini-2.5-flash-preview-native-audio-dialog"
};
```

### Audio Settings
```typescript
const audioConfig = {
  sampleRate: 16000,    // 16kHz sampling rate
  channels: 1,          // Mono audio
  bitDepth: 16,         // 16-bit depth
  chunkSize: 1000       // 1-second chunks
};
```

## 🛡️ Security Best Practices

- **Server-Side Token Generation**: API keys never exposed to client
- **Short Token Expiration**: 10-minute token lifetime
- **Secure Authentication**: Implement proper backend authentication
- **HTTPS Only**: Secure communication protocols
- **No Data Storage**: Audio data is not stored locally

## 🐛 Troubleshooting

### Common Issues

**"An API Key must be set when running in a browser" Error**
- ✅ **Fixed**: Now uses ephemeral tokens for secure client-side access
- Ensure your `.env.local` file contains `GOOGLE_AI_API_KEY`
- Restart the development server after adding the API key

**Microphone not working**
- Check browser permissions
- Ensure microphone is not used by other applications
- Try refreshing the page

**Connection failed**
- Verify API key is correct in `.env.local`
- Check internet connection
- Ensure Gemini Live API is enabled for your account

## 📚 References

- [Gemini Live API Documentation](https://ai.google.dev/gemini-api/docs/live)
- [Ephemeral Tokens Guide](https://ai.google.dev/gemini-api/docs/ephemeral-tokens)
- [Google AI JavaScript SDK](https://github.com/google/google-ai-javascript-sdk)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Gemini Live API team
- Web Audio API community
- Progressive Web App standards
- Accessibility advocates and testers

---

**Made with ❤️ for the blind community**