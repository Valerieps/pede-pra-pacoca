# Estatísticas

Meu perfil e os números do grupo.

- **Entra aqui:** o perfil de cada membro, o histórico e as métricas do grupo.
- **Não entra aqui:** o saldo de petiscos (`petiscos.md`) e o feed (`feed.md`).

## Em aberto

Nenhuma.

## Perfil

- Eu vejo meu total de pedidos, atendidos, tempo médio até Atendido, gêneros mais pedidos, pedidos
  por mês, cashbacks recebidos e curtidas recebidas. *(1)*
- O perfil de qualquer membro é visível para todos. *(1)*
- Pedido cancelado não conta nos números. *(1)*
- O tempo até Atendido vai do pedido até a primeira vez que ele virou Atendido. *(1)*
- Mostro os 5 gêneros mais pedidos e os pedidos por mês dos últimos 12 meses, com os meses sem
  pedido. *(1)*
- As curtidas recebidas são as dos outros nos meus eventos do feed; a minha própria não conta. *(1)*

## Histórico e estatísticas do grupo

- Filtros: pessoa, período, tipo, gênero, status, origem (TMDB ou manual) e atendente. *(1)*
- Ordenação e agrupamento pelos mesmos campos. *(1)*
- O período é por dia, no horário de São Paulo, e conta pela data do pedido. Pessoa é a
  solicitante; atendente é o responsável pelo pedido. *(1)*
- Sem filtro de status, os cancelados ficam de fora; escolhendo Cancelado, eles aparecem. *(1)*
- Agrupando por gênero, um pedido com dois gêneros aparece nos dois grupos; o pedido sem gênero fica
  em "Sem gênero". *(1)*
- O histórico mostra até 200 pedidos; os números e as contagens dos grupos valem para todos. *(1)*
  Por quê: o servidor tem pouco tempo de processamento por consulta (ADR-006).
- Métricas: pedidos por pessoa, tempo médio até Atendido, taxa de Não foi possível, pedidos por
  atendente, petiscos consumidos e devolvidos, pedidos mais curtidos. *(1)*
- A taxa de Não foi possível é sobre os pedidos encerrados pelo atendente: Não foi possível ÷
  (Atendido + Não foi possível). *(1)*
- Petiscos consumidos são os debitados pelos pedidos; devolvidos são os cashbacks desses pedidos. O
  estorno de uma reserva (pedido cancelado ou recusado) não conta: o petisco nem chegou a ser gasto. *(1)*
- Pedidos mais curtidos: os 5 com mais curtidas somando todos os eventos do pedido no feed. *(1)*
- Os números do grupo ficam em "Números", visíveis para todos. Pela lista de Membros eu abro o
  perfil de qualquer um. *(1)*
