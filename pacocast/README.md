# Paçocast

O agente que roda na casa do Cesar, ao lado do Jellyseerr. A cada 45 segundos ele pergunta ao Pede
o que há para fazer, cria no Jellyseerr os pedidos Solicitados e conta ao Pede como estão os que o
Jellyseerr já tem. As regras ficam em [`docs/spec/jellyseerr.md`](../docs/spec/jellyseerr.md); o
porquê do desenho, na [ADR-016](../docs/adr/016-pacocast-agent-polls-the-worker.md).

- **Entra aqui:** como instalar e configurar o Paçocast.
- **Não entra aqui:** as regras dos status (`docs/spec/`) e o desenho (`docs/adr/`).

Só conexões de saída: nada na casa do Cesar fica aberto para a internet. Sem dependências: um
arquivo TypeScript que o Node 24 roda direto, num contêiner Docker.

## Instalar (uma vez)

1. **Token do Paçocast, no Pede** (quem cuida do Cloudflare):
   - Gere um texto aleatório longo, por exemplo com `node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"`.
   - Na pasta do projeto, rode `npx wrangler secret put PACOCAST_TOKEN` e cole o texto.
   - Mande o mesmo texto ao Cesar por um canal privado.
2. **Chave de API do Jellyseerr** (Cesar): Jellyseerr → Settings → General → API Key → copiar.
3. **Arquivos na máquina do Docker** (Cesar): copie a pasta `pacocast/` deste repositório para a
   máquina onde roda o Jellyseerr.
4. **Configuração** (Cesar): dentro da pasta, copie `.env.example` para `.env` e preencha:
   - `PEDE_URL`: o endereço do Pede, sem barra no fim.
   - `PACOCAST_TOKEN`: o texto do passo 1.
   - `JELLYSEERR_URL`: o Jellyseerr visto de dentro do contêiner. Na mesma rede Docker, é o nome do
     contêiner e a porta (`http://jellyseerr:5055`). Com o Jellyseerr exposto só na máquina, use
     `http://host.docker.internal:5055` e acrescente `extra_hosts: ["host.docker.internal:host-gateway"]`
     no `compose.yaml`.
   - `JELLYSEERR_API_KEY`: a chave do passo 2.
5. **Rede**: se o Jellyseerr roda em outro `compose`, descomente `networks` no `compose.yaml` com o
   nome da rede dele (`docker network ls` mostra) e declare a rede como `external: true`.
6. **Subir**: `docker compose up -d --build`.
7. **Conferir**: `docker compose logs -f pacocast`. A primeira linha diz "Paçocast farejando a cada
   45s". Peça um filme no Pede: em menos de um minuto ele aparece no Jellyseerr e o pedido vira
   Farejando.

## Quando algo dá errado

- "configuração: o Pede recusou o token": o `PACOCAST_TOKEN` do `.env` não é o mesmo do Worker, ou o
  segredo ainda não foi criado no Cloudflare.
- "configuração: o Jellyseerr recusou a chave de API": confira `JELLYSEERR_API_KEY`.
- Erros de conexão com o Jellyseerr: confira `JELLYSEERR_URL` e a rede do passo 5.
- Com o Paçocast desligado, nada trava: os pedidos esperam em Solicitado, e o atendente pode marcar
  tudo à mão nas filas.

## Atualizar

Copie o `pacocast.ts` novo para a pasta e rode `docker compose up -d --build`.
