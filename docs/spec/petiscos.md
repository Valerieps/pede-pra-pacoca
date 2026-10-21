# Petiscos

O crédito de pedidos: quanto eu tenho, como gasto, quando vence e como volta como cashback.

- **Entra aqui:** o saldo, a reserva, o débito, a validade, o cashback e o bônus.
- **Não entra aqui:** o ciclo do pedido em si (`pedidos.md`) e a tela de configuração do atendente
  (`atendente.md`).

## Em aberto

Nenhuma.

## Tipos e validade

Cada solicitante recebe 3 petiscos por mês (o atendente configura). Com petisco, o pedido é
aprovado automaticamente; sem petisco, espera o atendente.

| Tipo | Origem | Validade |
| --- | --- | --- |
| Mensal | Crédito automático no dia 1, 00:00 (America/Sao_Paulo) | Até o fim do mês. Não acumula de um mês para o outro |
| Bônus | Concedido à mão pelo atendente | 90 dias desde a concessão |
| Cashback | Devolvido por critério automático ou pelo atendente | 90 dias desde a concessão |

- O saldo é um registro imutável de movimentos (crédito, reserva, débito, estorno). Ele nunca é um
  número editado direto. *(1)*
- Quem entra no grupo no meio do mês recebe na hora os petiscos mensais do mês inteiro. *(1)*
- Mudar o número mensal (o global ou o fixo de uma pessoa) vale na hora, para o mês corrente: os
  petiscos mensais disponíveis passam a ser o novo número menos os que a pessoa já usou no mês. Se
  era 5, ela já usou 2 e o número muda para 9, ela fica com 7. Se ela já usou mais do que o novo
  número, fica com 0: o saldo nunca é negativo. Contam como usados os petiscos mensais do mês
  reservados em pedidos em andamento e os já debitados. *(1)*
- O número de petiscos mensais é global (padrão 3). O atendente pode definir, para uma pessoa, um
  número fixo no lugar do global. *(1)*
- O número mensal, o global e o de uma pessoa, vai de 0 a 99. Apagar o número fixo de uma pessoa a
  devolve ao número do grupo. *(1)*

## Gastar

- Ao criar o pedido, o petisco fica reservado. Ele é debitado quando o pedido vira Atendido e
  estornado quando vira Cancelado, Recusado ou Não foi possível. Vale para pedidos do TMDB e
  manuais. *(1)*
- O consumo é "vence primeiro, sai primeiro": o app usa o petisco com a validade mais próxima. *(1)*
- Um petisco reservado é debitado mesmo que a validade passe enquanto o pedido está em andamento.
  *(1)*
- Pedidos feitos por atendentes não reservam petisco e vão direto para Aprovado. *(1)*
- Sem petisco, o pedido vai para Aguardando aprovação e o app me avisa antes de eu enviar. Se o
  atendente aprovar, esse pedido não consome petisco. *(1)*
- "Pedir de novo" uma mídia atendida cria um pedido novo e segue as regras normais. *(1)*

## Cashback

- O cashback automático é avaliado quando o pedido vira Atendido. O atendente liga ou desliga cada
  critério. *(1)*
- Critério 1: o pedido tem pelo menos 2 co-solicitantes ("Eu também quero"), sem contar a
  solicitante original. O limiar é configurável (padrão 2). *(1)*
- Os critérios são uma lista extensível de regras, para entrarem outros no futuro (por exemplo, o
  pedido mais curtido do mês). *(1)*
- Cada pedido gera no máximo 1 cashback, mesmo que atenda a mais de um critério. *(1)*
- O cashback vai para a solicitante original e só vale para pedidos que debitaram petisco. *(1)*
- O atendente pode dar cashback à mão em qualquer pedido Atendido que debitou petisco, com motivo
  opcional, respeitando o limite de 1 por pedido. *(1)*
- O atendente pode dar petiscos bônus a qualquer pessoa, com motivo opcional. *(1)*
- Cada vez, o atendente dá de 1 a 10 petiscos bônus. Cada um é um petisco à parte, com os mesmos 90
  dias. O motivo tem até 200 caracteres. *(1)*
- O bônus não aparece no feed; o cashback aparece (`feed.md`). *(1)*
- O limiar de co-solicitantes vai de 1 a 20. *(1)*
- Para o cashback à mão, o atendente vê os 50 pedidos Atendidos mais recentes que debitaram petisco e
  ainda não ganharam cashback. *(1)*
- Curtida não conta para o cashback. *(1)*

## O que eu vejo

- Meus petiscos mensais restantes, a data da próxima renovação e cada bônus ou cashback com a
  validade. *(1)*
- O extrato dos movimentos, com data, tipo e pedido, do mais novo ao mais antigo. Cada um vê só o
  próprio extrato. *(1)*
- Aviso 7 dias antes de um petisco vencer (`notificacoes.md`). *(1)*
- O aviso vale para bônus e cashback ainda não usados, e sai uma vez só por petisco. Quando vários
  vencem na mesma semana, chega um aviso só, com quantos são e a validade mais próxima. *(1)*
  Por quê: o petisco mensal não precisa de aviso, ele renova todo dia 1.
