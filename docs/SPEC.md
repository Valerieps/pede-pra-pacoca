# Spec

O que o app faz. É a fonte da verdade: quando outro documento diverge daqui, vale o spec.

- **Entra aqui:** o que o app é, para quem, as fases e qual arquivo de `spec/` cobre cada feature.
- **Não entra aqui:** as regras em si (ficam em `spec/`), o que falta construir (`ROADMAP.md`) e
  como o app é construído (`ARQUITETURA.md` e `adr/`).

## O app

O Pede pra Paçoca é um web app para celular (instalável na tela inicial) onde um grupo pequeno de
amigos pede filmes e séries ao Cesar. Eu entro por convite, peço compartilhando um link do IMDb ou
do TMDB (ou pela busca), acompanho o pedido, curto o que os outros pedem e digo "Eu também quero".
O app é a porta de entrada social do Jellyseerr, que roda na casa do Cesar. A Paçoca, a cachorrinha
dele, é a mascote e a voz do app.

O que o Jellyseerr não oferece e o app oferece: pedir por link compartilhado, feed social com
curtidas, "Eu também quero", petiscos (créditos) com cashback, pedidos manuais de mídias fora do
TMDB e a identidade da Paçoca.

Premissas que valem para todos os arquivos:

- Existe um único grupo, de dezenas de pessoas no máximo. Prefiro simplicidade a escalabilidade.
- A interface é em português do Brasil. O fuso das regras mensais é America/Sao_Paulo.
- O app só funciona com internet. Não há modo offline.
- O app nunca fala direto com a casa do Cesar. Ele funciona por completo com a máquina de casa
  desligada.
- O app só gerencia pedidos: não baixa, guarda nem reproduz mídia.

## Fases

Cada fase precisa ser usável sozinha. Cada regra em `spec/` diz de que fase vale, como *(1)*.
A ordem de construção dentro da fase 1 fica no [ROADMAP.md](ROADMAP.md).

| Fase | O que entra |
| --- | --- |
| 1 | Tudo o que está descrito em `spec/`: convite e login, pedidos, petiscos, filas do atendente, o Paçocast (agente na casa do Cesar que cria os pedidos no Jellyseerr e acompanha o status), feed, notificações, estatísticas e a identidade da Paçoca |
| 2 | A checagem de duplicidade passa a consultar a biblioteca real do Jellyseerr. Só para orientar o desenho: não é para construir agora |

Fora de escopo: baixar, guardar ou reproduzir mídia; acompanhar temporadas novas de séries (fica com
o Sonarr); mais de um grupo; chat entre membros; app nas lojas de aplicativos; login com Apple.

## Arquivos

| Arquivo | O que cobre |
| --- | --- |
| [spec/app-e-instalacao.md](spec/app-e-instalacao.md) | Web app mobile first, navegação, instalação, compartilhar no Android e no iPhone, login |
| [spec/grupo-e-papeis.md](spec/grupo-e-papeis.md) | Convites, membros, papéis e permissões |
| [spec/pedidos.md](spec/pedidos.md) | Pedir (link, busca, manual), ciclo de vida, "Eu também quero", retorno |
| [spec/petiscos.md](spec/petiscos.md) | Saldo, reserva, validade, cashback e bônus |
| [spec/atendente.md](spec/atendente.md) | Filas, "Eu pego esse", status em lote, modo férias |
| [spec/feed.md](spec/feed.md) | Feed, eventos, curtidas e filtros |
| [spec/notificacoes.md](spec/notificacoes.md) | Push, caixa de entrada, resumo diário e silêncio |
| [spec/jellyseerr.md](spec/jellyseerr.md) | O Paçocast, os status do Jellyseerr e a configuração do admin |
| [spec/estatisticas.md](spec/estatisticas.md) | Números do Grupo: estatísticas e histórico |
| [spec/identidade.md](spec/identidade.md) | A voz, os textos e as ilustrações da Paçoca |
| [spec/criterios-de-aceite.md](spec/criterios-de-aceite.md) | O que precisa ser verdade para a fase 1 estar pronta |
| [spec/_modelo.md](spec/_modelo.md) | Modelo para um arquivo de feature novo |

Os termos estão definidos em [GLOSSARIO.md](GLOSSARIO.md).
