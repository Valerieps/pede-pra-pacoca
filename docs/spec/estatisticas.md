# Estatísticas

Os números do grupo e de cada pessoa, numa tela só: Números do Grupo.

- **Entra aqui:** os números de cada pessoa, o histórico e as métricas do grupo.
- **Não entra aqui:** o saldo de petiscos (`petiscos.md`) e o feed (`feed.md`).

## Em aberto

Nenhuma.

## Números do Grupo

- "Números do Grupo" abre filtrada por mim. Eu escolho outra pessoa, ou o grupo todo, no filtro de
  pessoa, que fica sempre à vista. *(1)*
- Com uma pessoa escolhida, além dos números filtrados eu vejo os dela de sempre: cashbacks
  recebidos, curtidas recebidas e pedidos por mês dos últimos 12 meses, com os meses sem pedido. *(1)*
- As curtidas recebidas são as dos outros nos eventos dela no feed; a dela própria não conta. *(1)*
- Filtros: pessoa, período, tipo, gênero, status, origem (TMDB ou manual) e atendente. *(1)*
- Ordenação e agrupamento pelos mesmos campos. *(1)*
- O período é por dia, no horário de São Paulo, e conta pela data do pedido. Pessoa é a
  solicitante; atendente é o responsável pelo pedido. *(1)*
- Sem filtro de status, os cancelados ficam de fora; escolhendo Cancelado, eles aparecem. *(1)*
- Agrupando por gênero, um pedido com dois gêneros aparece nos dois grupos; o pedido sem gênero fica
  em "Sem gênero". *(1)*
- O histórico mostra até 200 pedidos; os números e as contagens dos grupos valem para todos. *(1)*
  Por quê: o servidor tem pouco tempo de processamento por consulta (ADR-006).
- Métricas: pedidos, atendidos, pedidos por pessoa, pedidos por gênero, tempo médio até Atendido,
  taxa de Não foi possível, pedidos por atendente, petiscos consumidos e devolvidos, pedidos mais
  curtidos. *(1)*
- O tempo até Atendido vai do pedido até a primeira vez
  que ele virou Atendido. *(1)*
- Pedidos por gênero mostra todos os gêneros, do mais pedido ao menos; como no agrupamento, o
  pedido com dois gêneros conta nos dois e o sem gênero fica em "Sem gênero". *(1)*
- A taxa de Não foi possível é sobre os pedidos encerrados pelo atendente: Não foi possível ÷
  (Atendido + Não foi possível). *(1)*
- Petiscos consumidos são os debitados pelos pedidos; devolvidos são os cashbacks desses pedidos. O
  estorno de uma reserva (pedido cancelado ou recusado) não conta: o petisco nem chegou a ser gasto. *(1)*
- Pedidos mais curtidos: os 5 com mais curtidas somando todos os eventos do pedido no feed. *(1)*
- Números do Grupo é visível para todos. Na lista de Gerenciar membros, o admin abre os números
  de qualquer um. *(1)*
