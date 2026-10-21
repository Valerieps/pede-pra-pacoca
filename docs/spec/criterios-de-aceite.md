# Critérios de aceite da fase 1

O que precisa ser verdade para eu dizer que a fase 1 está pronta.

- **Entra aqui:** a lista de conferência da fase 1.
- **Não entra aqui:** as regras (ficam nos outros arquivos de `spec/`).

## Em aberto

Nenhuma.

## Lista

- [ ] Uma pessoa convidada pelo e-mail entra com a conta Google e vê o feed. Sem convite, não entra.
- [ ] No Android, compartilhar um link do IMDb ou do TMDB abre a confirmação com a mídia certa. No
  iPhone, colar o link no app faz o mesmo.
- [ ] Pedir uma mídia já pedida oferece "Eu também quero"; uma já atendida avisa e oferece "Pedir de
  novo".
- [ ] Com petisco, o pedido vai para Aprovado; sem petisco, para Aguardando aprovação.
- [ ] Pedido de atendente não reserva petisco.
- [ ] O webhook "disponível" do Jellyseerr marca o pedido como Atendido e notifica a solicitante e as
  co-solicitantes.
- [ ] Pedido manual é atendido à mão e só então debita o petisco.
- [ ] Cancelado, Recusado e Não foi possível estornam o petisco reservado.
- [ ] No dia 1, os petiscos mensais renovam e os do mês anterior expiram; bônus e cashback vencem em
  90 dias.
- [ ] Um pedido atendido com 2 co-solicitantes devolve 1 petisco à solicitante original, uma única
  vez.
- [ ] Só o admin dá o papel de atendente; o último admin não pode ser removido.
- [ ] O admin vê os convites pendentes e aceitos e consegue revogar um pendente.
- [ ] O app continua funcionando (pedir, feed, curtir) com a máquina de casa desligada.
