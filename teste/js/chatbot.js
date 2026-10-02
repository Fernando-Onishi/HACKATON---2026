const cannedQuestions = [
  { topic: 'Treino', text: 'Qual é meu treino da semana?' },
  { topic: 'Treino', text: 'Como posso progredir sem aumentar muito a carga?' },
  { topic: 'Treino', text: 'Quero trocar um exercício.' },
  { topic: 'Alimentação', text: 'Como posso organizar minha alimentação?' },
  { topic: 'Alimentação', text: 'Quantas calorias tem minha meta?' },
  { topic: 'Progresso', text: 'Quero ver meu progresso.' },
  { topic: 'Motivação', text: 'Estou desmotivado hoje.' },
  { topic: 'Motivação', text: 'Como começo se estou sem tempo?' },
  { topic: 'Recuperação', text: 'Preciso descansar hoje?' },
  { topic: 'Motivação', text: 'Tive uma semana difícil. E agora?' }
];

const cannedReplies = {
  greeting: 'Oi! Estou aqui com respostas e orientações prontas, sem IA ou API. Escolha uma pergunta rápida ou escreva sobre treino, alimentação, progresso, motivação ou rotina.',
  empathy: 'Isso é completamente normal. Você não está só: manter uma rotina tem altos e baixos. Hoje, escolha uma ação pequena e possível, sem tentar compensar ou fazer tudo de uma vez.',
  time: 'Quando o tempo aperta, uma sessão curta e planejada já ajuda a manter o hábito. Escolha o próximo treino da sua divisão, faça os movimentos principais com calma e deixe o restante para outro dia. Consistência vale mais que perfeição.',
  workout: (profile, state) => `Sua divisão atual é ${state.template || 'Full Body'} e o foco cadastrado é ${profile.goal || 'condicionamento'}. O próximo treino está pré-montado na aba Treinos. Marque cada exercício concluído; não precisa cadastrar movimentos manualmente.`,
  exercise: 'Você pode escolher uma alternativa equivalente no cartão do exercício na aba Treinos. Se estiver em dúvida sobre técnica, desconforto ou carga, interrompa o movimento e procure a orientação de um profissional.',
  nutrition: (profile, state) => `Seu plano de hoje usa a meta estimada de ${Number(profile.calorieTarget || 0).toLocaleString('pt-BR')} kcal${profile.foodStyle ? ` e considera sua preferência ${profile.foodStyle}` : ''}. As porções e calorias são aproximações para organização, não uma prescrição. Veja as opções na aba Alimentação e escolha alimentos que façam sentido para você.`,
  progress: (profile, state) => {
    const checkins = state.checkins || [];
    const sessions = (state.completedExercises || []).filter((item) => item.date === new Date().toISOString().slice(0, 10)).length;
    return `Seu objetivo atual é ${profile.goal || 'melhorar a rotina'}${profile.goalWeight ? `, com meta de ${Number(profile.goalWeight).toLocaleString('pt-BR')} kg` : ''}. Você já registrou ${checkins.length} check-ins e concluiu ${sessions} exercício(s) hoje. Acompanhe tendências ao longo das semanas; o peso de um único dia não conta a história toda.`;
  },
  motivation: 'Um dia difícil não apaga o que você já construiu. Faça uma versão menor do seu plano: uma caminhada curta, uma refeição organizada ou alguns minutos de movimento. Você pode recomeçar na próxima escolha.',
  recovery: 'Descanso faz parte do treino. Se estiver muito cansado, com dor ou indisposto, priorize recuperação e não tente compensar com volume extra. Persistência também é saber ajustar.',
  fallback: 'Posso ajudar com respostas prontas sobre treino, alimentação, progresso, motivação e falta de tempo. Toque em uma das perguntas rápidas para ver uma orientação específica.'
};

export function getCannedQuestions() {
  return cannedQuestions.map((question) => ({ ...question }));
}

export function getCannedReply(message, profile = {}, state = {}) {
  const text = String(message || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/oi|ola|bom dia|boa tarde|boa noite|ajuda/.test(text)) return cannedReplies.greeting;
  if (/sem tempo|tempo|rotina|trabalho|corrid/.test(text)) return cannedReplies.time;
  if (/desmotiv|desanima|desist|dificuldade|ansios|nao consigo|não consigo|sozinh|culpa|escap/.test(text)) return cannedReplies.empathy;
  if (/motiva|comec|comecar|começ|recomec|hoje/.test(text)) return cannedReplies.motivation;
  if (/cansad|descans|recuper|dor|indispost/.test(text)) return cannedReplies.recovery;
  if (/trocar|substitut|alternativ|exercicio|exercício/.test(text)) return cannedReplies.exercise;
  if (/dieta|aliment|refeic|refeiç|caloria|comer|comida|prote/.test(text)) return cannedReplies.nutrition(profile, state);
  if (/progres|peso|meta|evolu|resultado/.test(text)) return cannedReplies.progress(profile, state);
  if (/treino|muscul|forca|full body|a\/b|carga|progredir/.test(text)) return cannedReplies.workout(profile, state);
  return cannedReplies.fallback;
}
