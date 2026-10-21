# Roadmap

O que ainda não está pronto.

- **Entra aqui:** o que falta construir, onde o código ainda não segue o spec, o que foi adiado de
  propósito e as lacunas do spec que o agente decidiu sozinho.
- **Não entra aqui:** o que já está pronto (quando uma linha fica pronta, ela sai daqui; o git e as
  issues fechadas guardam o histórico), bugs e débito técnico (issues do GitHub) e as regras (`spec/`).

A ordem de construção da fase 1 ainda será definida, depois que a spec estiver fechada.

## Falta construir

| Feature | Fase | Spec | Observação |
| --- | --- | --- | --- |
| Contas: Cloudflare, projeto Google Cloud (cliente OAuth), chave do TMDB e endereço do app | 1 | ADR-006, ADR-007, ADR-010 | Depende da dona. Sem isso o login não funciona fora dos testes, e sem a chave do TMDB (`TMDB_API_KEY`) a busca e o pedido por link não funcionam |
| App instalável, compartilhar e colar link | 1 | `spec/app-e-instalacao.md` | O login Google, o primeiro acesso (nome e foto) e a explicação da instalação estão prontos. Falta: `share_target` no manifest, service worker |
| Membros e papéis | 1 | `spec/grupo-e-papeis.md` | Convites, tela de membros e papéis prontos. Falta: remover membro (cancelar os pedidos ativos dele) |
| Pedidos: dar retorno | 1 | `spec/pedidos.md` | Pedir (link, busca, manual), duplicidade, "Eu também quero", cancelar com oferta, observação, Meus pedidos e detalhe estão prontos. Falta: "Assisti", nota e "Obrigada, Paçoca"; a animação da Paçoca ao confirmar. As notificações dos pedidos entram com Notificações; as mudanças de status do atendente, com as filas |
| Petiscos e cashback | 1 | `spec/petiscos.md` | Ajustes, bônus, cashback à mão, extrato e o job do aviso de 7 dias prontos. Falta: debitar ao virar Atendido e chamar `evaluateAutomaticCashback` (`server/application/petiscos.ts`) no efeito `evaluate_cashback` dos pedidos (vêm com as filas); ligar "cashback ou bônus recebido" e "petisco vence em 7 dias" às notificações (`notifyPetiscoReceived` e `notifyPetiscoExpiring` em `server/application/petiscos.ts`) |
| Filas e ações do atendente | 1 | `spec/atendente.md` | O modo férias está pronto. Falta: as filas, "Eu pego esse", os status e as ações em lote |
| Feed e curtidas | 1 | `spec/feed.md` | Curtidas, lista de quem curtiu, filtros e "Ver mais" prontos. Falta: o aviso agrupado de curtida, que espera a fila de envio (`outbox`): ligar em `enqueueGroupedLikeNotice` (`server/application/feed.ts`) |
| Notificações | 1 | `spec/notificacoes.md` | |
| Webhook e configuração do Jellyseerr | 1 | `spec/jellyseerr.md` | Adiado: fica para o fim. Depende do Cesar (payload e segredo) |
| Perfil e estatísticas | 1 | `spec/estatisticas.md` | |
| Textos, animações e ilustrações da Paçoca | 1 | `spec/identidade.md` | Os estados vazios usam um placeholder (`EmptyState`). Falta: as ilustrações e as animações |
| Agente doméstico que cria pedidos no Jellyseerr | 2 | `spec/jellyseerr.md` | Só orientação de desenho |

## O código ainda não segue o spec

- O feed mostra "entrou no grupo", "pediu" e "também quer"; os outros eventos chegam com as features
  deles. Curtir ainda não existe no detalhe do pedido.
- Sem conexão, o app mostra o que já estava na tela, mas não guarda nada entre aberturas.

## Adiado

- Conexão com o Jellyseerr (webhook, URL base, "Abrir no Jellyseerr") — a dona deixou para depois; até lá, o atendente marca os status à mão.
- Login com Apple — exige conta paga de desenvolvedor; fica fora enquanto o app não estiver nas lojas.
- App offline — o app só funciona com internet.

## Revisar as lacunas que o agente decidiu

- [ ] `spec/grupo-e-papeis.md`: quem volta ao grupo por novo convite recupera o histórico.
- [ ] `spec/pedidos.md`: se quem herda um pedido cancelado não tem petisco, o pedido vai para Aguardando aprovação.
- [ ] `spec/atendente.md`: com todos os atendentes de férias, só os pedidos em Aguardando aprovação geram push.
- [ ] `spec/notificacoes.md`: acrescentei os avisos de falha do webhook e da oferta de herdar pedido.
- [ ] `spec/grupo-e-papeis.md`: admin sem o papel de atendente pode fazer tudo do atendente, mas não
  conta como atendente: o pedido dele reserva petisco e ele não recebe os avisos de atendente.
- [ ] `spec/pedidos.md`: se a co-solicitante com a oferta de herança desfaz "Eu também quero", a
  oferta passa à seguinte.
- [ ] `spec/pedidos.md`: Meus pedidos mostra também os encerrados e aqueles em que cliquei "Eu
  também quero".
- [ ] ADR-010: o selo "Ainda não lançado" usa a data de lançamento principal do TMDB, não a do
  Brasil.
- [ ] `spec/grupo-e-papeis.md`: o nome tem de 1 a 40 caracteres.
- [ ] `spec/feed.md`: curtir fica no próprio item do feed (não só no detalhe do pedido).
- [ ] `spec/feed.md`: posso curtir o meu próprio evento, sem gerar notificação para mim.
- [ ] `spec/feed.md`: Pedidos = pedidos criados e "Eu também quero"; Meus = o que eu fiz e tudo dos
  pedidos que eu pedi ou também quero.
- [ ] `spec/feed.md`: o feed carrega 30 eventos de cada vez, com "Ver mais".
- [ ] `spec/petiscos.md`: o número mensal vai de 0 a 99, o bônus de 1 a 10 por vez (cada um com 90 dias), o limiar de 1 a 20, o motivo até 200 caracteres.
- [ ] `spec/petiscos.md`: o aviso de 7 dias é só para bônus e cashback não usados, uma vez por petisco, agrupado por pessoa.
- [ ] `spec/petiscos.md`: o cashback à mão lista os 50 pedidos Atendidos mais recentes elegíveis.
- [ ] `spec/atendente.md`: as férias acabam sozinhas às 00:00 da data de volta; o aviso mostra a data de volta mais próxima; admin sem papel de atendente não tem modo férias.
- [ ] `spec/grupo-e-papeis.md`: o arquivo de dados do grupo deixa de fora sessões, chaves de push e segredos.
