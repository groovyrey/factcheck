# AI Chatbot Configuration

## Current Implementations
- **Main Chatbot**: Uses **Gemma 4** (`gemma-4-26b-a4b-it`) via the Google Generative AI SDK.
  - API Route: `src/app/api/gemini/route.ts`
  - Frontend: `src/app/page.tsx`
- **Test Page**: Uses **Cloudflare Workers AI** (`@cf/moonshotai/kimi-k2.6`).
  - API Route: `src/app/api/cloudflare/route.ts`
  - Frontend: `src/app/test/page.tsx`

## Future Considerations
- **OpenRouter**: The OpenRouter implementation in `src/app/api/chat/route.ts` is currently inactive in the UI but **must be preserved** for future use.

## Architectural Notes
- The project uses a multi-provider strategy for AI features.
- Prefer explicit API routes for different providers to maintain isolation.
