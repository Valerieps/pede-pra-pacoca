# Jellyseerr

A ligação do app com o Jellyseerr que roda na casa do Cesar.

- **Entra aqui:** a configuração do admin, o webhook e a porta "enviar pedido aprovado".
- **Não entra aqui:** as filas do atendente (`atendente.md`) e o ciclo do pedido (`pedidos.md`).
  Formato do payload e segredos ficam em `ARQUITETURA.md` e `SEGURANCA.md`.

## Em aberto

- [ ] Adiado por decisão da dona: toda a conexão com o Jellyseerr fica para depois. Quando chegar a vez,
  confirmar com o Cesar qual programa roda lá (Jellyseerr ou Seerr, que o sucedeu), a versão e o
  formato exato do payload do webhook: campos que trazem o ID do TMDB e o tipo.

## Princípios

- Na fase 1, o único elo é o webhook que o Jellyseerr envia para a nuvem. Criar o pedido lá é
  trabalho do atendente, pela fila "A enviar". *(1)*
- O app funciona por completo com a máquina de casa desligada. Webhook perdido não trava nada: o
  atendente sempre pode marcar Atendido à mão. *(1)*
- Nada é aberto, instalado ou tunelado na casa do Cesar. *(1)*
- Criar o pedido no Jellyseerr é uma porta trocável ("enviar pedido aprovado"). Na fase 1 quem a
  executa é o atendente; na fase 2 será o agente doméstico. *(1)*

## Configuração do admin

- Eu configuro a URL base do Jellyseerr, usada pelo botão "Abrir no Jellyseerr". *(1)*
- Eu vejo a URL e o segredo do webhook para colar no Jellyseerr, e posso gerar um segredo novo. *(1)*
- Eu vejo a data do último webhook recebido e tenho um botão "Testar". *(1)*

## Webhook

- O app valida o segredo em cada chamada e ignora as inválidas. *(1)*
- Mídia disponível: o app grava o ID em Mídias conhecidas e passa para Atendido todos os pedidos
  em Aprovado ou No Jellyseerr com o mesmo ID e tipo. *(1)*
- Falha: os pedidos correspondentes vão para Não foi possível, com o motivo "falha no servidor", e
  os atendentes são avisados. *(1)*
- Pedido criado, se o aviso chegar: o pedido correspondente passa de Aprovado para No Jellyseerr sem
  ação manual. *(1)*
- O mesmo webhook recebido duas vezes não gera efeito duplicado. *(1)*

## Fase 2

Só para o desenho não fechar portas. Um agente na máquina de casa consulta a nuvem de tempos em
tempos, cria no Jellyseerr os pedidos da fila "A enviar" e informa o resultado, usando só conexões
de saída. Com ele, a checagem de duplicidade passa a consultar também a biblioteca real. *(2)*
