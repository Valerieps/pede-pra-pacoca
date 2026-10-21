# Arquitetura

O desenho técnico que o código não mostra sozinho.

- **Entra aqui:** as invariantes (o que precisa ser sempre verdade), o modelo de dados, o fluxo de
  eventos e as migrações.
- **Não entra aqui:** um passeio pelos arquivos (o código mostra), o porquê de cada decisão (`adr/`),
  o que falta construir (`ROADMAP.md`) e as regras de produto (`spec/`).

## Visão geral

- **App:** web app (Vite + React + TypeScript) em Cloudflare Pages, instalável (PWA).
- **Backend:** Firebase (Auth com Google, Firestore, Cloud Functions, Cloud Scheduler, FCM). Ver ADR-004.
- **Jellyseerr:** só envia webhook para uma Cloud Function. O app nunca fala com a casa do Cesar.
- **TMDB:** a chave fica numa Cloud Function; o app pede busca e detalhes a ela.

## Camadas

`domain` ← `application` ← `infrastructure` e `ui`. O domínio não importa nada de framework; a
aplicação define as portas (interfaces) que a infraestrutura implementa; a interface chama casos de
uso, nunca o banco direto.

## Invariantes

- O saldo de petiscos é a soma de movimentos imutáveis. Só as Cloud Functions gravam movimentos;
  as regras do Firestore negam escrita do cliente nessa coleção.
- Toda transição de pedido grava autor e data, e só as Cloud Functions mudam o status.
- Papéis (solicitante, atendente, admin) são conferidos no servidor (regras e Functions), nunca só
  na interface.
- O mesmo webhook processado duas vezes tem o mesmo resultado (idempotência por ID do evento).
- Sempre existe pelo menos um admin.
- Um pedido gera no máximo um cashback.

## Modelo de dados

| Entidade | Campos principais | Observação |
| --- | --- | --- |
| Usuário | id, nome, foto, e-mail, papéis, tokens de push, preferências de notificação | |
| Convite | e-mail, criado por, estado (pendente, aceito, revogado), datas | Sem expiração |
| Pedido | id, origem (tmdb ou manual), tmdbId, tipo, título, ano, pôster, link, observação, solicitante, status, atendente responsável, motivo, datas de cada transição | `tmdbId` indexado para a checagem de duplicidade |
| Co-solicitação | pedido, usuário, data | |
| Curtida | evento, usuário, data | |
| Evento do feed | tipo, ator, pedido, data, contagem de curtidas | |
| Movimento de petisco | usuário, tipo (mensal, bônus, cashback), operação (crédito, reserva, débito, estorno), pedido, validade, data | Imutável |
| Mídia conhecida | tmdbId, tipo, data | Gravada pelo webhook |
| Configuração | petiscos por mês, número fixo por pessoa, critérios de cashback, limiar, modo férias, URL do Jellyseerr, segredo do webhook | Segredo só legível pelas Functions |
| Notificação | destinatário, tipo, texto, lida, data | Caixa de entrada |

## Fluxo de eventos

- Mudança de status (Function) → grava o movimento de petisco → grava o evento do feed → enfileira
  a notificação.
- Webhook do Jellyseerr (Function) → valida o segredo → grava Mídia conhecida → muda os pedidos
  correspondentes.
- Jobs agendados: renovação mensal no dia 1 (America/Sao_Paulo), expiração e aviso de 7 dias,
  resumo diário dos atendentes.

## Migrações

O documento de configuração guarda `schemaVersion`. Uma versão só acrescenta campos opcionais;
remover um campo leva duas versões.
