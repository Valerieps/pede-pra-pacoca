# Segurança

As regras que todo código do app segue. Curtas de propósito: as que podem ser testadas são
conferidas pelo `src/security.test.ts`, que roda em todo build.

- **Entra aqui:** as regras de segurança e de privacidade.
- **Não entra aqui:** como cada regra foi implementada (`adr/`) e o que falta verificar (issues
  `t:debito-tecnico` e `t:vulnerability`).

## 1. Rede

- O app fala só com as origens listadas em `network-policy.ts`; a CSP abre `connect-src` só para elas.
- As chamadas de rede ficam em `src/infrastructure/`; o resto do código não as faz.
- Sem analytics nem telemetria de terceiros sem uma decisão registrada num ADR.
- Segredos nunca vão para o código do cliente: tudo que está no bundle é público. A chave do TMDB e
  o segredo do webhook ficam só nas Cloud Functions.
- Os dados guardados são nome, foto, e-mail e pedidos do grupo. Não há dado sensível.

## 2. Acesso e dados

- Só entra quem tem convite para o e-mail da conta Google. As regras do Firestore negam tudo a quem
  não é membro.
- Papéis e escritas sensíveis (status, petiscos, convites, configuração) passam só pelas Functions.
- O webhook confere o segredo em tempo constante e ignora chamadas inválidas.
- O segredo do webhook e a URL do Jellyseerr só o admin vê.

## 3. Para todo app

- Texto do usuário nunca é inserido como HTML (`textContent`, nunca `innerHTML` ou `dangerouslySetInnerHTML`).
- Links abrem com `target="_blank" rel="noopener noreferrer"`.
- Dependências mínimas, com versões exatas, instaladas com `npm ci` e empacotadas no build; nada de CDN.
- A CSP é injetada no build de produção (ADR-002) e os cabeçalhos ficam em `public/_headers`.
- Nenhum dado pessoal vai para a URL.
