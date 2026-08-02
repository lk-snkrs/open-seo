# OpenSEO LK — design de produção

Data: 2026-08-02

## Resultado esperado

Executar o OpenSEO completo e configurado para a LK Sneakers em
`https://seo.lksneakers.com.br`, com autenticação, persistência, backups,
DataForSEO, Search Console, IA, MCP, auditorias e rank tracking automático. O
LK-HUB deve expor o acesso apenas a `admin`, `marketing` e `vendas`.

## Arquitetura

O fork `lk-snkrs/open-seo` acompanha o upstream `every-app/open-seo`. O serviço
`open-seo` roda a imagem Docker no Railway sem domínio público, em
`AUTH_MODE=local_noauth`, com volume montado em `/app/.wrangler`. Esse modo é
seguro porque o núcleo só é alcançável pela rede privada do projeto.

Um gateway TypeScript separado é a única superfície pública. Ele autentica
usuários com o Supabase Auth da LK, mantém sessão própria para o subdomínio e
confere uma allowlist explícita. Requisições web e WebSocket autenticadas são
encaminhadas ao núcleo. `/mcp` usa bearer token próprio e não aceita cookie de
navegador como credencial de máquina.

Uma rota interna no núcleo valida `OPEN_SEO_CRON_SECRET` e invoca o mesmo serviço
de agendamento usado pelo handler `scheduled` do Worker. Um Railway Cron chama
essa rota em intervalo suficiente para processar configurações vencidas. A
proteção nativa contra execução concorrente permanece a fonte de verdade.

## Configuração LK

- Projeto: LK Sneakers, domínio `lksneakers.com.br`.
- Mercado: Brasil, idioma português-BR.
- Rank tracking nacional: mobile, diário.
- Rank tracking local: desktop, semanal, São Paulo.
- Palavras-chave: 100 únicas, com 60 modelos/coleções, 20 transacionais, 10
  locais e 10 de marca/autenticidade; as mesmas 100 alimentam ambos os recortes.
- Concorrentes diretos/resellers: Juicy Sneakers, Hype Concept, PalmTree48 e
  Droper.
- Retailers como referência de SERP, não concorrentes diretos: Authentic Feet,
  Artwalk, Guadalupe, Netshoes e outros observados.
- Auditoria inicial completa do domínio e baseline salvo.
- Search Console conectado à propriedade verificada da LK.
- SAM/IA habilitado via OpenRouter.
- MCP configurado para Codex/Hermes com segredo de máquina rotacionável.

## Dados e segredos

O D1/SQLite local do upstream é suficiente para a primeira versão e reduz
divergência; Supabase não armazenará os dados do OpenSEO. O volume Railway terá
backups diário e semanal. Secrets ficam apenas no Doppler e nas variáveis do
Railway, nunca no Git.

## Segurança

- Núcleo sem domínio público e sem TCP proxy.
- Gateway falha fechado quando Supabase, allowlist ou upstream estão
  indisponíveis.
- Cookies `HttpOnly`, `Secure`, `SameSite=Lax`, sem tokens em URLs ou logs.
- MCP e cron usam segredos diferentes e comparação em tempo constante.
- Health público do gateway não expõe configuração; health detalhado só via
  rede privada.
- Telemetria do OpenSEO desabilitada para não emitir heartbeat externo.
- Rate limit no login e cabeçalhos de segurança no gateway.

## Deploy e domínio

O Railway recebe o fork via GitHub e mantém serviços `gateway`, `open-seo` e
`scheduler`. O domínio customizado é anexado somente ao gateway. A GoDaddy
recebe os registros CNAME/TXT entregues pelo Railway; SSL é emitido e renovado
pelo Railway.

## Rollback

1. Manter o domínio anterior inexistente até o gateway passar no domínio Railway.
2. Fazer snapshot do volume antes de upgrades.
3. Fixar releases de upstream; rollback de app volta ao deployment anterior.
4. Rollback de DNS remove apenas os registros de `seo`, sem tocar loja, e-mail
   ou `hub`.
5. O link do LK-HUB entra por último e pode ser revertido independentemente.

## Verificação

- Testes unitários do gateway, autorização MCP e rota cron.
- `pnpm test`, `pnpm lint`, `pnpm build`, typecheck e OpenSpec strict.
- Core sem endpoint público; gateway rejeita anônimo e e-mail fora da allowlist.
- Login autorizado abre o OpenSEO e WebSockets funcionam.
- DataForSEO e OpenRouter passam no `/api/health` privado.
- GSC conecta e retorna a propriedade LK.
- Rank check manual e agendado geram snapshots mobile e desktop.
- Auditoria completa termina e persiste após redeploy.
- MCP lista ferramentas e executa consulta somente leitura.
- Link do LK-HUB aparece apenas aos três papéis definidos em desktop e mobile.
