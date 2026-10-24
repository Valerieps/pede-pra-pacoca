# Jellyseerr

A ligação do app com o Jellyseerr que roda na casa do Cesar, pelo Paçocast.

- **Entra aqui:** o Paçocast, como os status do Jellyseerr movem o pedido e a configuração do admin.
- **Não entra aqui:** as filas do atendente (`atendente.md`) e o ciclo do pedido (`pedidos.md`).
  O desenho técnico fica na ADR-016; a instalação, em [`pacocast/README.md`](../../pacocast/README.md).

## Em aberto

Nenhuma.

## Princípios

- Na casa do Cesar roda o Jellyseerr 2.7.3, em Docker. O Paçocast roda ao lado dele, também em
  Docker, com uma chave de API do Jellyseerr que o Cesar gera. *(1)*
- Nada é aberto, instalado ou tunelado na casa do Cesar para a internet: o Paçocast só faz conexões
  de saída, para o Pede e para o Jellyseerr local. *(1)*
- O app funciona por completo com a máquina de casa desligada. Paçocast desligado não trava nada:
  os pedidos esperam em Solicitado, e o atendente sempre pode marcar tudo à mão nas filas. *(1)*

## Paçocast

- A cada 30 a 60 segundos (45 por padrão), o Paçocast pergunta ao Pede o que há na fila A enviar e
  quais pedidos estão em Farejando ou Parcialmente disponível. *(1)*
- Para cada pedido de A enviar, ele cria o pedido no Jellyseerr com o ID do TMDB e o tipo. Série vai
  com todas as temporadas. *(1)*
- Para cada pedido que o Jellyseerr já tem, ele consulta o status da mídia no Jellyseerr. *(1)*
- Ele conta ao Pede o que achou, e o pedido muda de status sozinho (abaixo). A mudança fica no
  histórico do pedido com o autor "Jellyseerr". *(1)*
- O mesmo aviso repetido não muda nada de novo. Um pedido que o atendente já fechou à mão fica como
  está. *(1)*
- Se o Jellyseerr estiver fora do ar, o Paçocast tenta de novo na rodada seguinte, sem mexer no
  pedido. *(1)*
- Um pedido que espera a co-solicitante aceitar a herança (`pedidos.md`) não é enviado até alguém
  ficar com ele. *(1)*

## Status

| No Jellyseerr | No Pede |
| --- | --- |
| Pedido ainda não chegou lá | Solicitado |
| Requested ou Processing | Farejando |
| Partially Available (só séries) | Parcialmente disponível |
| Available (filme ou temporadas da série) | Cãopleto |
| Pedido recusado ou com falha, ou o Jellyseerr não aceitou criar | Não foi possível, motivo "o servidor falhou" |

- Em Parcialmente disponível, as solicitantes recebem um aviso de que já dá para começar a
  assistir. O petisco não muda (`petiscos.md`), e o feed só registra quando o pedido fica
  Cãopleto. *(1)*
- Em Cãopleto, a mídia entra em Mídias conhecidas. *(1)*
- Em Não foi possível, o petisco volta e os atendentes são avisados, com o que o Jellyseerr disse.
  *(1)*
- Um filme nunca fica Parcialmente disponível: se o Jellyseerr disser isso, ele segue em
  Farejando. *(1)*

## Configuração do admin

- Eu configuro a URL base do Jellyseerr, usada pelo botão "Abrir no Jellyseerr". *(1)*

## Fase 2

Com o Paçocast, a checagem de duplicidade passa a consultar também a biblioteca real do Jellyseerr.
*(2)*
