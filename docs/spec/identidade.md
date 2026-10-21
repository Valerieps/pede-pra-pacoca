# Identidade da Paçoca

A voz e a cara do app.

- **Entra aqui:** o tom dos textos, os textos-chave, as animações, as ilustrações e os ícones.
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
- A do Atendido aparece quando eu abro um pedido meu, ou em que cliquei "Eu também quero", que
  está Atendido (pelo push, pela caixa de entrada ou pelo feed), ou quando ele vira Atendido com a
  tela aberta. Ela aparece uma vez por pedido em cada celular, com o texto do Atendido. *(1)*
- Logo depois de pedir, junto com a animação, aparece o card do pedido (pôster, título e estado) e
  os botões "Ver meus pedidos" e "Pedir outro". *(1)*
- No computador, as animações abrem num cartão centralizado, do tamanho do celular, com o fundo
  escurecido. O do Atendido tem "Fechar", e fecha também com Esc ou clicando fora. No celular, a
  animação fica no topo da tela. *(1)*
  Por quê: solta no meio da tela larga, a Paçoca se perde; o cartão mantém o tamanho pensado para
  o celular.
- Com a opção do celular de reduzir movimento ligada, a Paçoca aparece parada. *(1)*
- Ilustrações da Paçoca ocupam os estados vazios e o card do pedido manual. *(1)*
- Os arquivos de ilustração e animação chegam depois. Até lá, o app usa placeholders. *(1)*

## Ícones

- O petisco tem um ícone: um quadradinho arredondado cor de caramelo, com uns farelinhos. Ele
  aparece no chip de petiscos do cabeçalho, no card de petiscos do computador e na tela de
  Petiscos. *(1)*
  Por quê: o caramelo é só da Paçoca e dos petiscos, então o ícone já diz do que se trata.
