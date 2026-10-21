# Identidade da Paçoca

A voz e a cara do app.

- **Entra aqui:** o tom dos textos, os textos-chave, as animações e as ilustrações.
- **Não entra aqui:** as regras que disparam cada texto (ficam nos outros arquivos de `spec/`).

## Em aberto

Nenhuma.

## Voz

- A Paçoca é a voz do app: textos curtos, carinhosos e bem-humorados, em primeira ou terceira
  pessoa, nunca infantilizados. *(1)*
- Os créditos se chamam petiscos em toda a interface. *(1)*
- Os textos ficam centralizados num arquivo de strings, para eu ajustar sem mexer em lógica. *(1)*

| Momento | Texto |
| --- | --- |
| Confirmação de pedido | Pedido entregue pra Paçoca! |
| Fila do atendente vazia | Fila zerada! A Paçoca foi tirar um cochilo. |
| Já está no servidor | A Paçoca já buscou esse! Pode assistir. |
| Sem petiscos | Seus petiscos acabaram. Esse pedido vai precisar da aprovação da Paçoca. |
| Atendido | A Paçoca buscou *Duna: Parte Três* pra você! |
| Cashback | A Paçoca te devolveu um petisco! |
| Modo férias | A Paçoca está dormindo. Pode pedir, ela vê quando acordar. |
| Erro genérico | A Paçoca tropeçou. Tenta de novo? |

## Animações e ilustrações

- Uma animação da Paçoca aparece quando eu confirmo um pedido e quando recebo um Atendido. *(1)*
- Ilustrações da Paçoca ocupam os estados vazios e o card do pedido manual. *(1)*
- Os arquivos de ilustração e animação chegam depois. Até lá, o app usa placeholders. *(1)*
