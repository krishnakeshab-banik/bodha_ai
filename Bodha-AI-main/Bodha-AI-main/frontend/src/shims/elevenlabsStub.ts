/** Android builds never load LiveKit / ElevenLabs — that WebRTC stack crashes the WebView. */

export const Conversation = {
  async startSession(): Promise<never> {
    throw new Error('quota_exceeded');
  },
};
