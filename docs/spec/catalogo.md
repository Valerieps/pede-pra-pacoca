# Catálogo

Tudo o que já está na biblioteca do Cesar (o Plex), para eu achar o que assistir e avisar quando
alguma mídia está com problema.

- **Entra aqui:** a tela Catálogo (busca, filtros, ordem, lista e grade), o card da mídia, reportar
  um problema e o que o atendente faz com ele.
- **Não entra aqui:** pedir uma mídia (`pedidos.md`), os status do Jellyseerr (`jellyseerr.md`) e
  como os avisos chegam (`notificacoes.md`).

## Em aberto

- [ ] Como a biblioteca do Plex chega ao app: o Paçocast lê o Plex (ou o Jellyseerr) e manda a
  lista, de quanto em quanto tempo, e de onde vêm as notas (IMDb, TMDB, Rotten Tomatoes).

## O que aparece

- O Catálogo mostra tudo o que está na biblioteca do Plex, e não só o que foi pedido pelo app.
  *(1)*
- Enquanto a biblioteca não é sincronizada, o Catálogo mostra as mídias que o app trouxe: os
  pedidos do TMDB em Cãopleto ou Parcialmente disponível, com as notas que a página da mídia
  busca (IMDb, TMDB e Rotten Tomatoes). Uma mídia sem nota guardada, ou com nota de mais de 30
  dias, busca de novo quando abro o Catálogo. *(1)*
  Por quê: a tela já serve para alguma coisa antes da sincronização.
- Catálogo vazio mostra a Paçoca dizendo que já já traz a biblioteca toda. *(1)*

## Achar uma mídia

- Eu busco pelo título. Maiúsculas e acentos não importam ("acao" acha "Ação"). *(1)*
- Eu filtro por tipo: Tudo, Filmes ou Séries. *(1)*
- Em Filtros eu escolho, em múltipla escolha, gêneros e períodos de lançamento (até 1979, 80, 90,
  2000, 2010 e 2020). Uma mídia aparece se tiver qualquer um dos gêneros e cair em qualquer um dos
  períodos escolhidos. Mídia sem ano some quando escolho um período. *(1)*
- Eu ordeno por A–Z, nota do IMDb (maior primeiro) ou lançamento (mais novos ou mais antigos
  primeiro). Mídia sem nota ou sem ano vai para o fim; empate fica em ordem alfabética. *(1)*
- Eu posso agrupar por gênero. Os grupos ficam em ordem alfabética, cada um com quantas mídias tem;
  uma mídia com dois gêneros aparece nos dois; as sem gênero ficam por último. *(1)*
- O botão Filtros mostra quantas escolhas estão ligadas ("Filtros · 2"). "Limpar" volta a ordem e
  tira gêneros, períodos e o agrupamento; a busca e o tipo ficam. *(1)*
- Acima da lista fica quantas mídias aparecem com a busca e os filtros ("128 títulos"). *(1)*

## Lista e grade

- Eu alterno entre lista e grade. *(1)*
- Na lista, cada card tem o cartaz à esquerda e o título como no card do feed, embaixo o tipo, o
  ano e, nas séries, as temporadas, e a linha de notas: IMDb, TMDB e Rotten Tomatoes. Nota
  desconhecida não aparece. *(1)*
- Na grade ficam só os cartazes, três por linha no celular, com a nota do IMDb no canto. Tocar no
  cartaz abre o card da lista. *(1)*
- Tocar no card abre a página da mídia, igual no feed: o pedido Cãopleto ou Parcialmente disponível
  mais recente dela. O caminho de volta no topo dessa página leva ao Catálogo. Mídia que nenhum
  pedido trouxe não abre nada. *(1)*

## Reportar um problema

- No canto superior direito do card fica um triângulo com exclamação para reportar um problema com
  a mídia (sem legenda, áudio ruim, não abre). Qualquer pessoa do grupo pode reportar. *(1)*
- A folha pergunta "O que tem de errado com <mídia>?" e eu escolho um motivo: Não abre / não toca,
  Sem legenda, Áudio errado, Qualidade ruim, Episódio faltando (só em séries) ou Outro. *(1)*
- Embaixo eu conto mais, em até 300 caracteres. É opcional, menos em Outro. O botão é "Avisar o
  Cesar". *(1)*
- O atendente vê o motivo e o que escrevi. *(1)*
- Eu tenho no máximo um problema aberto por mídia. Com um aberto, o triângulo fica cinza e avisa
  que a Paçoca já está cuidando. Outra pessoa pode reportar a mesma mídia. *(1)*
- O aviso vai só para os atendentes (`notificacoes.md`). *(1)*
- Em Gerenciar pedidos, abaixo das filas, o atendente vê os problemas abertos, do mais antigo ao mais
  novo, com a mídia, o que foi escrito, quem reportou e quando. *(1)*
- O atendente marca o problema como resolvido. Quem reportou recebe um aviso e pode reportar de
  novo. *(1)*
