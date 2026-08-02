## ADDED Requirements

### Requirement: Private persistent OpenSEO core

The system SHALL run the pinned OpenSEO Docker release on Railway without a
public domain, SHALL persist `/app/.wrangler` on a Railway volume and SHALL
keep an off-platform snapshot before any stateful upgrade.

#### Scenario: Core cannot be reached from the internet

- **WHEN** a caller attempts to resolve or connect to the core service publicly
- **THEN** no public endpoint or TCP proxy exists for that service

#### Scenario: State survives deployment

- **WHEN** the OpenSEO service is redeployed after a project has been created
- **THEN** the project, integrations and historical snapshots remain available

#### Scenario: Stateful upgrade is prepared

- **WHEN** an operator prepares an upstream upgrade or destructive migration
- **THEN** a fresh private off-platform volume snapshot is verified before deployment

### Requirement: Authenticated human access

The gateway SHALL authenticate with LK Supabase Auth and SHALL authorize only
emails in the production allowlist before proxying HTTP or WebSocket traffic.

#### Scenario: Authorized user enters OpenSEO

- **WHEN** an allowlisted user completes a valid login
- **THEN** the gateway creates a secure session and the OpenSEO interface loads

#### Scenario: Unauthorized user is denied

- **WHEN** a valid Supabase user is not in the allowlist
- **THEN** the gateway returns `403` and never contacts the OpenSEO core

#### Scenario: Safari omits origin metadata on login

- **WHEN** Safari or an embedded browser submits the login form without trusted
  origin metadata but with the matching short-lived CSRF form and `__Host-` cookie tokens
- **THEN** the gateway accepts the CSRF boundary and continues authentication
- **AND** cross-site, wrong-host or invalid-token requests remain denied

### Requirement: Separate machine authentication

The gateway SHALL protect MCP with a dedicated bearer token and the core SHALL
protect its scheduler bridge with a different cron secret.

#### Scenario: MCP token is invalid

- **WHEN** `/mcp` receives a missing or invalid bearer token
- **THEN** it returns `401` without forwarding the request

#### Scenario: Cron token is invalid

- **WHEN** the internal scheduled-check endpoint receives a missing or invalid secret
- **THEN** it returns `401` and starts no rank check

### Requirement: Automated rank tracking

The scheduler bridge SHALL invoke the upstream scheduled-rank service and SHALL
preserve its due-time and concurrency behavior.

#### Scenario: Due configurations run

- **WHEN** Railway Cron invokes the bridge with a valid secret
- **THEN** due configurations start and non-due or already-active configurations do not duplicate

### Requirement: LK production configuration

Production SHALL contain one `lksneakers.com.br` project configured for Brazil
and Portuguese, four direct reseller competitors, 100 curated unique keywords,
national mobile daily tracking and São Paulo desktop weekly tracking.
The initial keyword strategy SHALL prioritize commercially relevant product and
collection clusters using normalized Shopify net sales with weights of 50% for
the last 30 days, 30% for the last 90 days and 20% for the last 180 days.

#### Scenario: User opens LK project

- **WHEN** an authorized user views the configured project
- **THEN** competitors, keyword set, both tracking recuts and saved baseline are visible

#### Scenario: Commercial-priority keywords are identifiable

- **WHEN** a user filters saved keywords by the managed sales-priority tag
- **THEN** the product and collection clusters selected from the weighted 30/90/180-day Shopify baseline are visible

### Requirement: LK integrations

Production SHALL enable DataForSEO, Google Search Console, OpenRouter/SAM and MCP
and SHALL report their readiness without exposing secret values.

#### Scenario: Integration smoke tests pass

- **WHEN** an authorized operator runs the smoke checks
- **THEN** DataForSEO returns live data, GSC returns the LK property, SAM responds and MCP lists tools

#### Scenario: Search Console OAuth crosses the private Railway boundary

- **WHEN** the private core generates the Google authorization and callback URLs
- **THEN** both use `https://seo.lksneakers.com.br` rather than the Railway-internal service origin

### Requirement: Branded production endpoint

The authenticated gateway SHALL serve `https://seo.lksneakers.com.br` with valid
TLS, and LK-HUB SHALL show an external link only to `admin`, `marketing` and
`vendas` roles.

#### Scenario: Allowed HUB role opens SEO

- **WHEN** an allowed role selects the OpenSEO link
- **THEN** a new browser navigation reaches the authenticated production endpoint

#### Scenario: Disallowed HUB role views navigation

- **WHEN** another role loads the HUB navigation
- **THEN** no OpenSEO item is present
