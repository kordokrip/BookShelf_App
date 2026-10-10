/**
 * Gemini 중계 Durable Object — 미국에 두고(locationHint) Gemini 호출만 여기서 보낸다.
 *
 * Google AI Studio(Gemini API)는 요청을 보낸 위치를 보고 막는다. Workers는 사용자 가까운 데이터센터에서
 * 외부로 요청을 보내므로, 운영·스테이징에서 Gemini가 400 "User location is not supported for the API use"를
 * 돌려줬다(로컬 개발 PC에서는 정상). 다른 API는 그대로 가까운 곳에서 처리하고, Gemini 요청만 이 객체를 거친다.
 * 상태는 저장하지 않는다(요청 본문을 그대로 전달하고 응답을 그대로 돌려준다).
 */
import { DurableObject } from 'cloudflare:workers';
import type { Bindings } from '../types';

export class GeminiProxy extends DurableObject<Bindings> {
  override async fetch(request: Request): Promise<Response> {
    const target = request.headers.get('x-gemini-url');
    if (request.method !== 'POST' || !target?.startsWith('https://generativelanguage.googleapis.com/')) {
      return new Response('bad request', { status: 400 });
    }
    if (!this.env.GEMINI_API_KEY) return new Response('no key', { status: 503 });
    return fetch(target, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.env.GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
      body: await request.text(),
      signal: request.signal,
    });
  }
}
