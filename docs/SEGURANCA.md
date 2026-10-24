# Segurança

As regras que todo código do app segue. Curtas de propósito: as que podem ser testadas são
conferidas pelo `src/security.test.ts`, que roda em todo build.

- **Entra aqui:** as regras de segurança e de privacidade.
- **Não entra aqui:** como cada regra foi implementada (`adr/`) e o que falta verificar (issues
  `t:debito-tecnico` e `t:vulnerability`).

## 1. Rede

- O app fala só com a própria origem e com as listadas em `network-policy.ts`; a CSP abre
  `connect-src` e `img-src` só para elas. O servidor (`server/`) chama só as origens de
  `SERVER_ORIGINS`.
- As chamadas de rede ficam em `src/infrastructure/`; o resto do código não as faz.
- Sem analytics nem telemetria de terceiros sem uma decisão registrada num ADR.
- Segredos nunca vão para o código do cliente: tudo que está no bundle é público. A chave do TMDB, o
  segredo do login Google e o token do Paçocast ficam só no Worker (e o token, também no `.env` do
  Paçocast na casa do Cesar).
- Os dados guardados são nome, foto, e-mail e pedidos do grupo. Não há dado sensível.

## 2. Acesso e dados

- Só entra quem tem convite para o e-mail da conta Google. Sem convite, nada é gravado.
- O login de teste sem Google (ADR-009) só existe com `DEV_SIGN_IN=1` no `.dev.vars` e em
  `localhost`; nunca no `wrangler.jsonc`.
- O app não acessa o banco. Toda leitura e escrita passa pela API, que confere a sessão e o papel
  no servidor.
- A sessão é um cookie `HttpOnly`, `Secure`, `SameSite=Lax`; o banco guarda só o hash do token.
  Remover um membro corta o acesso na hora.
- Toda chamada que muda dados, e a conexão ao vivo, precisa vir da própria origem do app (`Origin`).
- As rotas do Paçocast (`/api/pacocast/`) conferem o token em tempo constante e não existem sem o
  segredo `PACOCAST_TOKEN`. Elas só leem a fila e mudam status pelas mesmas regras do atendente.
- O Paçocast só faz conexões de saída, para o Pede e para o Jellyseerr local, nos endereços do
  `.env` dele; o código não tem nenhum outro endereço. A chave de API do Jellyseerr nunca sai da
  casa do Cesar.
- A URL do Jellyseerr só o admin vê.

## 3. Para todo app

- Texto do usuário nunca é inserido como HTML (`textContent`, nunca `innerHTML` ou `dangerouslySetInnerHTML`).
- Links abrem com `target="_blank" rel="noopener noreferrer"`.
- Dependências mínimas, com versões exatas, instaladas com `npm ci` e empacotadas no build; nada de CDN.
- A CSP é injetada no build de produção (ADR-002) e os cabeçalhos ficam em `public/_headers`.
- Nenhum dado pessoal vai para a URL.
