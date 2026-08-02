## 1. Contrato e baseline

- [x] 1.1 Inicializar OpenSpec, registrar design e validar o change estritamente.
- [x] 1.2 Fixar baseline `v0.1.3`, upstream remoto e estratégia de atualização.

## 2. Gateway seguro

- [x] 2.1 Escrever testes falhos para sessão, allowlist, API/HTML, MCP e WebSocket.
- [x] 2.2 Implementar gateway Supabase Auth, proxy constante, cookies seguros,
      headers, health e tratamento de indisponibilidade.
- [x] 2.3 Implementar bearer MCP separado e testes de não encaminhamento.

## 3. Agendamento Docker

- [x] 3.1 Escrever testes falhos para autenticação e disparo da ponte cron.
- [x] 3.2 Implementar rota interna que reutiliza `runScheduledRankChecks`.
- [x] 3.3 Documentar e configurar Railway Cron sem sobreposição.

## 4. Qualidade local

- [x] 4.1 Testar, lintar, typecheckar e buildar OpenSEO e gateway.
- [x] 4.2 Rodar revisão de código e segurança; corrigir achados materiais.
- [x] 4.3 Validar OpenSpec strict, secret scan e documentação operacional.

## 5. Railway e secrets

- [ ] 5.1 Criar projeto/serviços Railway, rede privada e volume em `/app/.wrangler`.
- [ ] 5.2 Derivar DataForSEO base64 sem impressão e configurar secrets Doppler/Railway.
- [ ] 5.3 Configurar backups, healthchecks, restart e rollback.
- [ ] 5.4 Publicar gateway temporário e provar núcleo sem endpoint público.

## 6. Configuração LK

- [ ] 6.1 Criar projeto Brasil/pt-BR, configurar concorrentes diretos e referências.
- [ ] 6.2 Montar/revisar as 100 keywords e configurar mobile nacional diário +
      desktop São Paulo semanal.
- [ ] 6.3 Conectar GSC, OpenRouter/SAM e MCP; executar auditoria/baseline inicial.

## 7. Domínio e LK-HUB

- [ ] 7.1 Associar `seo.lksneakers.com.br`, aplicar CNAME/TXT na GoDaddy e validar TLS.
- [ ] 7.2 Criar change OpenSpec do LK-HUB, adicionar link externo por papel e testes.
- [ ] 7.3 Publicar LK-HUB na Vercel e validar desktop/mobile autenticados.

## 8. Verificação e encerramento

- [ ] 8.1 Provar login allowlisted, bloqueio não autorizado, HTTP/WS e persistência pós-redeploy.
- [ ] 8.2 Provar DataForSEO, GSC, SAM, MCP, auditoria e rank checks manual/agendado.
- [ ] 8.3 Atualizar Brain com arquitetura, taxonomia de concorrentes e receipt live.
- [ ] 8.4 Arquivar mudanças OpenSpec somente após toda evidência live; commit e push finais.
