# Arquitetura

O desenho técnico que o código não mostra sozinho.

- **Entra aqui:** as invariantes (o que precisa ser sempre verdade), o modelo de dados, o fluxo de
  eventos e as migrações.
- **Não entra aqui:** um passeio pelos arquivos (o código mostra), o porquê de cada decisão (`adr/`),
  o que falta construir (`ROADMAP.md`) e as regras de produto (`spec/`).

## Camadas

`domain` ← `application` ← `infrastructure` e `ui`. O domínio não importa nada de framework; a
aplicação define as portas (interfaces) que a infraestrutura implementa; a interface chama casos de
uso, nunca o banco direto.

## Invariantes

- <ex.: toda mudança numa entidade grava o evento correspondente na mesma transação.>

## Modelo de dados

| Entidade | Campos principais | Observação |
| --- | --- | --- |
| <entidade> | | |

## Fluxo de eventos

<Se o app tem histórico de eventos: quais tipos existem, quem grava, quem lê.>

## Migrações

<Versão atual do banco e do formato de backup, e a regra para mudar: só acrescentar campos
opcionais numa versão; remover leva duas versões.>
