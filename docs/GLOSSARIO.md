# Glossário

Um termo, um sentido. Estes nomes valem para os textos da interface e para as docs.

- **Entra aqui:** cada termo do app, com uma definição curta e o arquivo de `spec/` que o usa.
- **Não entra aqui:** as regras em si, que ficam em `spec/`. Se uma definição daqui e uma regra
  divergirem, vale o spec, e o termo daqui é corrigido.

- **Admin:** papel que convida e remove membros, dá o papel de atendente e configura o Jellyseerr. (`spec/grupo-e-papeis.md`)
- **Atendente:** papel que aprova pedidos, muda status e cuida dos petiscos. Hoje é o Cesar. (`spec/grupo-e-papeis.md`, `spec/atendente.md`)
- **Bombonière:** a identidade visual do app: fundo branco, vinho-cereja, cereja e caramelo. (`spec/identidade.md`)
- **Catálogo:** tudo o que já está na biblioteca do Plex do Cesar, para buscar e filtrar. (`spec/catalogo.md`)
- **Carinho:** um "Obrigada, Paçoca" num pedido Cãopleto. (`spec/estatisticas.md`)
- **Cashback:** um petisco devolvido à solicitante por critério automático ou por um atendente. (`spec/petiscos.md`)
- **Cãopleto:** estado do pedido pronto para assistir: o filme ou as temporadas da série estão no servidor. (`spec/pedidos.md`, `spec/jellyseerr.md`)
- **Co-solicitante:** quem clicou "Eu também quero" num pedido de outra pessoa. (`spec/pedidos.md`)
- **Convite:** autorização para um e-mail entrar no grupo. Não expira; o admin derruba. (`spec/grupo-e-papeis.md`)
- **Eu também quero:** ação que faz a pessoa virar co-solicitante, sem gastar petisco. (`spec/pedidos.md`)
- **Eu pego esse:** ação em que o atendente se torna o responsável por um pedido. (`spec/atendente.md`)
- **Farejando:** estado do pedido que o Jellyseerr já tem e está buscando (Requested ou Processing). (`spec/pedidos.md`, `spec/jellyseerr.md`)
- **Feed:** linha do tempo pública dos eventos do grupo. (`spec/feed.md`)
- **Jellyseerr:** gerenciador de pedidos que roda na casa do Cesar e repassa ao Sonarr e ao Radarr. (`spec/jellyseerr.md`)
- **Mídia:** filme ou série, identificada pelo ID do TMDB (exceto no pedido manual). (`spec/pedidos.md`)
- **Mídia conhecida:** mídia que o Paçocast avisou estar disponível no servidor. (`spec/pedidos.md`, `spec/jellyseerr.md`)
- **Modo férias:** aviso "A Paçoca está dormindo" que o atendente liga quando está ausente. (`spec/atendente.md`)
- **Nota de atendimento:** texto opcional do atendente ao marcar Cãopleto. (`spec/atendente.md`)
- **Paçoca:** a cachorrinha do Cesar, mascote e voz do app. (`spec/identidade.md`)
- **Paçocast:** o agente que roda na casa do Cesar, ao lado do Jellyseerr: cria lá os pedidos Solicitados e conta ao app como eles estão. (`spec/jellyseerr.md`)
- **Parcialmente disponível:** estado de uma série que já tem pelo menos um episódio no servidor. (`spec/pedidos.md`, `spec/jellyseerr.md`)
- **Pedido:** solicitação de uma mídia feita por uma pessoa. Série é sempre pedida completa. (`spec/pedidos.md`)
- **Pedido manual:** pedido de algo fora do TMDB, atendido à mão. (`spec/pedidos.md`)
- **Petisco:** crédito de pedido, mensal, bônus ou cashback. (`spec/petiscos.md`)
- **Problema:** aviso de que uma mídia do catálogo não está boa para assistir; vai para os atendentes. (`spec/catalogo.md`)
- **Selo "Ainda não lançado":** marca de uma mídia com lançamento futuro. Não é um estado do pedido. (`spec/pedidos.md`)
- **Solicitado:** estado do pedido aprovado que espera o Jellyseerr pegá-lo (fila A enviar). (`spec/pedidos.md`)
- **Solicitante:** qualquer membro do grupo, que pede mídias. (`spec/grupo-e-papeis.md`)
