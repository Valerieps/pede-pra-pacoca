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
| Contas: Cloudflare, projeto Google Cloud (cliente OAuth), chave do TMDB e endereço do app | 1 | ADR-006, ADR-007, ADR-009 | Depende da dona. Sem isso o login não funciona fora dos testes, e sem a chave do TMDB (`TMDB_API_KEY`) a busca e o pedido por link não funcionam |
| App instalável, compartilhar e colar link | 1 | `spec/app-e-instalacao.md` | O login Google, o primeiro acesso (nome e foto) e a explicação da instalação estão prontos. Falta: `share_target` no manifest, service worker |
| Membros e papéis | 1 | `spec/grupo-e-papeis.md` | Convites, tela de membros e papéis prontos. Falta: remover membro (cancelar os pedidos ativos dele) |
| Exportar os dados do grupo (admin) | 1 | ADR-006 | O Durable Object não tem painel para ver os dados |
| Pedidos: dar retorno | 1 | `spec/pedidos.md` | Pedir (link, busca, manual), duplicidade, "Eu também quero", cancelar com oferta, observação, Meus pedidos e detalhe estão prontos. Falta: "Assisti", nota e "Obrigada, Paçoca"; a animação da Paçoca ao confirmar. As notificações dos pedidos entram com Notificações; as mudanças de status do atendente, com as filas |
| Petiscos e cashback | 1 | `spec/petiscos.md` | |
| Filas e ações do atendente, modo férias | 1 | `spec/atendente.md` | |
| Feed e curtidas | 1 | `spec/feed.md` | |
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
- [ ] `spec/pedidos.md`: um pedido Cancelado sai do feed; desfazer "Eu também quero" tira o evento do
  feed. (Perguntado à dona; implementado como proposto até a resposta.)
- [ ] `spec/pedidos.md`: na oferta de herança, quem aceita com petisco leva o pedido a Aprovado; quem
  cancelou sai do pedido; desfazer "Eu também quero" com a oferta passa a oferta adiante; o atendente
  segue com o pedido durante a oferta, e passado de Aprovado ele não vira Cancelado. (Perguntado à
  dona; implementado como proposto até a resposta.)
- [ ] `spec/pedidos.md`: Meus pedidos mostra também os encerrados e aqueles em que cliquei "Eu
  também quero".
- [ ] ADR-009: o selo "Ainda não lançado" usa a data de lançamento principal do TMDB, não a do
  Brasil.
- [ ] `spec/grupo-e-papeis.md`: o nome tem de 1 a 40 caracteres.
