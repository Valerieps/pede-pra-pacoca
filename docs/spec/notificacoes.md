# Notificações

Os avisos que eu recebo, quando e como desligar.

- **Entra aqui:** os gatilhos, a caixa de entrada, o resumo diário e o horário de silêncio.
- **Não entra aqui:** o texto exato de cada aviso (`identidade.md`) e como instalar o app para
  receber push (`app-e-instalacao.md`).

## Em aberto

Nenhuma.

## Como funcionam

- Toda notificação é um push e aparece também numa caixa de entrada dentro do app. *(1)*
- A caixa de entrada guarda meus últimos 100 avisos. Tocar num aviso abre a tela dele e marca como
  lido; eu também posso marcar todos como lidos. *(1)*
- Cada tipo pode ser desligado por mim. Desligado, o aviso não chega de jeito nenhum: nem push, nem
  caixa de entrada. *(1)*
- Os textos seguem a voz da Paçoca. *(1)*
- Eu ligo o push em cada celular numa tela que explica os avisos antes de o navegador pedir a
  permissão (no iPhone, também que é preciso instalar o app, ver `app-e-instalacao.md`). Também
  posso desligar o push só naquele celular. *(1)*

## Gatilhos

| Gatilho | Quem recebe | Padrão |
| --- | --- | --- |
| Pedido novo (aprovado automático) | Atendentes | Resumo diário |
| Pedido aguardando aprovação | Atendentes | Imediato |
| Pedido aprovado | Solicitante | Imediato |
| Recusado ou Não foi possível, com motivo | Solicitante e co-solicitantes | Imediato |
| Parcialmente disponível (série com os primeiros episódios) | Solicitante e co-solicitantes | Imediato |
| Cãopleto, com nota de atendimento | Solicitante e co-solicitantes | Imediato |
| Alguém clicou "Eu também quero" no meu pedido | Solicitante | Imediato |
| Curtidas no meu evento | Autora do evento | Agrupado |
| Cashback ou bônus recebido | Quem recebeu | Imediato |
| Petisco vence em 7 dias | Dona do petisco | Imediato |
| Petiscos mensais renovados | Quem tem petisco mensal | Desligado |
| Obrigada, Paçoca | Atendente que atendeu | Imediato |
| Falha do Jellyseerr, avisada pelo Paçocast | Atendentes | Imediato |
| Oferta de herdar um pedido cancelado | Co-solicitante | Imediato |
| Problema reportado no catálogo (`catalogo.md`) | Atendentes | Imediato |
| Problema que eu reportei foi resolvido | Quem reportou | Imediato |

- Curtidas chegam agrupadas ("3 pessoas curtiram seu pedido"), no máximo uma notificação por evento a
  cada hora. *(1)*
  - A primeira curtida avisa na hora ("Ana curtiu seu pedido"). As que chegam dentro da hora saem
    juntas quando a hora fecha. *(1)*
  - Na caixa de entrada fica um item só por evento, com todo mundo que curtiu. *(1)*
- Cada atendente escolhe entre imediato e resumo diário para pedidos novos, e o horário do resumo.
  *(1)*
  - O padrão é o resumo, às 20:00. Ele é um push só e um item só na caixa de entrada ("3 pedidos
    novos hoje: X, Y e Z"). Dia sem pedido novo não manda nada. *(1)*
- Eu posso definir um horário de silêncio. O padrão é 23:00 a 08:00, e o que se acumulou sai ao fim
  do silêncio. *(1)*
  - O silêncio segura só o push, de todos os tipos: a caixa de entrada recebe na hora. *(1)*
  - O resumo diário que cai no silêncio sai quando ele acaba. *(1)*
  - Eu posso desligar o silêncio. Mudar o silêncio vale também para os avisos que ainda estão
    esperando. *(1)*
- O atendente em modo férias segue as regras de `atendente.md`. *(1)*
- O aviso de petiscos renovados sai uma vez por mês, no dia 1, com quantos petiscos mensais eu tenho.
  Quem não gasta petisco (atendente) ou tem 0 por mês não recebe. *(1)*
