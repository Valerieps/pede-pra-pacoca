# Pedidos

Como eu peço um filme ou uma série e o que acontece com o pedido até ele ser atendido.

- **Entra aqui:** pedir por link, por busca e manual, o ciclo de vida, duplicidade, "Eu também quero",
  cancelar e dar retorno.
- **Não entra aqui:** o saldo e as regras dos petiscos (`petiscos.md`), as filas do atendente
  (`atendente.md`), o webhook (`jellyseerr.md`) e os textos da Paçoca (`identidade.md`).

## Em aberto

Nenhuma.

## Ciclo de vida

O pedido é a entidade central. Estados: Aguardando aprovação, Aprovado, No Jellyseerr, Atendido,
Recusado, Não foi possível e Cancelado. "Pedido criado" é só o ponto de partida.

- Ao criar o pedido, se a pessoa tem petisco disponível ou é atendente, ele vai direto para
  Aprovado. Sem petisco, vai para Aguardando aprovação. *(1)*
- Aguardando aprovação → Aprovado (o atendente aprova) ou → Recusado (o atendente recusa, com
  motivo). *(1)*
- Aprovado → No Jellyseerr quando o atendente marca "Enviado". *(1)*
- No Jellyseerr → Atendido quando o Jellyseerr avisa que a mídia está disponível, ou quando o
  atendente marca à mão. *(1)*
- No Jellyseerr → Não foi possível quando o Jellyseerr avisa de falha, ou quando o atendente marca à
  mão, com motivo. *(1)*
- Pedido manual: depois de Aprovado, o atendente o marca direto como Atendido ou Não foi possível,
  sem passar pelo Jellyseerr. *(1)*
- Cancelado: só a solicitante cancela, e só enquanto o pedido está em Aguardando aprovação ou
  Aprovado, ou seja, antes de No Jellyseerr. *(1)*
- Cancelado, Recusado e Não foi possível devolvem o petisco reservado (`petiscos.md`). *(1)*
- Um pedido que vira Cancelado sai do feed, com os eventos dele (`feed.md`). *(1)*
  Por quê: Cancelado é informação da pessoa, não do grupo.
- Cada transição registra a data e o autor. Quando aplicável, ela gera um evento no feed
  (`feed.md`). *(1)*

## Pedir por link compartilhado

1. Eu compartilho (Android) ou colo (qualquer aparelho) um link do IMDb ou do TMDB. *(1)*
2. O app extrai o ID. Um ID do IMDb (tt…) é convertido para o do TMDB pela busca por ID externo do
   TMDB. *(1)*
3. A tela de confirmação mostra pôster, título, ano, tipo, o selo "Ainda não lançado" se for o caso,
   meu saldo de petiscos e um campo de observação. *(1)*
4. As regras de duplicidade e de falta de petisco são aplicadas antes de eu confirmar. *(1)*
5. Eu confirmo com "Pedir pra Paçoca". *(1)*

## Pedir pela busca

- Eu digito no campo de busca e posso filtrar por Filme, Série ou ambos. *(1)*
- O app consulta o TMDB e mostra um carrossel com pôster, título, ano e tipo. *(1)*
- Cada card indica se a mídia já está pedida, atendida ou conhecida no servidor. *(1)*
- Ao escolher, segue a mesma confirmação do pedido por link. *(1)*
- Sem resultados, o app oferece o pedido manual com o texto da busca já preenchido. *(1)*

## Pedido manual

- Eu preencho título (obrigatório), tipo, observação e um link opcional (qualquer URL). *(1)*
- O pedido segue o ciclo normal e reserva petisco como os outros. *(1)*
- No feed e nas listas, o pedido manual aparece com um card ilustrado da Paçoca no lugar do pôster.
  *(1)*

## Duplicidade e séries

- Antes de criar um pedido do TMDB, o app procura o ID nos pedidos ativos, nos atendidos e nas
  Mídias conhecidas. *(1)*
  - Pedido ativo encontrado: o botão vira "Eu também quero".
  - Atendido ou Mídia conhecida: o app avisa que já está no servidor e oferece "Pedir de novo", que
    cria um pedido novo e consome petisco.
- Pedido manual com o mesmo link exato de outro pedido manual entra na mesma checagem. *(1)*
- Série é sempre pedida completa. Temporadas novas são com o Sonarr, fora do app. *(1)*
- Mídia com lançamento futuro no TMDB recebe o selo "Ainda não lançado". Não é um estado: o pedido
  segue o fluxo normal. *(1)*

## Eu também quero

- Em qualquer pedido ativo de outra pessoa, eu clico "Eu também quero" e viro co-solicitante. Posso
  desfazer enquanto o pedido estiver ativo. *(1)*
- Co-solicitantes recebem as mesmas notificações de status da solicitante original. *(1)*
- "Eu também quero" nunca consome petisco. *(1)*
- Se eu desfaço, meu "também quer" sai do feed, com as curtidas (`feed.md`). *(1)*

## Meus pedidos

- Eu vejo meus pedidos ativos com status, atendente responsável e data. Abaixo deles ficam os já
  encerrados. Os pedidos em que cliquei "Eu também quero" aparecem junto. *(1)*
- Posso editar a observação e cancelar enquanto o status for Aguardando aprovação ou Aprovado. *(1)*
- Se eu cancelo um pedido que tem co-solicitantes, o app oferece o pedido à co-solicitante mais
  antiga: ela confirma e diz se aceita gastar um petisco dela. Se aceitar, ela vira a solicitante.
  Se recusar (ou não responder em 5 dias), a oferta passa à seguinte. Se ninguém aceitar, o pedido
  vira Cancelado para todos. *(1)*
- Se quem aceitou não tem petisco, o pedido vai para Aguardando aprovação. *(1)*
- Se quem aceitou tem petisco (ou é atendente), o pedido vai ou fica em Aprovado, mesmo que estivesse
  em Aguardando aprovação. *(1)*
- Quando alguém aceita, eu saio do pedido por completo: não viro co-solicitante. *(1)*
- Se a co-solicitante com a oferta desfaz o "Eu também quero", a oferta passa à seguinte. *(1)*
- Enquanto a oferta está aberta, o pedido fica no mesmo estado e o atendente pode seguir com ele. Se
  ele já passou de Aprovado quando ninguém aceita, ele não vira Cancelado: segue sem petisco de
  ninguém, e as co-solicitantes recebem do mesmo jeito. *(1)*

## Dar retorno

- Em pedidos Atendidos, qualquer membro pode marcar "Assisti", dar uma nota de 1 a 5 e mandar um
  "Obrigada, Paçoca" ao atendente que atendeu. Cada ação gera um evento no feed. *(1)*
- O atendente que atendeu é o responsável do "Eu pego esse"; sem responsável, é quem marcou
  "Enviado". Se o pedido foi direto para Atendido, é quem marcou Atendido. *(1)*
- Eu marco "Assisti" e dou a nota uma vez por pedido: o feed mostra um evento só, e se eu mudo a
  nota depois, o mesmo evento mostra a nota nova. A nota é opcional; tocar na mesma nota tira a nota.
  *(1)*
- Eu mando o "Obrigada, Paçoca" uma vez por pedido. *(1)*
