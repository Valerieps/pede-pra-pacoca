# Arquitetura

O desenho técnico que o código não mostra sozinho.

- **Entra aqui:** as invariantes (o que precisa ser sempre verdade), o modelo de dados, o fluxo de
  eventos e as migrações.
- **Não entra aqui:** um passeio pelos arquivos (o código mostra), o porquê de cada decisão (`adr/`),
  o que falta construir (`ROADMAP.md`) e as regras de produto (`spec/`).

## Visão geral

- **App:** web app (Vite + React + TypeScript), instalável (PWA). Fala só com a própria origem.
- **Servidor:** um Cloudflare Worker serve os arquivos do app, a API em `/api`, a conexão ao vivo e
  o cron. Todos os dados do grupo ficam num único Durable Object, `Group`, com SQLite. Ver ADR-006.
- **Login:** Google, pelo fluxo de código OAuth no Worker, com cookie de sessão. Ver ADR-007.
- **Jellyseerr:** só envia webhook para o Worker. O app nunca fala com a casa do Cesar.
- **TMDB:** a chave fica no Worker; o app pede busca e detalhes à API.

```
app (celular) ──POST /api/query|command──► Worker ──RPC──► Group (Durable Object, SQLite)
     ▲                                       ▲   ▲                │
     └──────── WebSocket /api/live ──────────┘   │                │ "mudou: feed, invites…"
                                                 │                ▼
Jellyseerr ──webhook──► Worker      cron 5 min ──┘      todos os apps abertos refazem a consulta
```

## Camadas

`domain` ← `application` ← `infrastructure` e `ui`, no app e no servidor.

- `src/domain/`: regras puras (ciclo do pedido, petiscos, cashback, links, papéis, calendário,
  textos da Paçoca). O app e o servidor usam o mesmo código.
- `src/application/api-contract.ts`: os nomes, entradas e saídas das consultas e dos comandos. É só
  tipo; o servidor importa com `import type`.
- `server/application/`: os casos de uso do servidor. Síncronos, dependem só das portas `Sql`,
  `Clock` e `IdGenerator`; os testes rodam sobre `node:sqlite`.
- `server/infrastructure/` e `server/entry/`: Cloudflare, Google, cookies. Finos.
- A interface chama `Backend` e `LiveUpdates` (portas em `src/application/ports.ts`), nunca a rede
  direto.

## Invariantes

- Só o servidor grava. O app não tem acesso ao banco; toda escrita é um comando que o `Group`
  confere (sessão, papel, regra) e grava numa transação só.
- Um comando roda sozinho: o Durable Object processa uma chamada por vez, e tudo o que o comando
  causa (pedido, movimentos de petisco, evento do feed, notificações) entra junto ou não entra.
- O saldo de petiscos nunca é gravado: é calculado dos movimentos imutáveis. Os mensais são uma cota
  do mês (o número configurado menos os reservados e debitados no mês, nunca abaixo de 0); bônus e
  cashback são lotes com validade.
- Toda transição de pedido grava autor e data (`request_transitions`).
- Papéis (atendente, admin) são conferidos no servidor, nunca só na interface. Solicitante é quem
  não tem papel.
- Sempre existe pelo menos um admin.
- Um pedido gera no máximo um cashback.
- O mesmo webhook processado duas vezes tem o mesmo resultado (`webhook_events`, pelo ID do evento).
- A sessão vale só enquanto o membro está ativo: remover alguém corta o acesso na próxima chamada.

## Modelo de dados

Tabelas do SQLite do `Group` (`server/application/schema.ts`). Datas em ISO 8601, UTC.

| Tabela | Campos principais | Observação |
| --- | --- | --- |
| `members` | id, google_sub, e-mail, nome, foto, foto do Google, escolha de foto (`google` ou `none`), perfil confirmado em, papéis, ativo, petiscos mensais próprios, preferências de notificação, férias | Removido fica com `active = 0`: o histórico continua. `photo_url` é a foto mostrada; o login atualiza a do Google |
| `sessions` | hash do token, membro, validade | Só o hash fica no banco |
| `invites` | e-mail, quem convidou, estado (pendente, aceito, revogado), datas | Um por e-mail; convidar de novo volta a pendente |
| `requests` | origem (tmdb ou manual), tipo, tmdb_id, `media_key`, título, ano, pôster, lançamento, gêneros, link, observação, solicitante, status, responsável, lote de petisco, motivo, nota de atendimento | `media_key` (`movie:123`) indexado para a duplicidade |
| `request_transitions` | pedido, de, para, autor, detalhe, data | Autor é o membro ou `jellyseerr` |
| `co_requests` | pedido, membro, data | A data ordena a oferta de herança |
| `inheritance_offers` | pedido, membro, estado, prazo | 5 dias por oferta |
| `feedback` | pedido, membro, assisti, nota, obrigada | |
| `feed_events` | tipo, ator, pedido, contagem de curtidas, data | |
| `likes` | evento, membro, data | Uma por pessoa por evento |
| `petisco_movements` | membro, tipo (mensal, bônus, cashback), operação (crédito, reserva, débito, estorno), lote, pedido, validade, motivo, autor | Imutável. Lote mensal é `monthly:AAAA-MM`; bônus e cashback usam o ID do crédito |
| `known_media` | `media_key`, data | Gravada pelo webhook |
| `config` | chave, valor (JSON) | Petiscos por mês, cashback, URL do Jellyseerr, segredo do webhook |
| `inbox` | membro, tipo, dados, lida, data | Caixa de entrada |
| `outbox` | membro, tipo, dados, chave de agrupamento, liberar depois de, enviada | Silêncio, resumo diário e curtidas agrupadas passam por aqui |
| `push_subscriptions` | endpoint, membro, chaves | Web Push |
| `webhook_events` | ID do evento, data | Idempotência |

## Fluxo de eventos

- **Comando:** Worker confere a origem e o cookie → `Group.command` → caso de uso aplica a regra do
  domínio, que devolve o novo estado e os efeitos → grava pedido, movimentos, evento do feed e
  `outbox` na mesma transação → avisa os apps abertos dos tópicos que mudaram.
- **Ao vivo:** cada app aberto tem um WebSocket com o `Group`. A mensagem diz só o que mudou; o app
  refaz as consultas daquele tópico, e todas ao reconectar.
- **Webhook do Jellyseerr:** Worker → confere o segredo em tempo constante → `Group` grava em
  `webhook_events` (se já existe, para) → grava Mídia conhecida → muda os pedidos correspondentes,
  como um comando.
- **Cron a cada 5 minutos:** `Group.tick()` vê o que venceu no fuso de São Paulo: entrega do
  `outbox` (respeitando silêncio e agrupamento), resumo diário, aviso de 7 dias, prazo das ofertas
  de herança, limpeza de sessões vencidas. A renovação mensal não precisa de job: a cota é do mês.

## Migrações

`MIGRATIONS` em `server/application/schema.ts` é uma lista numerada; o `Group` aplica as que faltam
ao iniciar, cada uma numa transação, e registra em `schema_migrations`. Uma migração publicada nunca
muda: a mudança seguinte é uma migração nova. Remover uma coluna leva duas versões: primeiro o código
para de usar, depois a coluna sai.
