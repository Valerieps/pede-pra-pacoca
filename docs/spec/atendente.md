# Atendente

O trabalho do atendente: as filas, assumir um pedido, mudar o status e configurar os petiscos.

- **Entra aqui:** as três filas, "Eu pego esse", atualização de status, ações em lote, configurações
  de petiscos e o modo férias.
- **Não entra aqui:** quem pode ser atendente (`grupo-e-papeis.md`), o Paçocast e a configuração do
  Jellyseerr (`jellyseerr.md`) e as estatísticas do grupo (`estatisticas.md`).

## Em aberto

Nenhuma.

## Filas

| Fila | Contém | Ação principal |
| --- | --- | --- |
| Aguardando aprovação | Pedidos sem petisco | Aprovar ou recusar com motivo |
| A enviar | Pedidos do TMDB em Solicitado | Nada: o Paçocast manda ao Jellyseerr. À mão, "Abrir no Jellyseerr" e depois "Enviado" |
| Farejando | Pedidos do TMDB em Farejando ou Parcialmente disponível | Nada: o Paçocast acompanha. À mão, marcar Cãopleto ou Não foi possível |
| Manuais | Pedidos manuais em Solicitado | Marcar Cãopleto ou Não foi possível |

- Posso ordenar por data do pedido, número de co-solicitantes ou data de lançamento. *(1)*
- Posso agrupar por pessoa, por tipo ou por atendente responsável. *(1)*
- Cada item mostra observação, link, co-solicitantes e quem pegou. *(1)*
- Fila vazia mostra a Paçoca cochilando (`identidade.md`). *(1)*
- O Paçocast (`jellyseerr.md`) esvazia A enviar e fecha os pedidos de Farejando sozinho. As ações
  à mão continuam lá para quando ele estiver desligado ou o Jellyseerr não achar a mídia. *(1)*
- Em A enviar, eu também posso marcar Cãopleto ou Não foi possível direto, sem passar por
  "Enviado". *(1)*
- Enquanto a Paçoca oferece um pedido cancelado a quem também quer (`pedidos.md`), ele sai das filas
  e eu não mexo nele; ele volta quando alguém fica com ele. *(1)*
  Por quê: ainda não se sabe de quem é o pedido nem qual petisco ele gasta.

## Eu pego esse

- O atendente assume um pedido. Os outros atendentes veem o nome dele no item e podem assumir
  explicitamente. *(1)*
- Assumir um pedido que outro atendente pegou pede confirmação. Assumir fica no histórico do
  pedido. *(1)*

## Atualizar status

- Recusar e "Não foi possível" exigem um motivo de uma lista curta ("não encontrei", "qualidade
  ruim", "tenta mais tarde", "outro") e aceitam texto livre. *(1)*
  - "Outro" exige o texto. O texto tem até 200 caracteres. *(1)*
  - As solicitantes veem o motivo no pedido, e o texto vai junto: "qualidade ruim (só tem
    câmera)". *(1)*
- Cãopleto aceita uma nota de atendimento opcional, que as solicitantes recebem. *(1)*
  - A nota tem até 500 caracteres e aparece também no pedido. *(1)*
- Eu posso selecionar vários itens e aplicar a mesma transição. *(1)*
  - Até 50 de uma vez. Um pedido que mudou enquanto isso fica como estava, e o app me diz quantos
    ficaram. *(1)*
- "Abrir no Jellyseerr" abre a página da mídia no Jellyseerr (URL base configurada pelo admin, mais
  tipo e ID do TMDB). *(1)*
  - O botão só aparece em A enviar, e só quando a URL base existe. *(1)*
- O atendente sempre pode marcar Cãopleto à mão, mesmo que o Paçocast não tenha avisado. *(1)*

## Petiscos

- Eu configuro os petiscos mensais globais e o número fixo de uma pessoa. *(1)*
- Eu ligo ou desligo cada critério de cashback e ajusto o limiar. *(1)*
- Eu dou cashback à mão e petiscos bônus (`petiscos.md`). *(1)*

## Modo férias

- O atendente liga o modo férias em Gerenciar pedidos, com data de volta opcional. Todos veem "A Paçoca está dormindo" e
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
