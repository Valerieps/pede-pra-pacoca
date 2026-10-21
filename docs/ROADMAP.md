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
| Contas: Cloudflare, projeto Google Cloud (cliente OAuth) e endereço do app | 1 | ADR-006, ADR-007 | Depende da dona. Sem isso o login não funciona fora dos testes |
| App instalável, compartilhar e colar link | 1 | `spec/app-e-instalacao.md` | O login Google, o primeiro acesso (nome e foto), a explicação da instalação e o service worker (só para os avisos) estão prontos. Falta: `share_target` no manifest, colar link, oferecer os avisos no primeiro acesso |
| Membros e papéis | 1 | `spec/grupo-e-papeis.md` | Convites, tela de membros e papéis prontos. Falta: remover membro (cancelar os pedidos ativos dele) |
| Exportar os dados do grupo (admin) | 1 | ADR-006 | O Durable Object não tem painel para ver os dados |
| Pedidos e ciclo de vida | 1 | `spec/pedidos.md` | |
| Petiscos e cashback | 1 | `spec/petiscos.md` | |
| Filas e ações do atendente, modo férias | 1 | `spec/atendente.md` | |
| Feed e curtidas | 1 | `spec/feed.md` | |
| Notificações: ligar cada gatilho | 1 | `spec/notificacoes.md` | A base está pronta (caixa de entrada, preferências, silêncio, resumo diário, curtidas agrupadas, Web Push). Falta cada feature chamar `notify` no seu comando: pedidos (novo, aguardando aprovação, aprovado, recusado ou não foi possível, atendido, eu também quero, oferta de herança), curtidas no feed, petiscos (cashback ou bônus, vence em 7 dias, renovados), Obrigada e falha do webhook. Também falta pôr as chaves VAPID nos segredos do Worker (`npm run vapid:keys`) |
| Webhook e configuração do Jellyseerr | 1 | `spec/jellyseerr.md` | Adiado: fica para o fim. Depende do Cesar (payload e segredo) |
| Perfil e estatísticas | 1 | `spec/estatisticas.md` | |
| Textos, animações e ilustrações da Paçoca | 1 | `spec/identidade.md` | Os estados vazios usam um placeholder (`EmptyState`). Falta: as ilustrações e as animações |
| Agente doméstico que cria pedidos no Jellyseerr | 2 | `spec/jellyseerr.md` | Só orientação de desenho |

## O código ainda não segue o spec

- O feed só mostra "entrou no grupo"; os outros eventos chegam com as features deles.
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
- [ ] `spec/notificacoes.md`: na caixa de entrada, as curtidas de um evento ficam num item só; o
  silêncio pode ser desligado, e mudar o silêncio vale para os avisos que ainda estão esperando.
- [ ] `spec/notificacoes.md`: o push ligado vale por celular, e posso desligar só num deles.
- [ ] `spec/grupo-e-papeis.md`: admin sem o papel de atendente pode fazer tudo do atendente, mas não
  conta como atendente: o pedido dele reserva petisco e ele não recebe os avisos de atendente.
- [ ] `spec/grupo-e-papeis.md`: o nome tem de 1 a 40 caracteres.
