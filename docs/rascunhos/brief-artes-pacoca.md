# Brief das artes da Paçoca

O que o Cesar desenha para o app e como entrega, para cada peça entrar no lugar do placeholder sem
ajuste no código.

- **Entra aqui:** o estilo das artes, a paleta delas, a lista de peças com onde cada uma aparece e
  o ícone do app.
- **Não entra aqui:** quando cada arte aparece e os textos que a acompanham (ficam em
  [`spec/identidade.md`](../spec/identidade.md) e em `src/domain/strings.ts`); o formato técnico
  dos arquivos (fica na [ADR-013](../adr/013-pacoca-art-as-svg-and-animated-webp.md)).

## Estilo

- Contorno em tinta (`#24121a`, a cor do texto do app), com espessura constante; preenchimentos
  chapados, sem degradê nem sombra.
- Fundo transparente: o app põe um círculo paçoca-claro atrás. A Paçoca precisa funcionar no
  fundo branco e no fundo escuro "sala de cinema".
- Quadro quadrado; a Paçoca cabe num círculo com 10% de margem, para não ser cortada.
- Tem que ler pequeno: testar a 96 px (estados vazios) e a 128 px (animações). Se a pose não se
  entende nesse tamanho, simplificar.
- Sem texto dentro da arte: as frases ficam no arquivo de textos do app, para eu ajustar sem
  redesenhar.

## Paleta das artes

| Cor | Hex | Uso |
| --- | --- | --- |
| Tinta | `#24121a` | Contorno e detalhes |
| Paçoca | `#d9a35a` | Pelagem |
| Paçoca claro | `#fbf0de` | Partes claras da pelagem, focinho |
| Vinho-cereja | `#7a1f3d` | Objetos da marca (o pedido na boca, o balde de pipoca) |
| Branco | `#ffffff` | Olhos, brilhos |
| Língua | `#e98a9b` | A língua, e só ela |
| Azul do Cesar | `#1c2b9c` | Só a coleira, como homenagem |

A pelagem usa as cores reais da Paçoca: se ela não for caramelo, a cor dela entra no lugar do
paçoca e do paçoca claro.

## Peças

Ordem sugerida: o ícone, as duas animações e o erro primeiro, porque aparecem para todo mundo na
primeira semana. Os estados vazios podem vir depois; os placeholders seguram até lá.

| Peça | Tipo | Onde aparece | Arquivo |
| --- | --- | --- | --- |
| Pedido confirmado | Animação | Logo depois de pedir, acima do card do pedido | `pacoca-confirmacao` |
| Atendido | Animação | Ao abrir um pedido meu que ficou pronto | `pacoca-atendido` |
| Feed vazio | Ilustração | Feed sem nada | `pacoca-feed-vazio` |
| Filtro vazio | Ilustração | Feed ou números filtrados sem resultado | `pacoca-filtro-vazio` |
| Fila zerada | Ilustração | Filas do atendente | `pacoca-fila-zerada` |
| Modo férias | Ilustração | Aviso no topo enquanto o atendente está fora | `pacoca-ferias` |
| Já está no servidor | Ilustração | Ao pedir algo que já existe | `pacoca-no-servidor` |
| Sem petiscos | Ilustração | Ao pedir sem petiscos | `pacoca-sem-petiscos` |
| Cashback | Ilustração | Aviso e item do feed | `pacoca-cashback` |
| Pedido manual | Ilustração | No lugar do pôster, no card do pedido manual | `pacoca-pedido-manual` |
| Erro | Ilustração | Falhas em geral | `pacoca-erro` |
| Ícone do app | Ícone | Tela inicial, favicon, tela de entrada | `icone` |

Os estados vazios de Meus pedidos, Convites e Membros usam a ilustração do feed vazio até haver
uma própria.

## Ícone do app

- O rosto da Paçoca em branco sobre vinho-cereja (`#7a1f3d`).
- Quadro de 512 px, com a arte dentro do círculo central de 80%: o Android corta as bordas.
- Uma versão de um traço só, para o favicon (16 a 32 px).
- Até chegar, o ícone é um placeholder: o quadrado vinho com um círculo tracejado branco onde vai
  o rosto e um petisco no canto (`public/icon.svg`, `public/icon-maskable.svg`).

## Como entregar

Ilustrações em SVG; animações em WebP animado de 512 × 512 px, mais um quadro parado de cada uma.
Os detalhes (quadros por segundo, duração, nomes) estão na
[ADR-013](../adr/013-pacoca-art-as-svg-and-animated-webp.md).
