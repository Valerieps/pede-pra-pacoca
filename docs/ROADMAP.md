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
| Membros e papéis | 1 | `spec/grupo-e-papeis.md` | Convites, tela de membros e papéis prontos. Falta: remover membro (cancelar os pedidos ativos dele) |
| Pedidos: dar retorno | 1 | `spec/pedidos.md` | Pedir (link, busca, manual), duplicidade, "Eu também quero", cancelar com oferta, observação, Meus pedidos e detalhe estão prontos. Falta: "Assisti", nota e "Obrigada, Paçoca". As notificações dos pedidos entram com Notificações; as mudanças de status do atendente, com as filas |
| Petiscos e cashback | 1 | `spec/petiscos.md` | Ajustes, bônus, cashback à mão, extrato e o job do aviso de 7 dias prontos. Falta: debitar ao virar Atendido e chamar `evaluateAutomaticCashback` (`server/application/petiscos.ts`) no efeito `evaluate_cashback` dos pedidos (vêm com as filas) |
| Filas e ações do atendente | 1 | `spec/atendente.md` | O modo férias está pronto. Falta: as filas, "Eu pego esse", os status e as ações em lote |
| Notificações: ligar cada gatilho | 1 | `spec/notificacoes.md` | A base está pronta (caixa de entrada, preferências, silêncio, resumo diário, curtidas agrupadas, Web Push). Falta cada feature chamar `notify` no seu comando: pedidos (novo, aguardando aprovação, aprovado, recusado ou não foi possível, atendido, eu também quero, oferta de herança), petiscos renovados, Obrigada e falha do webhook. Também falta pôr as chaves VAPID nos segredos do Worker (`npm run vapid:keys`) |
| Webhook e configuração do Jellyseerr | 1 | `spec/jellyseerr.md` | Adiado: fica para o fim. Depende do Cesar (payload e segredo) |
| Textos, animações e ilustrações da Paçoca | 1 | `spec/identidade.md` | Os estados vazios e as animações (pedido confirmado, Atendido) usam placeholders (`EmptyState`, `PacocaCelebration`). Falta: os arquivos das ilustrações e das animações, que a dona vai mandar |
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
- [ ] `spec/notificacoes.md`: na caixa de entrada, as curtidas de um evento ficam num item só; o
  silêncio pode ser desligado, e mudar o silêncio vale para os avisos que ainda estão esperando.
- [ ] `spec/notificacoes.md`: o push ligado vale por celular, e posso desligar só num deles.
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
- [ ] `spec/app-e-instalacao.md`: os avisos são oferecidos uma vez, logo depois de confirmar nome e
  foto, e não aparecem se o navegador já tem resposta ou não recebe avisos (no iPhone fora da tela
  de início, aparecem para explicar a instalação).
- [ ] `spec/app-e-instalacao.md`: o link compartilhado sem login espera o login e o primeiro
  acesso; no atalho do pedido manual, o link compartilhado já vem preenchido; o link é usado uma vez.
- [ ] `spec/identidade.md`: a animação do Atendido aparece ao abrir o pedido Atendido (meu ou em
  que cliquei "Eu também quero"), uma vez por pedido em cada celular; com "reduzir movimento", a
  Paçoca fica parada.
- [ ] `spec/estatisticas.md`: cancelado não conta nos números; tempo até Atendido vai do pedido à
  primeira vez Atendido; 5 gêneros e 12 meses no perfil; minha própria curtida não conta.
- [ ] `spec/estatisticas.md`: período por dia da data do pedido; pessoa = solicitante; atendente =
  responsável; agrupando por gênero o pedido aparece em cada gênero; histórico mostra até 200 pedidos.
- [ ] `spec/estatisticas.md`: taxa de Não foi possível = Não foi possível ÷ (Atendido + Não foi
  possível); devolvidos = cashbacks (estorno de reserva não conta); 5 pedidos mais curtidos; tela "Números" para todos.
