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
| Configuração do Jellyseerr pelo admin | 1 | `spec/jellyseerr.md` | Falta a tela da URL base. "Abrir no Jellyseerr" já aparece nas filas quando a chave `jellyseerrBaseUrl` existe em `config` |
| Textos, animações e ilustrações da Paçoca | 1 | `spec/identidade.md` | Os estados vazios e as animações (pedido confirmado, Cãopleto) usam placeholders (`EmptyState`, `PacocaCelebration`). Falta: os arquivos das ilustrações e das animações, que o Cesar vai mandar seguindo o [brief](rascunhos/brief-artes-pacoca.md) e a ADR-013 |
| Sincronizar a biblioteca do Plex com o Catálogo | 1 | `spec/catalogo.md` | A tela, os problemas e a tabela `catalog_items` existem (ADR-018); falta quem a preenche, com as notas. Até lá o catálogo mostra os pedidos Cãopletos, com as notas que a página da mídia busca (ADR-019). Ver o "Em aberto" do spec |
| Duplicidade consultando a biblioteca do Jellyseerr | 2 | `spec/jellyseerr.md` | Só orientação de desenho |

## O código ainda não segue o spec

- Curtir ainda não existe no detalhe do pedido (o feed já tem todos os eventos).
- Sem conexão, o app mostra o que já estava na tela, mas não guarda nada entre aberturas.

## Adiado

- Login com Apple — exige conta paga de desenvolvedor; fica fora enquanto o app não estiver nas lojas.
- App offline — o app só funciona com internet.
- Cards de carregamento nas outras telas — hoje só o feed, Meus pedidos, a caixa de entrada, as filas e o detalhe do pedido têm; Petiscos, números, membros, convites e ajustes ficam em branco até carregar.

## Revisar as lacunas que o agente decidiu

- [ ] `spec/identidade.md`: o petisco cai no contador só no cashback; bônus e a renovação do mês não têm animação.
- [ ] `spec/petiscos.md`: o cashback à mão lista os 50 pedidos Cãopletos mais recentes elegíveis. (troque 10)
- [ ] `spec/estatisticas.md`: os "Últimos 30 dias" contam para trás a partir de agora; card sem ninguém no período mostra uma frase da Paçoca; em "Todo mundo também quer", pedidos cancelados ficam de fora e o pôster abre o pedido mais recente da mídia; em "Farejando mídias" nos últimos 30 dias, só conta o tempo farejado dentro dos 30 dias.
- [ ] `spec/jellyseerr.md`: Parcialmente disponível avisa as solicitantes (aviso novo, que dá para desligar) e não entra no feed; o Paçocast roda a cada 45 segundos; um pedido que o Jellyseerr recusa ao criar vira Não foi possível na hora; Cãopleto continua debitando o petisco que já saiu do saldo no pedido.
- [ ] `spec/catalogo.md`: antes da sincronização o catálogo mostra os pedidos Cãopletos e Parcialmente disponíveis; as notas buscadas valem 30 dias; o card abre o pedido mais recente da mídia e a mídia sem pedido não abre nada; o motivo é um só, "Episódio faltando" só aparece em séries e o texto é obrigatório só em Outro; um aberto por pessoa por mídia; os problemas ficam em Gerenciar pedidos, abaixo das filas; o atendente pode desligar o aviso de problema reportado e quem reportou, o de resolvido; o filtro de período tem as décadas de 80 a 2020 e "até 1979"; agrupar por gênero põe a mídia em cada um dos seus gêneros; na grade cabem três cartazes por linha no celular e quatro a partir de 600px.
- [ ] `spec/app-e-instalacao.md`: o modo férias foi para Gerenciar pedidos; Ajustes do grupo (só o admin) tem só o download dos dados.
- [ ] `spec/notificacoes.md`: a mídia travada conta desde a entrada no status atual; a soneca vale para o pedido (todos os atendentes), e o dia escolhido vai até um ano; o aviso pode ser desligado nas preferências e chega também ao atendente de férias.


