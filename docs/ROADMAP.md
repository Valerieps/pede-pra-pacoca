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
| Instalar o Paçocast na casa do Cesar | 1 | `spec/jellyseerr.md` | O código está pronto; falta o segredo `PACOCAST_TOKEN` no Worker e o contêiner no Docker do Cesar ([passo a passo](../pacocast/README.md)) |
| Textos, animações e ilustrações da Paçoca | 1 | `spec/identidade.md` | Os estados vazios e as animações (pedido confirmado, Cãopleto) usam placeholders (`EmptyState`, `PacocaCelebration`). Falta: os arquivos das ilustrações e das animações, que o Cesar vai mandar seguindo o [brief](rascunhos/brief-artes-pacoca.md) e a ADR-013 |
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
- [ ] `spec/estatisticas.md`: em Números do Grupo, "Limpar" limpa os filtros mas mantém a pessoa escolhida; "Cãopletos" entrou nas métricas; com uma pessoa escolhida, os cashbacks, as curtidas e os pedidos por mês dela não seguem os outros filtros.
- [ ] `spec/jellyseerr.md`: Parcialmente disponível avisa as solicitantes (aviso novo, que dá para desligar) e não entra no feed; o Paçocast roda a cada 45 segundos; um pedido que o Jellyseerr recusa ao criar vira Não foi possível na hora; Cãopleto continua debitando o petisco que já saiu do saldo no pedido.
- [ ] `spec/app-e-instalacao.md`: o modo férias foi para Gerenciar pedidos; Ajustes do grupo (só o admin) tem só o download dos dados.


