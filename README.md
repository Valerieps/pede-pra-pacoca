# Pede pra Paçoca

Web app para um grupo de amigos pedirem filmes e séries ao Cesar, com petiscos, feed e a Paçoca de mascote.

## Rodar

```bash
npm ci
npm run build
cp .dev.vars.example .dev.vars   # e preencha com o cliente OAuth do Google
npm run dev:api                  # o Worker (API e banco), na porta 8787
npm run dev                      # o app, que repassa /api para o Worker
```

`npm test` roda os testes, `npm run build` gera o build de produção em `dist/` e confere o Worker.
`npm run preview` serve o app e o Worker juntos, como em produção.

## Onde está cada coisa

- `CLAUDE.md`: instruções para o Claude Code e o mapa das docs.
- `docs/SPEC.md` e `docs/spec/`: o que o app faz.
- `docs/ROADMAP.md`: o que falta.
- `docs/adr/`: as decisões técnicas.
- `docs/SEGURANCA.md`: as regras de segurança.
