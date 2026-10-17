# Nome do app

<Uma frase sobre o que o app faz.>

## Usar o template

Este repositório é um template para apps web construídos com o Claude Code: Vite + React +
TypeScript, testes com Vitest, CI no GitHub Actions e deploy no Cloudflare Pages, com as docs
organizadas para o Claude ler só o que precisa.

1. No GitHub, **Use this template > Create a new repository**.
2. Clone o repositório novo e rode `npm ci`.
3. Abra o Claude Code na pasta e diga **"leia o BOOTSTRAP.md e siga"**. Ele faz uma entrevista
   sobre o app, preenche as docs, configura o repositório e abre o primeiro PR.

Um template não copia labels, proteção de branch nem configurações do repositório: o
`npm run setup:repo` faz isso (o bootstrap já roda).

## Rodar

```bash
npm ci
npm run dev
```

`npm test` roda os testes, `npm run build` gera o build de produção em `dist/`.

## Onde está cada coisa

- `CLAUDE.md`: instruções para o Claude Code e o mapa das docs.
- `docs/SPEC.md` e `docs/spec/`: o que o app faz.
- `docs/ROADMAP.md`: o que falta.
- `docs/adr/`: as decisões técnicas.
- `docs/SEGURANCA.md`: as regras de segurança.
