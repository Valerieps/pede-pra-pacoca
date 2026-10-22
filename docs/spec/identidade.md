# Identidade da Paçoca

A voz e a cara do app.

- **Entra aqui:** o tom dos textos, os textos-chave, as cores e as fontes, as animações, as
  ilustrações e os ícones.
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

## Cores e fontes

A identidade visual se chama Bombonière: a sala de cinema e o papel de bombom. Aqui fica o papel
de cada cor; os valores ficam em `src/ui/theme/tokens.css`, e as artes seguem o
[brief do Cesar](../rascunhos/brief-artes-pacoca.md).

- O fundo do app é branco em quase tudo, e os pôsteres trazem o resto da cor. *(1)*
  Por quê: numa moldura discreta qualquer pôster fica bonito; uma interface colorida brigaria com
  eles.
- As barras do celular (a de cima e a de voltar, embaixo) ficam da cor do fundo do app, branco no
  tema claro, e não vinho. *(1)*
  Por quê: o cabeçalho e a barra de abas são brancos; barras vinho emolduravam o app.
- Vinho-cereja é a cor do app: nome do app, botões, aba atual, filtro ativo, links e "Eu também
  quero". *(1)*
  Por quê: começamos com o azul-escuro favorito do Cesar, mas branco com azul tinha cara de app
  de banco. O vinho junta os dois temas do app, cinema e doce.
- O vinho nunca clareia até virar vermelho. Erros, Recusado e Não foi possível usam laranja-tijolo. *(1)*
  Por quê: vermelho vivo lembra banco e se confunde com erro.
- Cereja marca o que o grupo faz: curtidas e o número de avisos não lidos. Nunca aparece em botões
  nem em erros. *(1)*
- Caramelo é só da Paçoca e dos petiscos. *(1)*
  Por quê: ver caramelo na tela sempre quer dizer "a Paçoca está aqui" ou "isto é um petisco". Se
  ele aparecer em qualquer botão, vira só mais uma cor.
- O azul do Cesar fica como homenagem, na coleira da Paçoca nas artes. *(1)*
- No tema escuro, o fundo é um vinho quase marrom, como a sala de cinema com a luz apagada, e não
  preto. *(1)*
- O nome do app, os títulos de tela, os nomes de filmes e séries e as frases da Paçoca usam a
  Fredoka, uma fonte arredondada. O resto usa a fonte do próprio celular. *(1)*
  Por quê: a Fredoka dá o jeito da Paçoca sem ficar infantil; a fonte do celular faz o app parecer
  nativo e lê bem em tamanho pequeno.

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
- Quando recebo um cashback com o app aberto, um petisco cai no contador do topo. Bônus e a
  renovação do mês não têm animação. *(1)*
- Enquanto uma lista carrega, aparecem cards vazios no formato do conteúdo, com um brilho
  passando, no lugar de um spinner. *(1)*
- Com a opção do celular de reduzir movimento ligada, a Paçoca aparece parada, o petisco não cai e
  os cards de carregamento não brilham. *(1)*
- Ilustrações da Paçoca ocupam os estados vazios e o card do pedido manual. *(1)*
- Os arquivos de ilustração e animação chegam depois. Até lá, o app usa placeholders. *(1)*

## Ícones

- O petisco tem um ícone: um quadradinho arredondado cor de caramelo, com uns farelinhos. Ele
  aparece no chip de petiscos em Pedir, no card de petiscos do computador e na tela de
  Petiscos. *(1)*
  Por quê: o caramelo é só da Paçoca e dos petiscos, então o ícone já diz do que se trata.
