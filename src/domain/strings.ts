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
  },

  nav: {
    feed: 'Feed',
    invites: 'Convites',
    signOut: 'Sair',
  },

  feed: {
    title: 'Feed',
    empty: 'Nada por aqui ainda. A Paçoca está de orelha em pé.',
    memberJoined: (name: string) => `${name} entrou no grupo`,
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
