## Why

O OpenSEO atende aos fluxos de SEO/GEO da LK, mas o self-host Docker oficial é
voltado a uso local: não possui autenticação e não dispara rank tracking
agendado. Publicá-lo diretamente no Railway exporia dados e credenciais; portar
o runtime para Vercel/Supabase criaria divergência extensa do upstream.

## What Changes

- Empacotar o OpenSEO para produção no Railway com núcleo privado e volume
  persistente.
- Criar gateway autenticado por Supabase Auth + allowlist, com proxy HTTP e
  WebSocket, health mínimo e cabeçalhos seguros.
- Proteger MCP com bearer token independente da sessão humana.
- Expor uma ponte interna autenticada para o scheduler nativo e acioná-la por
  Railway Cron.
- Configurar DataForSEO, GSC, OpenRouter, projeto LK, concorrentes, 100 keywords,
  auditoria e dois recortes de rank tracking.
- Publicar `seo.lksneakers.com.br` via GoDaddy → Railway e integrar o link ao
  LK-HUB por papel.

## Non-goals

- Reescrever o OpenSEO para Vercel ou trocar D1/SQLite por Supabase/Postgres.
- Integrar sessões entre LK-HUB e OpenSEO; o login do subdomínio é separado.
- Sincronizar automaticamente a allowlist com papéis do HUB nesta versão.
- Alterar algoritmos ou UI de SEO que não sejam necessários ao deploy seguro.

## Capabilities

### New Capabilities

- `lk-production-deployment`: execução privada/persistente, acesso humano e de
  máquina, automação, domínio, integrações e configuração inicial da LK.

### Modified Capabilities

Nenhuma capability funcional do upstream será alterada além da ponte operacional
de cron necessária ao Docker.

## Impact

- Novo gateway e configuração Railway no fork `lk-snkrs/open-seo`.
- Pequena rota interna no servidor OpenSEO e testes correspondentes.
- Doppler/Railway: novas variáveis derivadas de secrets existentes e segredos
  exclusivos de gateway, MCP e cron.
- GoDaddy: CNAME/TXT somente para `seo.lksneakers.com.br`.
- LK-HUB: item externo em Crescimento/Canais para `admin`, `marketing` e `vendas`.
- Writes externos necessários: GitHub, Railway, Doppler, GoDaddy, Google OAuth/GSC
  e Vercel do LK-HUB; todos limitados ao escopo aprovado.
