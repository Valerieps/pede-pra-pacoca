# Atendente

O trabalho do atendente: as filas, assumir um pedido, mudar o status e configurar os petiscos.

- **Entra aqui:** as três filas, "Eu pego esse", atualização de status, ações em lote, configurações
  de petiscos e o modo férias.
- **Não entra aqui:** quem pode ser atendente (`grupo-e-papeis.md`), o webhook e a configuração do
  Jellyseerr (`jellyseerr.md`) e as estatísticas do grupo (`estatisticas.md`).

## Em aberto

Nenhuma.

## Filas

| Fila | Contém | Ação principal |
| --- | --- | --- |
| Aguardando aprovação | Pedidos sem petisco | Aprovar ou recusar com motivo |
| A enviar | Pedidos do TMDB em Aprovado | "Abrir no Jellyseerr" e depois "Enviado" |
| Manuais | Pedidos manuais em Aprovado | Marcar Atendido ou Não foi possível |

- Posso ordenar por data do pedido, número de co-solicitantes ou data de lançamento. *(1)*
- Posso agrupar por pessoa, por tipo ou por atendente responsável. *(1)*
- Cada item mostra observação, link, co-solicitantes e quem pegou. *(1)*
- Fila vazia mostra a Paçoca cochilando (`identidade.md`). *(1)*

## Eu pego esse

- O atendente assume um pedido. Os outros atendentes veem o nome dele no item e podem assumir
  explicitamente. *(1)*

## Atualizar status

- Recusar e "Não foi possível" exigem um motivo de uma lista curta ("não encontrei", "qualidade
  ruim", "tenta mais tarde", "outro") e aceitam texto livre. *(1)*
- Atendido aceita uma nota de atendimento opcional, que as solicitantes recebem. *(1)*
- Eu posso selecionar vários itens e aplicar a mesma transição. *(1)*
- "Abrir no Jellyseerr" abre a página da mídia no Jellyseerr (URL base configurada pelo admin, mais
  tipo e ID do TMDB). *(1)*
- O atendente sempre pode marcar Atendido à mão, mesmo que o webhook não tenha chegado. *(1)*

## Petiscos

- Eu configuro os petiscos mensais globais e o número fixo de uma pessoa. *(1)*
- Eu ligo ou desligo cada critério de cashback e ajusto o limiar. *(1)*
- Eu dou cashback à mão e petiscos bônus (`petiscos.md`). *(1)*

## Modo férias

- O atendente liga o modo férias, com data de volta opcional. Todos veem "A Paçoca está dormindo" e
  continuam podendo pedir. *(1)*
- Com mais de um atendente, o aviso só aparece quando todos estão de férias. *(1)*
- A data de volta é o dia em que eu volto: as férias acabam sozinhas às 00:00 desse dia
  (America/Sao_Paulo). A data precisa ser depois de hoje. Eu posso desligar antes. *(1)*
- O aviso "A Paçoca está dormindo" mostra a data de volta mais próxima entre os atendentes, quando
  algum deu uma. *(1)*
- Só quem tem o papel de atendente tem modo férias: o admin sem esse papel não conta como atendente
  (`grupo-e-papeis.md`). Sem nenhum atendente no grupo, o aviso não aparece. *(1)*
- Quem está de férias não recebe notificações de pedidos novos nem o resumo diário. Quando todos os
  atendentes estão de férias, os pedidos que ficam em Aguardando aprovação ainda geram push. *(1)*
