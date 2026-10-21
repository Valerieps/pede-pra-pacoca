# Notificações

Os avisos que eu recebo, quando e como desligar.

- **Entra aqui:** os gatilhos, a caixa de entrada, o resumo diário e o horário de silêncio.
- **Não entra aqui:** o texto exato de cada aviso (`identidade.md`) e como instalar o app para
  receber push (`app-e-instalacao.md`).

## Em aberto

Nenhuma.

## Como funcionam

- Toda notificação é um push e aparece também numa caixa de entrada dentro do app. *(1)*
- Cada tipo pode ser desligado por mim. *(1)*
- Os textos seguem a voz da Paçoca. *(1)*

## Gatilhos

| Gatilho | Quem recebe | Padrão |
| --- | --- | --- |
| Pedido novo (aprovado automático) | Atendentes | Resumo diário |
| Pedido aguardando aprovação | Atendentes | Imediato |
| Pedido aprovado | Solicitante | Imediato |
| Recusado ou Não foi possível, com motivo | Solicitante e co-solicitantes | Imediato |
| Atendido, com nota de atendimento | Solicitante e co-solicitantes | Imediato |
| Alguém clicou "Eu também quero" no meu pedido | Solicitante | Imediato |
| Curtidas no meu evento | Autora do evento | Agrupado |
| Cashback ou bônus recebido | Quem recebeu | Imediato |
| Petisco vence em 7 dias | Dona do petisco | Imediato |
| Petiscos mensais renovados | Todos | Desligado |
| Obrigada, Paçoca | Atendente que atendeu | Imediato |
| Falha do servidor no webhook | Atendentes | Imediato |
| Oferta de herdar um pedido cancelado | Co-solicitante | Imediato |

- Curtidas chegam agrupadas ("3 pessoas curtiram seu pedido"), no máximo uma notificação por evento a
  cada hora. *(1)*
- Cada atendente escolhe entre imediato e resumo diário para pedidos novos, e o horário do resumo.
  *(1)*
- Eu posso definir um horário de silêncio. O padrão é 23:00 a 08:00, e o que se acumulou sai ao fim
  do silêncio. *(1)*
- O atendente em modo férias segue as regras de `atendente.md`. *(1)*
