// Every text the Paçoca says lives here (docs/spec/identidade.md), so the owner can adjust the
// voice without touching logic. Shared by the app and the server (notifications).
export const strings = {
  appName: 'Pede pra Paçoca',

  signIn: {
    title: 'Pede pra Paçoca',
    tagline: 'Pede que a Paçoca busca.',
    button: 'Entrar com Google',
    noInvite: 'A Paçoca não achou um convite pra esse e-mail. Pede pra um admin te convidar.',
    failed: 'A Paçoca tropeçou no login. Tenta de novo?',
  },

  nav: {
    feed: 'Feed',
    ask: 'Pedir',
    myRequests: 'Meus pedidos',
    invites: 'Convites',
    signOut: 'Sair',
  },

  feed: {
    title: 'Feed',
    empty: 'Nada por aqui ainda. A Paçoca está de orelha em pé.',
    memberJoined: (name: string) => `${name} entrou no grupo`,
    // The title is shown in italics after these.
    requestCreated: (name: string) => `${name} pediu`,
    coRequest: (name: string) => `${name} também quer`,
  },

  mediaType: { movie: 'Filme', tv: 'Série' },

  requestStatus: {
    awaiting_approval: 'Aguardando aprovação',
    approved: 'Aprovado',
    in_jellyseerr: 'No Jellyseerr',
    fulfilled: 'Atendido',
    rejected: 'Recusado',
    unavailable: 'Não foi possível',
    canceled: 'Cancelado',
  },

  ask: {
    title: 'Pedir pra Paçoca',
    linkLabel: 'Cole um link do IMDb ou do TMDB',
    linkButton: 'Abrir',
    unrecognizedLink: 'A Paçoca não reconheceu esse link. Tenta buscar pelo nome ou faz um pedido manual.',
    notFound: 'A Paçoca não achou essa mídia no TMDB.',
    searchLabel: 'Buscar filme ou série',
    searchButton: 'Buscar',
    filterAll: 'Tudo',
    noResults: 'A Paçoca farejou e não achou nada.',
    manualOffer: 'Fazer um pedido manual',
    manualShortcut: 'Não achou? Faz um pedido manual',
    back: 'Voltar',
    another: 'Pedir outro',
    requested: 'Já pedido',
    onServer: 'No servidor',
  },

  confirm: {
    unreleased: 'Ainda não lançado',
    noteLabel: 'Observação (opcional)',
    submit: 'Pedir pra Paçoca',
    balance: (n: number) => `Você tem ${n === 1 ? '1 petisco' : `${n} petiscos`}.`,
    attendantFree: 'Pedido de atendente não gasta petisco.',
    activeExists: 'Alguém já pediu esse. Quer entrar junto?',
    alreadyMine: 'Você já pediu esse.',
    alreadyJoined: 'Você já quer esse.',
    askAgain: 'Pedir de novo',
    seeRequest: 'Ver o pedido',
  },

  manual: {
    title: 'Pedido manual',
    titleLabel: 'Título',
    typeLabel: 'Tipo',
    linkLabel: 'Link (opcional)',
    invalid: 'Confere o título e o link.',
  },

  myRequests: {
    title: 'Meus pedidos',
    empty: 'Você ainda não pediu nada. A Paçoca está esperando!',
    active: 'Em andamento',
    past: 'Anteriores',
    coRequested: 'Você também quer',
  },

  request: {
    notFound: 'A Paçoca não achou esse pedido.',
    requestedBy: (name: string) => `Pedido de ${name}`,
    alsoWant: (names: string) => `Também querem: ${names}`,
    assignee: (name: string) => `Com ${name}`,
    createdAt: (date: string) => `Pedido em ${date}`,
    noteLabel: 'Observação',
    editNote: 'Editar observação',
    save: 'Salvar',
    cancelEdit: 'Desistir',
    openLink: 'Abrir o link',
    join: 'Eu também quero',
    leave: 'Não quero mais',
    cancel: 'Cancelar pedido',
    cancelConfirm: 'Cancelar esse pedido? O petisco volta pra você.',
    cancelConfirmShared: 'Cancelar esse pedido? O petisco volta pra você, e a Paçoca oferece o pedido pra quem também quer.',
    offerForYou: (name: string) => `${name} cancelou esse pedido. Quer ficar com ele? Ele gasta um petisco seu, se você tiver.`,
    accept: 'Quero ficar com ele',
    decline: 'Não quero',
    offerPending: (name: string, date: string) => `A Paçoca ofereceu esse pedido a ${name}, até ${date}.`,
    history: 'Histórico',
    events: {
      offered_to_co_requesters: 'A solicitante cancelou; a Paçoca ofereceu o pedido a quem também quer',
      inherited: 'Ficou com o pedido',
      nobody_inherited: 'Ninguém ficou com o pedido',
    } as Record<string, string>,
  },

  invites: {
    title: 'Convites',
    emailLabel: 'E-mail da conta Google',
    send: 'Convidar',
    revoke: 'Revogar',
    pending: 'Pendente',
    accepted: 'Aceito',
    revoked: 'Revogado',
    invalidEmail: 'Esse e-mail não parece certo.',
    alreadyMember: 'Essa pessoa já está no grupo.',
  },

  petiscos: {
    balance: (n: number) => (n === 1 ? '1 petisco' : `${n} petiscos`),
  },

  status: {
    offline: 'Sem internet. Mostrando o que a Paçoca lembrava.',
  },

  requestConfirmed: 'Pedido entregue pra Paçoca!',
  queueEmpty: 'Fila zerada! A Paçoca foi tirar um cochilo.',
  alreadyOnServer: 'A Paçoca já buscou esse! Pode assistir.',
  noPetiscos: 'Seus petiscos acabaram. Esse pedido vai precisar da aprovação da Paçoca.',
  fulfilled: (title: string) => `A Paçoca buscou ${title} pra você!`,
  cashback: 'A Paçoca te devolveu um petisco!',
  vacation: 'A Paçoca está dormindo. Pode pedir, ela vê quando acordar.',
  genericError: 'A Paçoca tropeçou. Tenta de novo?',
  retry: 'Tentar de novo',
  forbidden: 'Isso a Paçoca não deixa você fazer.',
} as const;
