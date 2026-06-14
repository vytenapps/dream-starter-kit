-- MCP remote server · OAuth 2.1 authorization-server storage.
--
-- The web app hosts a remote MCP server (packages/mcp) that an admin connects
-- from Claude/ChatGPT/Cursor. Auth follows the MCP authorization spec: the app
-- acts as its own OAuth 2.1 authorization server (dynamic client registration +
-- PKCE), reusing the existing Supabase /sign-in for the actual login.
--
-- These three tables hold that OAuth state. They are SERVER-ONLY: the only
-- principal that touches them is the app's service-role client (golden rule #2),
-- never an RLS browser/mobile client. So RLS is enabled with NO policies
-- (deny-all to anon/authenticated; service_role has BYPASSRLS), and table
-- privileges are revoked from anon/authenticated and the payload_cms role.
-- Access tokens are stateless signed JWTs (verified with MCP_JWT_SECRET, no DB
-- hit) — only refresh tokens (rotating, hashed) and authorization codes persist.

-- Registered MCP clients (RFC 7591 Dynamic Client Registration). Public PKCE
-- clients are the norm (token_endpoint_auth_method = 'none', no secret).
create table if not exists public.mcp_oauth_clients (
  id text primary key,
  client_secret_hash text,
  client_name text,
  redirect_uris text[] not null,
  grant_types text[] not null default '{authorization_code,refresh_token}',
  token_endpoint_auth_method text not null default 'none',
  scope text,
  created_at timestamptz not null default now()
);

-- Single-use, short-lived (~60s) authorization codes bound to a staff user and
-- a PKCE challenge. Consumed exactly once at the token endpoint.
create table if not exists public.mcp_authorization_codes (
  code text primary key,
  client_id text not null references public.mcp_oauth_clients (id) on delete cascade,
  supabase_user_id uuid not null references public.profiles (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  scope text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mcp_authorization_codes_expires_idx
  on public.mcp_authorization_codes (expires_at);

-- Rotating refresh tokens. We store only the SHA-256 hash of the opaque token;
-- on use we rotate (issue a new token, set rotated_to, revoke the old). A replay
-- of an already-rotated token is reuse — revoke the whole chain.
create table if not exists public.mcp_refresh_tokens (
  token_hash text primary key,
  client_id text not null references public.mcp_oauth_clients (id) on delete cascade,
  supabase_user_id uuid not null references public.profiles (id) on delete cascade,
  scope text,
  expires_at timestamptz not null,
  rotated_to text,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mcp_refresh_tokens_user_idx
  on public.mcp_refresh_tokens (supabase_user_id);

-- Deny-all RLS: enabled, no policies. Only the service-role key (BYPASSRLS)
-- reaches these rows; anon/authenticated get nothing.
alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_authorization_codes enable row level security;
alter table public.mcp_refresh_tokens enable row level security;

-- Defense in depth: strip table privileges from the RLS roles and from the
-- least-privilege Payload role (which must never see `public`).
revoke all on public.mcp_oauth_clients from anon, authenticated;
revoke all on public.mcp_authorization_codes from anon, authenticated;
revoke all on public.mcp_refresh_tokens from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'payload_cms') then
    revoke all on public.mcp_oauth_clients from payload_cms;
    revoke all on public.mcp_authorization_codes from payload_cms;
    revoke all on public.mcp_refresh_tokens from payload_cms;
  end if;
end
$$;
