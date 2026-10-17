# Segurança

As regras que todo código do app segue. Curtas de propósito: as que podem ser testadas são
conferidas pelo `src/security.test.ts`, que roda em todo build.

- **Entra aqui:** as regras de segurança e de privacidade.
- **Não entra aqui:** como cada regra foi implementada (`adr/`) e o que falta verificar (issues
  `t:debito-tecnico` e `t:vulnerability`).

O `BOOTSTRAP.md` escolhe um dos dois casos da seção 1 e apaga o outro.

## 1. Rede

### Caso A: local-only

- O app não faz nenhuma chamada de rede: `network-policy.ts` fica vazio e a CSP tem `connect-src 'none'`.
- Os dados ficam só no navegador. Backups vão para arquivos locais que a pessoa escolhe, nunca para um servidor.
- Sem analytics, telemetria, relatórios de erro remotos nem login.

### Caso B: com servidores

- O app fala só com as origens listadas em `network-policy.ts`; a CSP abre `connect-src` só para elas.
- As chamadas de rede ficam em `src/infrastructure/`; o resto do código não as faz.
- Sem analytics nem telemetria de terceiros sem uma decisão registrada num ADR.
- Segredos nunca vão para o código do cliente: tudo que está no bundle é público.

## 2. Para todo app

- Texto do usuário nunca é inserido como HTML (`textContent`, nunca `innerHTML` ou `dangerouslySetInnerHTML`).
- Links abrem com `target="_blank" rel="noopener noreferrer"`.
- Dependências mínimas, com versões exatas, instaladas com `npm ci` e empacotadas no build; nada de CDN.
- A CSP é injetada no build de produção (ADR-002) e os cabeçalhos ficam em `public/_headers`.
- Nenhum dado pessoal vai para a URL.
