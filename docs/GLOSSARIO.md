# Glossário

Um termo, um sentido. Estes nomes valem para os textos da interface e para as docs.

- **Entra aqui:** cada termo do app, com uma definição curta e o arquivo de `spec/` que o usa.
- **Não entra aqui:** as regras em si, que ficam em `spec/`. Se uma definição daqui e uma regra
  divergirem, vale o spec, e o termo daqui é corrigido.

- **Admin:** papel que convida e remove membros, dá o papel de atendente e configura o Jellyseerr. (`spec/grupo-e-papeis.md`)
- **Atendente:** papel que aprova pedidos, muda status e cuida dos petiscos. Hoje é o Cesar. (`spec/grupo-e-papeis.md`, `spec/atendente.md`)
- **Cashback:** um petisco devolvido à solicitante por critério automático ou por um atendente. (`spec/petiscos.md`)
- **Co-solicitante:** quem clicou "Eu também quero" num pedido de outra pessoa. (`spec/pedidos.md`)
- **Convite:** autorização para um e-mail entrar no grupo. Não expira; o admin derruba. (`spec/grupo-e-papeis.md`)
- **Eu também quero:** ação que faz a pessoa virar co-solicitante, sem gastar petisco. (`spec/pedidos.md`)
- **Eu pego esse:** ação em que o atendente se torna o responsável por um pedido. (`spec/atendente.md`)
- **Feed:** linha do tempo pública dos eventos do grupo. (`spec/feed.md`)
- **Jellyseerr:** gerenciador de pedidos que roda na casa do Cesar e repassa ao Sonarr e ao Radarr. (`spec/jellyseerr.md`)
- **Mídia:** filme ou série, identificada pelo ID do TMDB (exceto no pedido manual). (`spec/pedidos.md`)
- **Mídia conhecida:** mídia que o Jellyseerr avisou estar disponível no servidor. (`spec/pedidos.md`, `spec/jellyseerr.md`)
- **Modo férias:** aviso "A Paçoca está dormindo" que o atendente liga quando está ausente. (`spec/atendente.md`)
- **Nota de atendimento:** texto opcional do atendente ao marcar Atendido. (`spec/atendente.md`)
- **Paçoca:** a cachorrinha do Cesar, mascote e voz do app. (`spec/identidade.md`)
- **Pedido:** solicitação de uma mídia feita por uma pessoa. Série é sempre pedida completa. (`spec/pedidos.md`)
- **Pedido manual:** pedido de algo fora do TMDB, atendido à mão. (`spec/pedidos.md`)
- **Petisco:** crédito de pedido, mensal, bônus ou cashback. (`spec/petiscos.md`)
- **Selo "Ainda não lançado":** marca de uma mídia com lançamento futuro. Não é um estado do pedido. (`spec/pedidos.md`)
- **Solicitante:** qualquer membro do grupo, que pede mídias. (`spec/grupo-e-papeis.md`)
