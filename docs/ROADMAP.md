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
| Notificações: falha do webhook | 1 | `spec/notificacoes.md` | Todos os outros gatilhos estão ligados. Falta chamar `notify` para a falha do webhook (com o Jellyseerr) |
| Webhook e configuração do Jellyseerr | 1 | `spec/jellyseerr.md` | Adiado: fica para o fim. Depende do Cesar (payload e segredo) |
| Textos, animações e ilustrações da Paçoca | 1 | `spec/identidade.md` | Os estados vazios e as animações (pedido confirmado, Atendido) usam placeholders (`EmptyState`, `PacocaCelebration`). Falta: os arquivos das ilustrações e das animações, que o Cesar vai mandar seguindo o [brief](rascunhos/brief-artes-pacoca.md) e a ADR-013 |
| Agente doméstico que cria pedidos no Jellyseerr | 2 | `spec/jellyseerr.md` | Só orientação de desenho |

## O código ainda não segue o spec

- Curtir ainda não existe no detalhe do pedido (o feed já tem todos os eventos).
- Sem conexão, o app mostra o que já estava na tela, mas não guarda nada entre aberturas.

## Adiado

- Conexão com o Jellyseerr (webhook e a tela da URL base) — a dona deixou para depois; até lá, o atendente marca os status à mão. "Abrir no Jellyseerr" já aparece nas filas quando a chave `jellyseerrBaseUrl` existe em `config`.
- Login com Apple — exige conta paga de desenvolvedor; fica fora enquanto o app não estiver nas lojas.
- App offline — o app só funciona com internet.
- Cards de carregamento nas outras telas — hoje só o feed, Meus pedidos, a caixa de entrada, as filas e o detalhe do pedido têm; Petiscos, números, membros, convites e ajustes ficam em branco até carregar.

## Revisar as lacunas que o agente decidiu

- [ ] `spec/identidade.md`: o petisco cai no contador só no cashback; bônus e a renovação do mês não têm animação.
- [ ] `spec/petiscos.md`: o cashback à mão lista os 50 pedidos Atendidos mais recentes elegíveis. (troque 10)
- [ ] `spec/estatisticas.md`: em Números do Grupo, "Limpar" limpa os filtros mas mantém a pessoa escolhida; "Atendidos" entrou nas métricas; com uma pessoa escolhida, os cashbacks, as curtidas e os pedidos por mês dela não seguem os outros filtros.
- [ ] `spec/app-e-instalacao.md`: o modo férias foi para Gerenciar pedidos; Ajustes do grupo (só o admin) tem só o download dos dados.


