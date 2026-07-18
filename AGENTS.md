<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Frontend production configuration

The production frontend host does not provide reliable runtime environment
variables. Public production origins, OAuth callback URLs, and public OAuth
client IDs must be deterministic build constants in `web/next.config.ts` and
must not be overridable by `.env*` files during a production build. Keep local
development values environment-configurable.

Never put secrets in the Next.js `env` block: Next.js includes every value from
that block in the JavaScript bundle. Server secrets must remain outside the
frontend bundle or be moved behind a backend endpoint.
