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
    devTitle: 'Entrar sem Google (só para testes neste computador)',
    devEmail: 'E-mail',
    devName: 'Nome',
    devButton: 'Entrar para testar',
    devHint: 'Precisa de DEV_SIGN_IN=1 no .dev.vars. As mesmas regras de convite valem.',
    devOff: 'O login de teste está desligado. Põe DEV_SIGN_IN=1 no .dev.vars e reinicia o servidor.',
  },

  nav: {
    feed: 'Feed',
    invites: 'Convites',
    members: 'Membros',
    profile: 'Perfil',
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
} as const;
