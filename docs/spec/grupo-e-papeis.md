# Grupo e papéis

Quem está no grupo, como entra e o que cada papel pode fazer.

- **Entra aqui:** convites, membros, os três papéis, o que cada um permite e baixar os dados do grupo.
- **Não entra aqui:** as filas e ações do atendente (`atendente.md`), a configuração do Jellyseerr
  (`jellyseerr.md`) e o login (`app-e-instalacao.md`).

## Em aberto

Nenhuma.

## O grupo

- Existe um único grupo. Todos os pedidos, o feed e os históricos são visíveis para todos os
  membros. *(1)*
- Hoje o Cesar e a Vesper são admins, e o Cesar é o único atendente. Os amigos são solicitantes. Um
  admin pode dar o papel de atendente a alguém de vez em quando e tirar depois. *(1)*

## Papéis

| Papel | O que pode |
| --- | --- |
| Solicitante | Pedir, "Eu também quero", curtir, cancelar os próprios pedidos, dar retorno, ver feed, fila, histórico e estatísticas |
| Atendente | Tudo da solicitante; aprovar e recusar pedidos; "Eu pego esse"; marcar status; conceder cashback e petiscos bônus; configurar regras de petiscos; ativar o modo férias |
| Admin | Tudo do atendente; convidar e remover membros; dar e tirar o papel de atendente e de admin; configurar a integração com o Jellyseerr; baixar os dados do grupo |

- Pode haver mais de um atendente. *(1)*
- Só o admin dá ou tira o papel de atendente. *(1)*
- Pode haver mais de um admin. O app não deixa remover o último. *(1)*
- Um admin pode fazer tudo o que o atendente faz, mas só conta como atendente quem tem esse papel:
  o pedido de um admin sem o papel de atendente reserva petisco, e ele não recebe os avisos nem o
  resumo dos atendentes. *(1)*
  Por quê: hoje a Vesper é admin e não atende; o Cesar é admin e atendente.
- Os primeiros admins entram sem convite, pelos e-mails configurados no servidor, só enquanto o
  grupo não tem nenhum admin. *(1)*

## Dados do grupo

- O admin baixa todos os dados do grupo num arquivo JSON, para guardar ou conferir. As sessões de
  login, as chaves de push e os segredos ficam de fora. *(1)*
  Por quê: o banco do grupo não tem painel para ver os dados (ADR-006).

## Membros

- Só o admin vê a lista do grupo, em Gerenciar membros, com nome, foto, e-mail e papéis. *(1)*
- Na mesma tela, o admin dá e tira os papéis de atendente e de admin, inclusive os dele, desde que
  sobre um admin. *(1)*

## Perfil

- No primeiro acesso eu confirmo meu nome e escolho a foto: a da minha conta Google ou nenhuma.
  Depois posso mudar os dois a qualquer hora, no Perfil. *(1)*
- O nome tem de 1 a 40 caracteres. *(1)*
- Se eu escolhi a foto do Google, ela se atualiza a cada login. Se escolhi ficar sem foto, o app
  respeita, mesmo que eu ponha foto no Google. *(1)*

## Convites

- O admin convida uma pessoa pelo e-mail dela. O convite fica ligado a esse e-mail e só vale para
  quem entra com a conta Google dele. *(1)*
- O convite não expira. Ele deixa de valer só quando o admin o derruba. *(1)*
- O admin vê a lista de convites com os pendentes e os aceitos (quem, e-mail e data) e pode revogar
  um pendente. *(1)*
- Sem convite válido, não há acesso. *(1)*
- Quando alguém aceita o convite, o feed mostra "Carla entrou no grupo". *(1)*

## Remover membro

- O admin remove um membro, na tela de membros, depois de confirmar. Ele não remove a si mesmo: outro
  admin faz isso. Assim sempre sobra um admin. *(1)*
- Os pedidos ativos dele são tratados como cancelados pela solicitante (com estorno do petisco e a
  oferta às co-solicitantes de `pedidos.md`). *(1)*
  - Se o pedido já está Farejando e ninguém fica com ele, ele segue sem petisco de ninguém,
    como na oferta de `pedidos.md`. *(1)*
- Ele sai dos pedidos ativos em que clicou "Eu também quero"; se a oferta de herdar um pedido
  estava com ele, ela passa à seguinte. *(1)*
- Os pedidos ativos que ele tinha pegado ("Eu pego esse") voltam para a fila sem responsável. *(1)*
- O histórico dele (pedidos atendidos, eventos do feed) permanece. *(1)*
- O membro removido perde o acesso na hora, em todos os celulares, e para de receber avisos. Se o admin convidar o mesmo e-mail de novo, a pessoa
  volta com o histórico e com os petiscos bônus e cashback que ainda estão na validade. *(1)*
