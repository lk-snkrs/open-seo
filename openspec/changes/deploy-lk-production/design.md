## Context

O upstream roda em Cloudflare Workers ou em Docker local. No Docker, o estado é
mantido por Miniflare em `.wrangler`, `AUTH_MODE=local_noauth` injeta um admin e
o handler `scheduled` não recebe eventos. O Railway suporta Docker, rede privada,
volumes, custom domains e crons, portanto permite produção com poucas adaptações.
O workspace atual não autoriza backups nativos de volume; a recuperação usa
snapshot externo privado antes de mudanças stateful.

## Goals / Non-Goals

**Goals:** manter proximidade com upstream, falhar fechado, preservar dados entre
deploys, automatizar rankings, oferecer MCP seguro e tornar o serviço útil para
a operação SEO da LK.

**Non-goals:** multi-tenant externo, billing SaaS, port para Vercel, banco
Supabase ou SSO transparente com LK-HUB.

## Decisions

### Núcleo privado e gateway público

O serviço OpenSEO não terá domínio público. O gateway valida sessão Supabase e
allowlist antes de encaminhar HTTP/WS. Essa fronteira mantém o modo upstream
`local_noauth` fora da internet e permite atualizar a aplicação com menos
conflitos.

### Persistência nativa antes de Postgres

O volume em `/app/.wrangler` preserva D1, KV, R2 e estado dos workflows locais.
Supabase/Postgres fica reservado para uma migração futura baseada em volume,
concorrência ou recuperação, não como requisito especulativo.

### Build no estágio de imagem

O bundle Vite é compilado durante o build da imagem Railway. A instância de
runtime executa apenas preflight, migrações idempotentes e o servidor do bundle
pré-compilado, evitando exceder a memória disponível durante cold starts.
Como os secrets do Railway só existem no runtime, o entrypoint materializa uma
allowlist de bindings em `dist/server/.dev.vars` efêmero com permissão 0600; o
arquivo não entra na imagem nem no volume persistente.

### Credenciais separadas por ator

Usuários usam Supabase Auth e allowlist. MCP usa `OPEN_SEO_MCP_TOKEN`. Scheduler
usa `OPEN_SEO_CRON_SECRET`. Nenhuma credencial serve a mais de uma fronteira.

### Cron reutiliza serviço canônico

A rota interna chama `runScheduledRankChecks(env)`; não duplica regras de
vencimento, avanço de `nextCheckAt` ou exclusão de runs concorrentes. O Railway
Cron apenas acorda o núcleo.

### Dois recortes para frequências diferentes

O schema upstream permite uma configuração por domínio+localização. Portanto o
mobile diário será nacional Brasil e o desktop semanal será São Paulo local,
ambos com a mesma lista de 100 keywords.

### Prioridade comercial com três janelas

O baseline cruza vendas líquidas por produto e coleção na Shopify e normaliza
cada janela antes de compor o score: 50% últimos 30 dias, 30% últimos 90 dias e
20% últimos 180 dias. Termos de SKU são consolidados em clusters SEO de modelo
ou coleção, que recebem uma tag gerenciada no OpenSEO. O recorte deve ser
recalculado antes de decisões estratégicas para não congelar sazonalidade.

### Fork fixado e atualizações controladas

Produção inicia em `v0.1.3`. Atualizações futuras entram por PR desde `upstream`,
executam testes e snapshot externo do volume antes do deploy.

## Threat Model

- Bypass do gateway: prevenido pela ausência de domínio/TCP público no núcleo.
- Roubo de cookie: mitigado por flags seguras, TLS e sessão curta/refresh server-side.
- E-mail válido fora do time: allowlist falha fechado.
- Vazamento de token MCP/cron: secrets separados, sem logs, rotacionáveis.
- SSRF/proxy aberto: destino do proxy é constante e privado; Host não vem do usuário.
- Replay/concorrência cron: secret + proteção nativa de run ativa.
- Perda de SQLite: volume persistente e snapshot externo privado verificado antes de upgrades stateful.

## Error Handling

- Supabase indisponível: `503`, sem encaminhar ao núcleo.
- Sessão ausente/inválida: redirecionar ao login para HTML; `401` para API.
- E-mail fora da allowlist: `403` e logout local.
- OpenSEO indisponível: `502` com request ID não sensível.
- Cron inválido: `401`; run em progresso continua sendo no-op canônico.
- MCP inválido: `401` com `WWW-Authenticate: Bearer`.

## Migration Plan

1. Testar fork e gateway localmente.
2. Provisionar Railway sem domínio público no núcleo.
3. Validar domínio Railway temporário do gateway.
4. Configurar secrets e volume; capturar e verificar o snapshot externo inicial.
5. Configurar LK e integrações; capturar baseline.
6. Criar DNS `seo`, validar SSL e acesso.
7. Adicionar link no LK-HUB e publicar.

## Rollback

Rollback por deployment anterior no Railway e restauração do snapshot externo
no volume. O DNS `seo` é isolado; removê-lo não afeta nenhuma outra superfície
LK. O link do HUB é uma mudança independente e reversível.

## Open Questions

Nenhuma. E-mails autorizados serão derivados dos usuários ativos dos papéis
aprovados no LK-HUB e materializados como allowlist revisável sem imprimir PII
em logs ou artefatos.
