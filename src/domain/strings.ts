// Every text the Paçoca says lives here (docs/spec/identidade.md), so the owner can adjust the
// voice without touching logic. Shared by the app and the server (notifications).

/** Names as Brazilians list them: "Ana", "Ana e Bia", "Ana, Bia e Caio". */
const listNames = (names: readonly string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
const petiscoCount = (n: number) => (n === 1 ? '1 petisco' : `${n} petiscos`);

export const strings = {
  appName: 'Pede pra Paçoca',

  signIn: {
    title: 'Pede pra Paçoca',
    tagline: 'Pede que a Paçoca busca.',
    button: 'Entrar com Google',
    noInvite: 'A Paçoca não achou um convite pra esse e-mail. Pede pra um admin te convidar.',
    failed: 'A Paçoca tropeçou no login. Tenta de novo?',
    devTitle: 'Entrar sem Google (só para testes neste computador)',
    devEmail: 'E-mail',
    devName: 'Nome',
    devButton: 'Entrar para testar',
    devHint: 'Precisa de DEV_SIGN_IN=1 no .dev.vars. As mesmas regras de convite valem.',
    devOff: 'O login de teste está desligado. Põe DEV_SIGN_IN=1 no .dev.vars e reinicia o servidor.',
  },

  nav: {
    feed: 'Feed',
    ask: 'Pedir',
    myRequests: 'Meus pedidos',
    invites: 'Convites',
    members: 'Membros',
    profile: 'Perfil',
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
    empty: 'Nenhum convite ainda. A Paçoca adora gente nova.',
  },

  profile: {
    firstAccessTitle: 'Oi! A Paçoca quer te conhecer.',
    firstAccessIntro: 'Confirma como o grupo vai te ver. Dá pra mudar depois no Perfil.',
    title: 'Perfil',
    nameLabel: 'Nome',
    invalidName: 'O nome precisa ter entre 1 e 40 letras.',
    photoLabel: 'Foto',
    googlePhoto: 'Foto da conta Google',
    noPhoto: 'Sem foto',
    noGooglePhoto: 'Sua conta Google não tem foto.',
    confirm: 'Confirmar',
    save: 'Salvar',
    saved: 'A Paçoca guardou!',
  },

  members: {
    title: 'Membros',
    you: '(você)',
    admin: 'Admin',
    attendant: 'Atendente',
    requester: 'Solicitante',
    rolesOf: (name: string) => `Papéis de ${name}`,
    lastAdmin: 'O grupo precisa de pelo menos um admin. Dá o papel a outra pessoa antes.',
    empty: 'Só a Paçoca por aqui. Convida alguém!',
  },

  install: {
    title: 'Põe a Paçoca na tela inicial',
    ios: 'No Safari, toca em Compartilhar e depois em "Adicionar à Tela de Início".',
    android: 'No menu do navegador (⋮), toca em "Instalar app" ou "Adicionar à tela inicial".',
    other: 'Abre o app no celular e adiciona à tela inicial pelo menu do navegador.',
    installButton: 'Instalar',
    dismiss: 'Agora não',
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

  notifications: {
    nav: 'Avisos',
    navUnread: (n: number) => `Avisos (${n})`,
    title: 'Avisos',
    empty: 'Nenhum aviso. A Paçoca está de orelha em pé.',
    markAllRead: 'Marcar todos como lidos',
    unread: 'Novo',
    preferencesLink: 'Preferências de avisos',
    enableLink: 'Ativar avisos no celular',

    permission: {
      title: 'Avisos no celular',
      intro: 'A Paçoca te avisa quando seu pedido anda, quando alguém curte o que você fez e quando seus petiscos vão vencer.',
      iphoneTitle: 'No iPhone',
      iphone:
        'O iPhone só deixa a Paçoca mandar avisos com o app instalado na tela de início (iOS 16.4 ou mais novo). Toque em Compartilhar, depois em "Adicionar à Tela de Início", e abra o app por lá.',
      ask: 'Ativar avisos',
      later: 'Agora não',
      granted: 'Avisos ligados neste celular.',
      denied: 'Os avisos estão bloqueados. Libere nas configurações do navegador ou do celular para este app.',
      unsupported: 'Este navegador não recebe avisos. Os avisos continuam aqui na caixa de entrada.',
      turnOff: 'Desligar avisos neste celular',
      failed: 'A Paçoca não conseguiu ligar os avisos. Tenta de novo?',
    },

    preferences: {
      title: 'Preferências de avisos',
      types: 'Quais avisos eu recebo',
      newRequests: 'Pedidos novos',
      immediate: 'Na hora',
      digest: 'Num resumo diário',
      digestTime: 'Horário do resumo',
      quietHours: 'Horário de silêncio',
      quietHoursHint: 'No silêncio o celular não toca; o aviso chega na caixa e o push sai quando o silêncio acaba.',
      quietStart: 'Começa',
      quietEnd: 'Termina',
      save: 'Salvar',
      saved: 'Pronto! A Paçoca anotou.',
      invalid: 'Algum horário não parece certo.',
      labels: {
        request_new: 'Pedido novo (aprovado com petisco)',
        request_pending: 'Pedido aguardando aprovação',
        webhook_failed: 'Falha do servidor de casa',
        thanked: 'Obrigada, Paçoca',
        request_approved: 'Meu pedido foi aprovado',
        request_closed: 'Meu pedido foi recusado ou não deu',
        request_fulfilled: 'Meu pedido foi atendido',
        co_request: 'Alguém também quer meu pedido',
        likes: 'Curtidas',
        petisco_received: 'Cashback ou bônus recebido',
        petisco_expiring: 'Petisco perto de vencer',
        monthly_renewed: 'Petiscos do mês renovados',
        inheritance_offer: 'Oferta de herdar um pedido',
      },
    },

    push: {
      requestNewTitle: 'Pedido novo',
      requestNew: (name: string, title: string) => `${name} pediu ${title}.`,
      requestPendingTitle: 'Pedido esperando você',
      requestPending: (name: string, title: string) => `${name} pediu ${title} sem petisco. Aprova?`,
      requestApprovedTitle: 'Pedido aprovado',
      requestApproved: (title: string) => `A Paçoca aprovou ${title}. Agora é com ela!`,
      requestRefusedTitle: 'Pedido recusado',
      requestRefused: (title: string, reason: string) => `A Paçoca não vai buscar ${title}: ${reason}.`,
      requestUnavailableTitle: 'Não foi possível',
      requestUnavailable: (title: string, reason: string) => `A Paçoca procurou ${title}, mas não deu: ${reason}.`,
      requestFulfilledTitle: 'Pedido atendido',
      requestFulfilled: (title: string, note: string | null) => `A Paçoca buscou ${title} pra você!${note ? ` ${note}` : ''}`,
      coRequestTitle: 'Eu também quero',
      coRequest: (name: string, title: string) => `${name} também quer ${title}.`,
      likesTitle: 'Curtidas',
      likes: (names: readonly string[], isRequest: boolean) => {
        const what = isRequest ? 'seu pedido' : 'sua novidade no feed';
        return names.length === 1 ? `${names[0]} curtiu ${what}.` : names.length <= 3 ? `${listNames(names)} curtiram ${what}.` : `${names.length} pessoas curtiram ${what}.`;
      },
      petiscoReceivedTitle: 'Petisco na conta',
      petiscoReceived: (kind: 'cashback' | 'bonus', n: number) =>
        kind === 'cashback' ? (n === 1 ? 'A Paçoca te devolveu um petisco!' : `A Paçoca te devolveu ${petiscoCount(n)}!`) : `A Paçoca te deu ${petiscoCount(n)} de bônus!`,
      petiscoExpiringTitle: 'Petisco vencendo',
      petiscoExpiring: (n: number) => `${n === 1 ? 'Um petisco vence' : `${petiscoCount(n)} vencem`} em 7 dias. Bora pedir alguma coisa?`,
      monthlyRenewedTitle: 'Petiscos renovados',
      monthlyRenewed: (n: number) => `Mês novo, ${petiscoCount(n)} novinhos pra pedir.`,
      thankedTitle: 'Obrigada, Paçoca',
      thanked: (name: string, title: string) => `${name} agradeceu por ${title}. A Paçoca abanou o rabo!`,
      webhookFailedTitle: 'O servidor de casa tropeçou',
      webhookFailed: (detail: string) => `O Jellyseerr mandou um aviso que a Paçoca não entendeu: ${detail}`,
      inheritanceOfferTitle: 'Quer herdar um pedido?',
      inheritanceOffer: (title: string) => `O pedido de ${title} foi cancelado. Você também queria: fica com ele?`,
      dailyDigestTitle: 'Resumo do dia',
      dailyDigest: (titles: readonly string[]) =>
        titles.length === 1 ? `1 pedido novo hoje: ${titles[0]}.` : `${titles.length} pedidos novos hoje: ${listNames(titles.slice(0, 5))}${titles.length > 5 ? ' e mais' : ''}.`,
    },
  },
} as const;
