/**
 * Signed conversation credentials for the existing ElevenLabs agent.
 * The API key never leaves the server.
 */

import { env } from '../config/env.js';

const ELEVENLABS_API = 'https://api.elevenlabs.io';

export interface VoiceSessionPayload {
  agentId: string;
  branchId: string;
  conversationToken?: string;
  signedUrl?: string;
}

async function elevenLabsGet(path: string): Promise<Record<string, unknown> | null> {
  if (!env.elevenLabsApiKey) return null;

  const url = new URL(ELEVENLABS_API + path);
  url.searchParams.set('agent_id', env.elevenLabsAgentId);
  if (env.elevenLabsBranchId) {
    url.searchParams.set('branch_id', env.elevenLabsBranchId);
  }

  const response = await fetch(url, {
    headers: { 'xi-api-key': env.elevenLabsApiKey },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.warn(
      '[bodha-ai] ElevenLabs session request failed:',
      response.status,
      detail.slice(0, 240),
    );
    return null;
  }

  return (await response.json()) as Record<string, unknown>;
}

export async function createVoiceSession(): Promise<VoiceSessionPayload> {
  const payload: VoiceSessionPayload = {
    agentId: env.elevenLabsAgentId,
    branchId: env.elevenLabsBranchId,
  };

  const tokenBody = await elevenLabsGet('/v1/convai/conversation/token');
  const token = typeof tokenBody?.token === 'string' ? tokenBody.token : undefined;
  if (token) payload.conversationToken = token;

  const signedBody = await elevenLabsGet('/v1/convai/conversation/get-signed-url');
  const signedUrl = typeof signedBody?.signed_url === 'string' ? signedBody.signed_url : undefined;
  if (signedUrl) payload.signedUrl = signedUrl;

  return payload;
}
