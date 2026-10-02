import { renderTraining, templatePlans, volumeOf, weeklyVolume } from './treino.js?v=video-actions-grid-v2';
import { addMeal, calculateFoodPortion, dailyTotals, getFoodCatalog, getSuggestions, renderDiet } from './dieta.js?v=nutrition-delete-only-v1';
import { mountInsightsChart, renderInsights } from './insights.js?v=streak-achievements';
import { analyzeExerciseVideo, cancelExerciseAnalysis, getSavedAnalysis, removeSavedAnalysis, removeSavedAnalyses } from './poseAnalyzer.js?v=mediapipe-video-reliability';
import { deleteVideoBlob, getVideoBlob, saveVideoBlob } from './storageManager.js?v=exercise-video-actions';
import { getCannedQuestions, getCannedReply } from './chatbot.js';

const brandAssetUrl = new URL('../img/fatfit-removebg-preview.png', import.meta.url).href;
const hostedBrandFallbackUrl = 'https://i.ibb.co/3mLM7ggc/logo1.png';
let auth = null;
let authReady = Promise.resolve();
let authApi = null;
let firebaseDataApi = null;
let firebaseInitializationError = null;

const today = () => new Date().toISOString().slice(0, 10);
const shiftDate = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const initialState = () => ({
  profile: { name: 'Atleta Fat Fit', currentWeight: 78.4, goalWeight: 74, calorieTarget: 2200, updatedAt: today(), goal: 'perder peso', difficulties: 'falta de tempo', foodStyle: 'omnívoro', activityLevel: 'leve', trainingDays: 3, support: 'em casa', motivation: 'mais energia', progressMeasure: 'força e disposição' },
  template: 'Full Body',
  trainingDay: 'Full Body',
  authSession: null,
  isAuthenticated: false,
  authMode: 'login',
  chatHistory: [
    { role: 'assistant', text: 'Oi! Aqui você encontra orientações prontas sobre treino, alimentação, motivação e progresso. Escolha uma pergunta rápida para começar.' }
  ],
  workouts: [
    { id: 'demo-w1', name: 'Agachamento livre', group: 'Quadríceps', equipment: 'Barra', sets: 4, reps: 8, load: 50, date: shiftDate(-6) },
    { id: 'demo-w2', name: 'Supino reto', group: 'Peito', equipment: 'Barra', sets: 4, reps: 8, load: 35, date: shiftDate(-4) },
    { id: 'demo-w3', name: 'Remada curvada', group: 'Costas', equipment: 'Barra', sets: 3, reps: 10, load: 30, date: shiftDate(-2) }
  ],
  completedExercises: [],
  meals: [
    { id: 'demo-m1', name: 'Iogurte natural com aveia', type: 'Café da manhã', calories: 350, date: today(), time: '08:15' },
    { id: 'demo-m2', name: 'Arroz, feijão e frango grelhado', type: 'Almoço', calories: 680, date: today(), time: '12:40' },
    { id: 'demo-m3', name: 'Fruta da estação', type: 'Lanche', calories: 140, date: shiftDate(-1), time: '16:10' }
  ],
  weightHistory: [{ date: shiftDate(-6), weight: 79 }, { date: shiftDate(-3), weight: 78.7 }, { date: today(), weight: 78.4 }],
  checkins: [shiftDate(-6), shiftDate(-4), shiftDate(-2)],
  suggestions: null
});

function emptyUserState(profile = initialState().profile) {
  const userState = initialState();
  userState.profile = { ...userState.profile, ...profile };
  userState.workouts = [];
  userState.completedExercises = [];
  userState.meals = [];
  userState.weightHistory = [{ date: today(), weight: Number(userState.profile.currentWeight) }];
  userState.checkins = [];
  return userState;
}

let state = initialState();
const videoValidationRequests = new Map();
const previewObjectUrls = new Map();
let trainingRestoreRequest = 0;
let authFlowInProgress = false;
let syncFailed = false;
let lastSaveError = null;
let authLoadError = '';
const legacyStateKey = 'fatfit-state-v1';
const pendingStateKey = (userId) => `fatfit-pending-state-${userId}`;
const cachedStateKey = (userId) => `fatfit-user-state-${userId}`;
let legacyAccountEmail = '';
try {
  legacyAccountEmail = String(JSON.parse(localStorage.getItem('fatfit-user') || '{}').email || '').trim().toLowerCase();
} catch { /* Ignore invalid legacy account data. */ }
localStorage.removeItem('fatfit-user');

function legacyStateForEmail(email, remoteStateExists = false) {
  let legacyState;
  try { legacyState = JSON.parse(localStorage.getItem(legacyStateKey) || 'null'); } catch { return null; }
  if (!legacyState) return null;

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const previousOwner = legacyAccountEmail || 'uma conta não identificada';
  const message = remoteStateExists
    ? `Encontramos uma cópia local antiga associada a ${previousOwner}. Deseja usá-la para substituir os dados na nuvem da conta ${email}?`
    : `Encontramos dados antigos associados a ${previousOwner}. Deseja importá-los para ${email}?`;
  if (legacyAccountEmail !== normalizedEmail || remoteStateExists) {
    if (!confirm(message)) return null;
  }
  legacyAccountEmail = normalizedEmail;
  return legacyState;
}

function clearLegacyStateForEmail(email) {
  if (legacyAccountEmail !== String(email || '').trim().toLowerCase()) return;
  localStorage.removeItem(legacyStateKey);
  legacyAccountEmail = '';
}

function readPendingState(userId) {
  try { return JSON.parse(localStorage.getItem(pendingStateKey(userId)) || 'null'); } catch { return null; }
}

function clearPendingState(userId) {
  try { localStorage.removeItem(pendingStateKey(userId)); } catch { /* Ignore unavailable browser storage. */ }
}

function readCachedUserState(userId) {
  try { return JSON.parse(localStorage.getItem(cachedStateKey(userId)) || 'null'); } catch { return null; }
}

function cacheUserState(userId, userState) {
  try { localStorage.setItem(cachedStateKey(userId), JSON.stringify(userState)); } catch { /* Firestore remains the durable source of truth. */ }
}

function clearCachedUserState(userId) {
  try { localStorage.removeItem(cachedStateKey(userId)); } catch { /* Ignore unavailable browser storage. */ }
}

let toastTimer;
const viewRoot = document.getElementById('viewRoot');
const titles = { dashboard: 'Visão geral', treinos: 'Treinos', dieta: 'Alimentação', insights: 'Insights', perfil: 'Meu perfil', chat: 'Coach Fat Fit' };

async function save() {
  const user = auth?.currentUser;
  if (!user) return false;

  syncFailed = false;
  lastSaveError = null;
  const syncStatus = document.getElementById('syncStatus');
  if (syncStatus) syncStatus.innerHTML = '<i></i> Salvando...';
  const { authSession, isAuthenticated, authMode, ...userState } = state;
  cacheUserState(user.uid, userState);
  try { localStorage.setItem(pendingStateKey(user.uid), JSON.stringify(userState)); } catch { /* Keep the Firebase write as the source of truth. */ }
  try {
    await firebaseDataApi.saveUserState(user.uid, userState);
    clearPendingState(user.uid);
    if (syncStatus) syncStatus.innerHTML = '<i></i> Atualizado';
    return true;
  } catch (error) {
    syncFailed = true;
    lastSaveError = error;
    if (syncStatus) syncStatus.innerHTML = '<i></i> Falha ao salvar';
    console.error('Firebase state save failed:', error);
    return false;
  }
}

async function saveAndRender(successMessage) {
  const saved = await save();
  render();
  notify(saved ? successMessage : authErrorMessage(lastSaveError || {}));
  return saved;
}

function beginAuthenticatedSession(user) {
  authLoadError = '';
  syncFailed = false;
  lastSaveError = null;
  const defaults = emptyUserState({ name: user.displayName || initialState().profile.name });
  const pendingState = readPendingState(user.uid);
  const cachedState = readCachedUserState(user.uid);
  state = {
    ...defaults,
    ...(pendingState || cachedState || {}),
    profile: { ...defaults.profile, ...((pendingState || cachedState)?.profile || {}) },
    authSession: { user: { email: user.email } },
    isAuthenticated: true,
    authMode: 'login'
  };
  render();
}

async function applyAuthenticatedUser(user, legacyState = null) {
  beginAuthenticatedSession(user);
  const remoteState = await firebaseDataApi.loadUserState(user.uid);
  authLoadError = '';
  syncFailed = false;
  lastSaveError = null;
  const pendingState = readPendingState(user.uid);
  const cachedState = readCachedUserState(user.uid);
  const restorePendingState = Boolean(pendingState && (!remoteState || confirm('Há dados deste usuário aguardando sincronização neste dispositivo. Deseja enviá-los para substituir a versão atual na nuvem?')));
  if (pendingState && remoteState && !restorePendingState) clearPendingState(user.uid);
  const matchingLegacyState = legacyState || (!pendingState && !cachedState ? legacyStateForEmail(user.email, Boolean(remoteState)) : null);
  const loadedState = restorePendingState ? pendingState : remoteState || cachedState || matchingLegacyState || emptyUserState({ name: user.displayName || initialState().profile.name });
  const hasSavedMealPlan = Array.isArray(loadedState.suggestions) && loadedState.suggestions.length === 4 && loadedState.suggestions.every((item) => Array.isArray(item.portions));
  state = {
    ...initialState(),
    ...loadedState,
    profile: { ...initialState().profile, ...loadedState.profile },
    authSession: { user: { email: user.email } },
    isAuthenticated: true,
    authMode: 'login'
  };
  if (!hasSavedMealPlan) state.suggestions = getSuggestions(state);

  if (remoteState && !restorePendingState && !matchingLegacyState) {
    const { authSession, isAuthenticated, authMode, ...userState } = state;
    cacheUserState(user.uid, userState);
  }

  if (!remoteState || matchingLegacyState || restorePendingState || !hasSavedMealPlan) {
    if (!(await save())) throw lastSaveError || new Error('Não foi possível criar seus dados no Firestore.');
    if (matchingLegacyState) clearLegacyStateForEmail(user.email);
  }
  render();
}

function calculateAge(birthDate) {
  const birthday = new Date(`${birthDate}T00:00:00`);
  if (!birthDate || Number.isNaN(birthday.getTime()) || birthday > new Date()) throw new Error('Informe uma data de nascimento válida, que não esteja no futuro.');
  const now = new Date();
  let age = now.getFullYear() - birthday.getFullYear();
  if (now.getMonth() < birthday.getMonth() || (now.getMonth() === birthday.getMonth() && now.getDate() < birthday.getDate())) age -= 1;
  if (age < 18 || age > 100) throw new Error('Este plano automático é voltado a adultos entre 18 e 100 anos.');
  return age;
}

function calculateCalorieTarget({ weight, height, age, goal, sex, activityLevel }) {
  const sexAdjustment = sex === 'masculino' ? 5 : sex === 'feminino' ? -161 : -78;
  const base = 10 * Number(weight) + 6.25 * Number(height) - 5 * Number(age) + sexAdjustment;
  const activityMultiplier = { sedentário: 1.2, leve: 1.375, moderado: 1.5, alto: 1.65 }[activityLevel] || 1.2;
  const maintenance = base * activityMultiplier;
  const goalLabel = String(goal || '').toLowerCase();
  const target = goalLabel.includes('ganhar') || goalLabel.includes('massa') ? maintenance + 200 : goalLabel.includes('manter') || goalLabel.includes('performance') ? maintenance : maintenance - 250;
  return Math.round(Math.min(4000, Math.max(1200, target)) / 50) * 50;
}

function suggestedTemplate(goal) {
  const normalized = String(goal || '').toLowerCase();
  if (normalized.includes('ganhar') || normalized.includes('massa')) return 'A/B';
  if (normalized.includes('definir') || normalized.includes('emagrecer') || normalized.includes('perder')) return 'A/B/C';
  return 'Full Body';
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function notify(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function setAuthFeedback(message) {
  const feedback = document.getElementById('authFeedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.hidden = !message;
}

function authErrorMessage(error) {
  const messages = {
    'auth/email-already-in-use': 'Este e-mail já possui uma conta. Entre em vez de criar outra.',
    'auth/invalid-credential': 'E-mail ou senha incorretos. Contas antigas que existiam só neste navegador precisam ser cadastradas novamente.',
    'auth/invalid-login-credentials': 'E-mail ou senha incorretos. Contas antigas que existiam só neste navegador precisam ser cadastradas novamente.',
    'auth/user-not-found': 'Não existe uma conta com esse e-mail.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'Informe um endereço de e-mail válido.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/operation-not-allowed': 'O acesso por e-mail e senha não está habilitado para este aplicativo.',
    'auth/invalid-api-key': 'A configuração do serviço de autenticação é inválida.',
    'auth/configuration-not-found': 'A configuração do serviço de autenticação não foi encontrada.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
    'auth/network-request-failed': 'Falha de conexão. Verifique a internet e tente novamente.',
    'auth/unauthorized-domain': 'Este domínio ainda não está autorizado no serviço de autenticação.',
    'permission-denied': 'O armazenamento remoto recusou o acesso. Verifique as permissões da conta.',
    'not-found': 'O armazenamento remoto não foi encontrado. Verifique a configuração do serviço.',
    'failed-precondition': 'O armazenamento remoto não está pronto. Verifique a configuração do serviço.',
    'unavailable': 'O serviço remoto está indisponível. Verifique a conexão e tente novamente.',
    'unauthenticated': 'A sessão expirou. Entre novamente na sua conta.'
  };
  return messages[error.code] || error.message || 'Não foi possível autenticar.';
}

function route() {
  return (location.hash.slice(1) || 'dashboard').split('?')[0];
}

function weekStart() {
  const date = new Date();
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function consecutiveCheckinDays(checkins) {
  const ordered = [...new Set(checkins)].sort((a, b) => b.localeCompare(a));
  let count = 0;
  let previousDate = null;
  for (const dateText of ordered) {
    const date = new Date(`${dateText}T00:00:00`);
    const expectedPrevious = previousDate ? new Date(previousDate) : null;
    if (expectedPrevious) expectedPrevious.setDate(expectedPrevious.getDate() - 1);
    if (expectedPrevious && date.getTime() !== expectedPrevious.getTime()) break;
    count += 1;
    previousDate = date;
  }
  return count;
}

function updateShell(active) {
  const pageTitle = document.getElementById('pageTitle');
  const topEyebrow = document.getElementById('topEyebrow');
  const sideName = document.getElementById('sideName');
  const sideAvatar = document.getElementById('sideAvatar');
  const weeklyCount = document.getElementById('weeklyCount');
  const weeklyPrompt = document.getElementById('weeklyPrompt');
  const weeklyProgress = document.getElementById('weeklyProgress');
  const syncStatus = document.getElementById('syncStatus');

  if (pageTitle) pageTitle.textContent = titles[active] || titles.dashboard;
  if (topEyebrow) {
    topEyebrow.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase();
  }

  document.querySelectorAll('[data-route]').forEach((link) => link.classList.toggle('active', link.dataset.route === active));

  const firstName = state.profile.name || 'Atleta Fat Fit';
  if (sideName) sideName.textContent = firstName;
  if (sideAvatar) sideAvatar.textContent = firstName.trim().charAt(0).toUpperCase();

  const checkins = state.checkins.filter((date) => date >= weekStart());
  if (weeklyCount) weeklyCount.innerHTML = `${checkins.length} <small>/ 7 dias</small>`;
  if (weeklyProgress) weeklyProgress.style.width = `${Math.min(100, checkins.length / 7 * 100)}%`;
  if (weeklyPrompt) weeklyPrompt.textContent = checkins.length < 7 ? `${checkins.length} de 7 check-ins nesta semana.` : 'Semana completa. Preserve espaço para recuperação.';
  if (syncStatus) syncStatus.innerHTML = syncFailed ? '<i></i> Falha ao salvar' : '<i></i> Conta ativa';
}

function renderAuthScreen() {
  const isSignup = state.authMode === 'signup';
  return `
    <div class="auth-shell">
      <section class="auth-brand-panel">
        <div class="brand-wrap">
          <div class="brand-lockup">
            <div class="brand-text">FATFIT</div>
            <small>PERFORMANCE CLUB</small>
          </div>
        </div>
        <div class="auth-copy">
          <span class="eyebrow">SEU RITMO. SUA EVOLUÇÃO.</span>
          <h2>Treino, dieta e progresso em uma rotina inteligente.</h2>
          <p>Organize treino, nutrição e metas com um acompanhamento mais realista para o seu nível e objetivo.</p>
        </div>
        <div class="auth-metrics">
          <div><strong>3x</strong><span>mais foco por semana</span></div>
          <div><strong>5</strong><span>dias de evolução</span></div>
          <div><strong>7/7</strong><span>dias para recomeçar</span></div>
        </div>
      </section>
      <section class="auth-card">
        <div class="auth-tabs">
          <button type="button" class="auth-tab ${!isSignup ? 'active' : ''}" data-auth-mode="login">Entrar</button>
          <button type="button" class="auth-tab ${isSignup ? 'active' : ''}" data-auth-mode="signup">Cadastrar</button>
        </div>
        <form id="authForm" class="auth-form">
          <div class="field field-wide">
            <label for="authEmail">E-mail</label>
            <input id="authEmail" name="email" type="email" autocomplete="email" required>
          </div>
          <div class="field field-wide">
            <label for="authPassword">Senha</label>
            <input id="authPassword" name="password" type="password" minlength="6" autocomplete="current-password" required>
          </div>
          ${isSignup ? `
            <section class="signup-section"><h3>01 · Seu ponto de partida</h3><div class="field-two">
              <div class="field"><label for="signupName">Como podemos chamar você?</label><input id="signupName" name="name" maxlength="50" autocomplete="name" required></div>
              <div class="field"><label for="signupBirthDate">Data de nascimento</label><input id="signupBirthDate" name="birthDate" type="date" min="1900-01-01" max="${today()}" required></div>
              <div class="field"><label for="signupSex">Referência para estimativa energética</label><select id="signupSex" name="sex" required><option value="nao-informado">Prefiro não informar</option><option value="feminino">Feminina</option><option value="masculino">Masculina</option></select></div>
              <div class="field"><label for="signupWeight">Peso atual (kg)</label><input id="signupWeight" name="currentWeight" type="number" min="30" max="300" step="0.1" required></div>
              <div class="field"><label for="signupHeight">Altura (cm)</label><input id="signupHeight" name="height" type="number" min="120" max="220" required></div>
              <div class="field"><label for="signupGoalWeight">Meta de peso (kg)</label><input id="signupGoalWeight" name="goalWeight" type="number" min="30" max="300" step="0.1" required></div>
              <div class="field field-wide"><label for="signupGoal">O que você quer priorizar?</label><select id="signupGoal" name="goal" required><option value="" disabled selected>Selecione seu objetivo</option><option value="perder peso">Reduzir peso gradualmente</option><option value="ganhar massa">Ganhar força e massa muscular</option><option value="manter o peso">Manter o peso e criar rotina</option><option value="melhorar a performance">Melhorar condicionamento e performance</option></select></div>
            </div></section>
            <section class="signup-section"><h3>02 · Sua rotina</h3><div class="field-two">
              <div class="field"><label for="signupActivity">Como é sua atividade no dia a dia?</label><select id="signupActivity" name="activityLevel"><option value="sedentário">Mais sentado(a)</option><option value="leve" selected>Leve: caminho um pouco</option><option value="moderado">Moderada: me movimento bastante</option><option value="alto">Alta: rotina fisicamente ativa</option></select></div>
              <div class="field"><label for="signupTrainingDays">Quantos dias quer treinar?</label><select id="signupTrainingDays" name="trainingDays"><option value="2">2 dias</option><option value="3" selected>3 dias</option><option value="4">4 dias</option><option value="5">5 dias</option></select></div>
              <div class="field"><label for="signupFoodStyle">Preferência alimentar</label><select id="signupFoodStyle" name="foodStyle"><option value="omnívoro">Como de tudo</option><option value="vegetariano">Vegetariana</option><option value="vegano">Vegana</option></select></div>
              <div class="field"><label for="signupSchedule">Qual horário costuma funcionar?</label><select id="signupSchedule" name="schedule"><option>Manhã</option><option>Horário de almoço</option><option>Fim de tarde</option><option>Noite</option><option>Varia a cada dia</option></select></div>
              <div class="field field-wide"><label for="signupDifficulties">O que mais dificulta sua rotina hoje?</label><textarea id="signupDifficulties" name="difficulties" rows="2" maxlength="200" placeholder="Ex.: pouco tempo, cansaço, custo ou dificuldade de manter constância..."></textarea></div>
              <div class="field field-wide"><label for="signupFoodContext">Como costuma ser sua alimentação?</label><textarea id="signupFoodContext" name="foodContext" rows="2" maxlength="200" placeholder="Ex.: como com a família, almoço fora, preciso de opções práticas..."></textarea></div>
            </div></section>
            <section class="signup-section"><h3>03 · O que ajuda você a seguir?</h3><div class="field-two">
              <div class="field"><label for="signupSupport">Quem costuma apoiar sua rotina?</label><select id="signupSupport" name="support"><option value="em casa">Pessoas de casa</option><option value="amigos">Amigos ou colegas</option><option value="profissional">Profissional de saúde ou treinador</option><option value="por conta própria">Estou começando por conta própria</option></select></div>
              <div class="field"><label for="signupMotivation">O que mais motiva você?</label><select id="signupMotivation" name="motivation"><option>Mais energia</option><option>Saúde e bem-estar</option><option>Força e disposição</option><option>Sentir-me bem comigo</option><option>Um desafio pessoal</option></select></div>
              <div class="field field-wide"><label for="signupProgressMeasure">Como prefere perceber progresso?</label><select id="signupProgressMeasure" name="progressMeasure"><option>Força e disposição</option><option>Constância na rotina</option><option>Medidas e roupas</option><option>Peso ao longo do tempo</option><option>Bem-estar geral</option></select></div>
            </div></section>
            <p class="form-hint">Seu plano é uma sugestão geral baseada nas suas respostas. As estimativas não substituem orientação de nutricionista ou profissional de educação física.</p>
          ` : ''}
          <p class="form-hint" id="authFeedback" role="alert" aria-live="assertive" hidden></p>
          <button type="submit" class="button button-block">${isSignup ? 'Criar conta e continuar' : 'Entrar'}</button>
        </form>
      </section>
    </div>
  `;
}

function renderChat() {
  const entries = state.chatHistory || [];
  const questions = getCannedQuestions();
  return `
    <div class="page-intro"><div><span class="eyebrow">APOIO PARA SUA ROTINA</span><h2>Coach Fat Fit</h2><p>Escolha uma mensagem pronta para receber uma orientação sobre seu plano.</p></div><span class="tag">Respostas offline</span></div>
    <section class="chat-shell panel">
      <div class="chat-history" id="chatHistory" aria-live="polite" aria-label="Conversa com o Coach Fat Fit">
        ${entries.map((entry, index) => `
          <article class="chat-bubble ${entry.role === 'user' ? 'user' : 'assistant'}${index === entries.length - 1 ? ' latest' : ''}">
            <strong>${entry.role === 'user' ? 'Você' : 'Coach Fat Fit'}</strong>
            <p>${escapeHTML(entry.text)}</p>
          </article>
        `).join('')}
      </div>
      <div class="chat-prompt-picker">
        <button type="button" class="chat-prompt-toggle" id="chatPromptToggle" data-action="toggle-chat-prompts" aria-expanded="false" aria-controls="chatPromptList"><span class="chat-prompt-toggle-icon" aria-hidden="true">+</span><span>Ver mensagens prontas</span><small>${questions.length}</small></button>
        <div class="chat-prompt-list" id="chatPromptList" hidden>${questions.map((question) => `<button type="button" class="chat-prompt" data-coach-prompt="${escapeHTML(question.text)}"><span>${escapeHTML(question.topic)}</span><strong>${escapeHTML(question.text)}</strong><b aria-hidden="true">→</b></button>`).join('')}</div>
      </div>
    </section>
  `;
}

function appendChatBubble(history, entry, latest = false) {
  const bubble = document.createElement('article');
  bubble.className = `chat-bubble ${entry.role === 'user' ? 'user' : 'assistant'}${latest ? ' latest' : ''}`;
  const speaker = document.createElement('strong');
  speaker.textContent = entry.role === 'user' ? 'Você' : 'Coach Fat Fit';
  const message = document.createElement('p');
  message.textContent = entry.text;
  bubble.append(speaker, message);
  history.append(bubble);
  return bubble;
}

async function sendCannedQuestion(question) {
  const history = document.getElementById('chatHistory');
  if (!history) return;
  const userEntry = { role: 'user', text: question };
  const replyEntry = { role: 'assistant', text: getCannedReply(question, state.profile, state) };
  state.chatHistory = [...(state.chatHistory || []), userEntry, replyEntry];
  history.querySelector('.latest')?.classList.remove('latest');
  appendChatBubble(history, userEntry);
  appendChatBubble(history, replyEntry, true);
  const promptList = document.getElementById('chatPromptList');
  const toggle = document.getElementById('chatPromptToggle');
  if (promptList && toggle) {
    promptList.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.querySelector('.chat-prompt-toggle-icon').textContent = '+';
  }
  requestAnimationFrame(() => {
    history.scrollTo({ top: history.scrollHeight, behavior: 'smooth' });
  });
  const saved = await save();
  notify(saved ? 'Resposta pronta adicionada à conversa.' : authErrorMessage(lastSaveError || {}));
}

function renderDashboard() {
  const total = dailyTotals(state);
  const weight = Number(state.profile.currentWeight) || 0;
  const goal = Number(state.profile.goalWeight) || 0;
  const workoutsThisWeek = state.workouts.filter((item) => item.date >= weekStart()).length;
  const latest = state.workouts.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastVolume = latest ? volumeOf(latest) : 0;
  const remaining = Math.max(0, goal ? weight - goal : 0).toFixed(1);

  return `<section class="hero"><div class="hero-copy"><span class="eyebrow">TREINO INTELIGENTE · RESULTADOS REAIS</span><h2>SEU RITMO.<br><span>SUA EVOLUÇÃO.</span></h2><p>Treino e alimentação conectados para você enxergar o que funciona na sua rotina.</p><button class="button" data-route="treinos">Começar um treino <span>→</span></button></div><div class="hero-stats"><div class="hero-stat"><strong>${workoutsThisWeek}</strong><small>treinos na semana</small></div><div class="hero-stat"><strong>${lastVolume.toLocaleString('pt-BR')}</strong><small>kg · último volume</small></div></div></section>
    <div class="section-heading"><div><h2>Seu resumo</h2><p>Um retrato simples do seu momento.</p></div><button class="link-button" data-route="insights">Ver insights →</button></div>
    <section class="metrics-grid"><article class="metric-card"><div class="metric-top">Peso atual <span class="metric-icon">⌁</span></div><div class="metric-value">${weight.toLocaleString('pt-BR')} <small>kg</small></div><div class="metric-note">${remaining > 0 ? `${remaining} kg até sua meta` : 'Meta atingida ou não definida'}</div></article><article class="metric-card"><div class="metric-top">Calorias hoje <span class="metric-icon">◉</span></div><div class="metric-value">${total.consumed.toLocaleString('pt-BR')} <small>/ ${total.target.toLocaleString('pt-BR')} kcal</small></div><div class="metric-note">Balanço líquido: ${total.balance > 0 ? '+' : ''}${total.balance.toLocaleString('pt-BR')} kcal</div></article><article class="metric-card"><div class="metric-top">Volume na semana <span class="metric-icon">↗</span></div><div class="metric-value">${weeklyVolume(state).toLocaleString('pt-BR')} <small>kg</small></div><div class="metric-note">${workoutsThisWeek} exercícios registrados</div></article><article class="metric-card"><div class="metric-top">Meta semanal <span class="metric-icon">✓</span></div><div class="metric-value">${state.checkins.filter((date) => date >= weekStart()).length} <small>/ 7 dias</small></div><div class="progress-track" style="margin-top:8px"><span style="width:${Math.min(100, state.checkins.filter((date) => date >= weekStart()).length / 7 * 100)}%"></span></div></article></section>
    <div class="section-heading"><div><h2>Visão integrada</h2><p>Treino e alimentação dos últimos dias.</p></div></div><div class="content-grid"><section class="panel"><div class="panel-head"><div><h3>Volume de treino</h3><p>Registros dos últimos 7 dias</p></div><span class="tag">${workoutsThisWeek} sessões</span></div><div class="chart-wrap"><canvas id="dashboardChart" role="img" aria-label="Gráfico do volume de treino por dia"></canvas></div></section><section class="panel"><div class="panel-head"><div><h3>Refeições de hoje</h3><p>${total.consumed.toLocaleString('pt-BR')} kcal registradas</p></div><button class="link-button" data-route="dieta">Adicionar →</button></div>${state.meals.filter((meal) => meal.date === today()).length ? `<div class="meal-list">${state.meals.filter((meal) => meal.date === today()).slice(0, 4).map((meal) => `<div class="list-row"><span class="list-icon">◉</span><span class="row-main"><strong>${escapeHTML(meal.name)}</strong><small>${escapeHTML(meal.type)}</small></span><span class="row-value">${Number(meal.calories).toLocaleString('pt-BR')}<small>kcal</small></span></div>`).join('')}</div>` : '<div class="empty-state">Registre sua primeira refeição hoje.</div>'}</section></div>
    <div class="section-heading"><div><h2>Suas conquistas</h2><p>Pequenos marcos que mostram sua consistência.</p></div></div><div class="badges-row"><span class="badge ${state.workouts.length ? '' : 'locked'}">⚡ Primeiro Treino</span><span class="badge ${consecutiveCheckinDays(state.checkins) >= 5 ? '' : 'locked'}">🔥 Sequência 5 Dias</span><span class="badge ${consecutiveCheckinDays(state.checkins) >= 7 ? '' : 'locked'}">🏆 Semana Perfeita</span></div>`;
}

function profileOptions(options, selectedValue) {
  return options.map(([value, label]) => `<option value="${escapeHTML(value)}"${value === selectedValue ? ' selected' : ''}>${escapeHTML(label)}</option>`).join('');
}

function renderProfile() {
  const profile = state.profile;
  return `<div class="page-intro"><div><span class="eyebrow">SEU PONTO DE PARTIDA</span><h2>Perfil e metas</h2><p>Suas respostas orientam os planos e a biblioteca do coach.</p></div></div>
    <section class="profile-summary"><span class="avatar">${escapeHTML((profile.name || 'A').charAt(0).toUpperCase())}</span><div><h2>${escapeHTML(profile.name || 'Atleta Fat Fit')}</h2><p>Preferências da sua conta</p></div></section>
    <section class="panel form-panel"><div class="panel-head"><div><h3>Dados, rotina e objetivos</h3><p>A meta calórica é uma estimativa geral calculada com suas respostas.</p></div></div>
      <form id="profileForm" class="form-grid two">
        <div class="field"><label for="profileName">Nome</label><input id="profileName" name="name" value="${escapeHTML(profile.name)}" maxlength="50" required></div>
        <div class="field"><label for="profileAge">Idade</label><input id="profileAge" name="age" type="number" min="18" max="100" value="${Number(profile.age) || 30}" required></div>
        <div class="field"><label for="profileWeight">Peso atual (kg)</label><input id="profileWeight" name="currentWeight" type="number" min="30" max="300" step="0.1" value="${profile.currentWeight}" required></div>
        <div class="field"><label for="profileHeight">Altura (cm)</label><input id="profileHeight" name="height" type="number" min="120" max="220" value="${Number(profile.height) || 165}" required></div>
        <div class="field"><label for="profileGoalWeight">Meta de peso (kg)</label><input id="profileGoalWeight" name="goalWeight" type="number" min="30" max="300" step="0.1" value="${profile.goalWeight}" required></div>
        <div class="field"><label for="profileCalories">Meta estimada (kcal/dia)</label><input id="profileCalories" name="calorieTarget" type="number" min="1200" max="4000" step="50" value="${profile.calorieTarget}" required></div>
        <div class="field"><label for="profileGoal">Objetivo</label><select id="profileGoal" name="goal">${profileOptions([['perder peso', 'Reduzir peso gradualmente'], ['ganhar massa', 'Ganhar força e massa muscular'], ['manter o peso', 'Manter o peso e criar rotina'], ['melhorar a performance', 'Melhorar condicionamento e performance']], profile.goal)}</select></div>
        <div class="field"><label for="profileSex">Referência energética</label><select id="profileSex" name="sex">${profileOptions([['nao-informado', 'Prefiro não informar'], ['feminino', 'Feminina'], ['masculino', 'Masculina']], profile.sex || 'nao-informado')}</select></div>
        <div class="field"><label for="profileActivity">Atividade diária</label><select id="profileActivity" name="activityLevel">${profileOptions([['sedentário', 'Mais sentado(a)'], ['leve', 'Leve'], ['moderado', 'Moderada'], ['alto', 'Alta']], profile.activityLevel || 'leve')}</select></div>
        <div class="field"><label for="profileTrainingDays">Dias de treino por semana</label><select id="profileTrainingDays" name="trainingDays">${profileOptions([['2', '2 dias'], ['3', '3 dias'], ['4', '4 dias'], ['5', '5 dias']], String(profile.trainingDays || 3))}</select></div>
        <div class="field"><label for="profileFoodStyle">Preferência alimentar</label><select id="profileFoodStyle" name="foodStyle">${profileOptions([['omnívoro', 'Como de tudo'], ['vegetariano', 'Vegetariana'], ['vegano', 'Vegana']], profile.foodStyle || 'omnívoro')}</select></div>
        <div class="field"><label for="profileSchedule">Horário mais viável para Treino</label><select id="profileSchedule" name="schedule">${profileOptions(['Manhã', 'Horário de almoço', 'Fim de tarde', 'Noite', 'Varia a cada dia'].map((item) => [item, item]), profile.schedule || 'Manhã')}</select></div>
        <div class="field"><label for="profileSupport">Rede de apoio</label><select id="profileSupport" name="support">${profileOptions([['em casa', 'Pessoas de casa'], ['amigos', 'Amigos ou colegas'], ['profissional', 'Profissional ou treinador'], ['por conta própria', 'Estou começando por conta própria']], profile.support || 'em casa')}</select></div>
        <div class="field"><label for="profileMotivation">Motivação principal</label><input id="profileMotivation" name="motivation" value="${escapeHTML(profile.motivation || '')}" maxlength="80"></div>
        <div class="field"><label for="profileProgressMeasure">Como medir progresso?</label><input id="profileProgressMeasure" name="progressMeasure" value="${escapeHTML(profile.progressMeasure || '')}" maxlength="80"></div>
        <div class="field field-wide"><label for="profileDifficulties">Desafios atuais</label><textarea id="profileDifficulties" name="difficulties" rows="2" maxlength="200">${escapeHTML(profile.difficulties || '')}</textarea></div>
        <div class="field field-wide"><label for="profileFoodContext">Contexto da alimentação</label><textarea id="profileFoodContext" name="foodContext" rows="2" maxlength="200">${escapeHTML(profile.foodContext || '')}</textarea></div>
        <div class="form-actions"><button class="button" type="submit">Salvar e atualizar meu plano</button></div>
      </form><p class="form-hint">Estimativas gerais. Em caso de gestação, condição clínica, histórico de transtorno alimentar ou menoridade, procure orientação profissional antes de ajustar alimentação ou treino.</p>
    </section>`;
}

function renderAccountPanel() {
  const email = state.authSession?.user?.email || '';
  return `<section class="panel account-panel"><div class="panel-head"><div><h3>Conta</h3>${email ? `<p>${escapeHTML(email)}</p>` : ''}</div></div><div class="account-actions"><button class="button secondary" data-action="signout">Sair da conta</button><button class="button danger" data-action="delete-account">Excluir conta</button></div></section>`;
}

function syncBrandAssetUrls() {
  document.querySelectorAll('.brand-mark img, .brand-mark-large img').forEach((image) => {
    if (image.dataset.localLogoFailed) return;
    const useHostedFallback = () => {
      image.dataset.localLogoFailed = 'true';
      image.classList.add('remote-logo-fallback');
      image.onerror = null;
      image.src = hostedBrandFallbackUrl;
      document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((icon) => {
        icon.href = hostedBrandFallbackUrl;
      });
    };
    image.onerror = useHostedFallback;
    if (image.complete && !image.naturalWidth) {
      useHostedFallback();
      return;
    }
    image.src = brandAssetUrl;
  });
  const hasHostedFallback = [...document.querySelectorAll('.brand-mark img, .brand-mark-large img')]
    .some((image) => image.dataset.localLogoFailed === 'true');
  document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((icon) => {
    icon.href = hasHostedFallback ? hostedBrandFallbackUrl : brandAssetUrl;
  });
}

function render() {
  trainingRestoreRequest += 1;
  previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  previewObjectUrls.clear();
  document.body.classList.toggle('auth-mode', !state.isAuthenticated);
  if (!state.isAuthenticated) {
    viewRoot.innerHTML = renderAuthScreen();
    syncBrandAssetUrls();
    return;
  }

  let active = route();
  if (!titles[active]) { active = 'dashboard'; if (location.hash) history.replaceState(null, '', '#dashboard'); }
  updateShell(active);
  viewRoot.innerHTML = active === 'dashboard' ? renderDashboard() : active === 'treinos' ? renderTraining(state) : active === 'dieta' ? renderDiet(state) : active === 'insights' ? renderInsights(state) : active === 'chat' ? renderChat() : renderProfile();
  syncBrandAssetUrls();

  if (active === 'perfil') {
    viewRoot.insertAdjacentHTML('afterbegin', renderAccountPanel());
  }
  if (authLoadError) {
    viewRoot.insertAdjacentHTML('afterbegin', `<section class="panel form-panel" role="alert"><div class="panel-head"><div><h3>Sessão ativa; dados indisponíveis</h3><p>${escapeHTML(authLoadError)}</p></div><button class="button secondary" type="button" data-action="retry-auth-load">Tentar novamente</button></div></section>`);
  }
  if (active === 'dashboard') mountDashboardChart();
  if (active === 'insights') mountInsightsChart();
  if (active === 'treinos') void restoreTrainingAnalyses(trainingRestoreRequest);
  if (active === 'dieta') void populateFoodCatalog();
}

function mountDashboardChart() {
  const canvas = document.getElementById('dashboardChart');
  if (!canvas || !window.Chart) return;
  const labels = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return date; });
  const values = labels.map((date) => { const key = date.toISOString().slice(0, 10); return state.workouts.filter((item) => item.date === key).reduce((sum, item) => sum + volumeOf(item), 0); });
  if (window.fatFitChart) window.fatFitChart.destroy();
  window.fatFitChart = new window.Chart(canvas, {
    type: 'bar',
    data: { labels: labels.map((date) => date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')), datasets: [{ label: 'Volume (kg)', data: values, backgroundColor: '#e5091490', borderColor: '#e50914', borderWidth: 1, borderRadius: 4 }] },
    options: { maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#141419' } }, scales: { x: { grid: { display: false }, ticks: { color: '#888893', font: { family: 'Outfit' } } }, y: { beginAtZero: true, grid: { color: '#ffffff0c' }, ticks: { color: '#888893', font: { family: 'Outfit' } } } } }
  });
}

async function markCheckin() {
  if (!state.checkins.includes(today())) { state.checkins.push(today()); await saveAndRender('Check-in registrado. Bom trabalho!'); }
  else notify('Seu check-in de hoje já está registrado.');
}

function formValues(form) { return Object.fromEntries(new FormData(form).entries()); }

function normalizeSearch(value) {
  return String(value || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function filterExerciseCatalog() {
  const search = normalizeSearch(document.getElementById('exerciseSearch')?.value);
  const group = document.getElementById('exerciseGroupFilter')?.value || '';
  const selectedPlan = document.querySelector('[data-catalog-plan].active')?.dataset.catalogPlan || 'all';
  const cards = [...document.querySelectorAll('[data-exercise-card]')];
  let visibleCount = 0;

  cards.forEach((card) => {
    const matchesSearch = normalizeSearch(card.dataset.search).includes(search);
    const matchesGroup = !group || card.dataset.group === group;
    const matchesPlan = selectedPlan === 'all' || card.dataset.plans.split('|').includes(selectedPlan);
    const visible = matchesSearch && matchesGroup && matchesPlan;
    card.hidden = !visible;
    if (visible) visibleCount += 1;
  });

  const count = document.getElementById('exerciseResultCount');
  if (count) count.textContent = `${visibleCount} ${visibleCount === 1 ? 'exercício' : 'exercícios'}`;
  const emptyState = document.getElementById('exerciseEmptyState');
  if (emptyState) emptyState.hidden = visibleCount > 0;
}

async function populateFoodCatalog() {
  const hint = document.getElementById('foodNutritionHint');
  if (!hint) return;
  try {
    await getFoodCatalog();
    if (!hint.isConnected) return;
    hint.removeAttribute('data-state');
    hint.textContent = 'Tabela oficial carregada. Pesquise e selecione um alimento para calcular os nutrientes da porção.';
  } catch (error) {
    hint.dataset.state = 'error';
    hint.textContent = `${error.message} O registro de alimentos está temporariamente indisponível.`;
  }
}

async function handleFoodSearchInput() {
  const searchInput = document.getElementById('foodSearchInput');
  const suggestions = document.getElementById('foodSearchSuggestions');
  const portionSection = document.getElementById('foodPortionSection');
  const gramsInput = document.getElementById('foodQuantityGrams');
  const hint = document.getElementById('foodNutritionHint');
  if (!searchInput || !suggestions || !portionSection || !gramsInput || !hint) return;
  delete searchInput.dataset.foodId;
  portionSection.hidden = true;
  gramsInput.disabled = true;
  suggestions.replaceChildren();

  const query = normalizeSearch(searchInput.value.trim());
  if (!query) {
    hint.removeAttribute('data-state');
    hint.textContent = 'Pesquise e selecione um alimento da tabela oficial para informar a porção.';
    return;
  }
  try {
    const foods = await getFoodCatalog();
    if (!searchInput.isConnected || normalizeSearch(searchInput.value.trim()) !== query) return;
    hint.removeAttribute('data-state');
    const matches = foods.filter((food) => normalizeSearch(food.name).includes(query)).slice(0, 8);
    if (!matches.length) {
      const card = document.createElement('div');
      card.className = 'food-not-found-card';
      card.innerHTML = '<div class="not-found-icon">🔎🤖</div><h4>Alimento não encontrado na tabela oficial</h4><p>Para garantir a precisão da sua dieta, não permitimos a inclusão manual de calorias.</p><a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" class="btn-gemini-agent">🤖 Consultar a Tabela no Agente Nutri-IA (Gemini) ↗</a><small class="not-found-tip">Descubra os macros exatos no nosso agente e solicite a inclusão deste alimento na base.</small>';
      suggestions.append(card);
      hint.textContent = 'Nenhum alimento correspondente foi encontrado. A tabela não aceita inclusão manual.';
      return;
    }
    matches.forEach((food) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'food-suggestion';
      option.dataset.foodId = food.id;
      option.textContent = food.name;
      suggestions.append(option);
    });
    hint.removeAttribute('data-state');
    hint.textContent = 'Selecione um resultado para liberar a quantidade em gramas.';
  } catch (error) {
    hint.dataset.state = 'error';
    hint.textContent = error.message;
  }
}

async function updateMealNutritionPreview() {
  const searchInput = document.getElementById('foodSearchInput');
  const gramsInput = document.getElementById('foodQuantityGrams');
  const hint = document.getElementById('foodNutritionHint');
  if (!searchInput?.dataset.foodId || !gramsInput || !hint) return;
  const foodId = searchInput.dataset.foodId;
  const grams = gramsInput.value;
  try {
    const nutrition = await calculateFoodPortion(foodId, grams);
    if (!searchInput.isConnected || searchInput.dataset.foodId !== foodId || gramsInput.value !== grams) return;
    document.getElementById('calculatedKcalDisplay').textContent = `${nutrition.calories} kcal`;
    document.getElementById('calculatedProteinDisplay').textContent = `${nutrition.protein} g`;
    document.getElementById('calculatedCarbsDisplay').textContent = `${nutrition.carbs} g`;
    document.getElementById('calculatedFatDisplay').textContent = `${nutrition.fat} g`;
    hint.removeAttribute('data-state');
    hint.textContent = `Estimativa calculada pela tabela oficial para ${nutrition.grams} g de ${nutrition.food.name}.`;
  } catch (error) {
    hint.dataset.state = 'error';
    hint.textContent = error.message;
  }
}

async function selectCatalogFood(foodId) {
  const searchInput = document.getElementById('foodSearchInput');
  const suggestions = document.getElementById('foodSearchSuggestions');
  const portionSection = document.getElementById('foodPortionSection');
  const gramsInput = document.getElementById('foodQuantityGrams');
  if (!searchInput || !suggestions || !portionSection || !gramsInput) return;
  const foods = await getFoodCatalog();
  const food = foods.find((item) => item.id === foodId);
  if (!food) throw new Error('O alimento selecionado não consta na tabela oficial.');
  searchInput.value = food.name;
  searchInput.dataset.foodId = food.id;
  suggestions.replaceChildren();
  portionSection.hidden = false;
  gramsInput.disabled = false;
  gramsInput.value = '100';
  await updateMealNutritionPreview();
  gramsInput.focus();
}

viewRoot.addEventListener('click', async (event) => {
  const option = event.target.closest('.food-suggestion');
  if (!option) return;
  try {
    await selectCatalogFood(option.dataset.foodId);
  } catch (error) {
    const hint = document.getElementById('foodNutritionHint');
    if (hint) {
      hint.dataset.state = 'error';
      hint.textContent = error.message;
    }
  }
});

async function readTrainingVideoMetadata(file) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  try {
    return await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
      video.onerror = () => reject(new Error('Não foi possível ler os metadados do vídeo.'));
      video.src = objectUrl;
      video.load();
    });
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function feedbackMarkup(markup) {
  const parsed = new DOMParser().parseFromString(markup, 'text/html').body;
  const allowedTags = new Set(['ARTICLE', 'H4', 'P', 'STRONG', 'A']);
  const allowedClasses = new Set(['analysis-feedback', 'correct', 'needs-work', 'analysis-disclaimer']);
  const cleanNode = (node) => {
    [...node.children].forEach((child) => {
      if (!allowedTags.has(child.tagName)) {
        child.replaceWith(document.createTextNode(child.textContent || ''));
        return;
      }
      [...child.attributes].forEach((attribute) => {
        if (attribute.name === 'class') return;
        if (child.tagName === 'A' && attribute.name === 'href') {
          try {
            const url = new URL(attribute.value);
            if (url.origin === 'https://www.google.com' && url.pathname === '/search') return;
          } catch {
            child.removeAttribute(attribute.name);
            return;
          }
        }
        child.removeAttribute(attribute.name);
      });
      if (child.hasAttribute('class')) {
        const classNames = child.className.split(/\s+/).filter((name) => allowedClasses.has(name));
        if (classNames.length) child.className = classNames.join(' ');
        else child.removeAttribute('class');
      }
      if (child.tagName === 'A' && child.hasAttribute('href')) {
        child.target = '_blank';
        child.rel = 'noopener noreferrer';
      }
      cleanNode(child);
    });
  };
  cleanNode(parsed);
  return parsed.innerHTML;
}

function setExercisePreview(exerciseId, blob) {
  const video = document.getElementById(`videoPreview_${exerciseId}`);
  const container = document.getElementById(`videoContainer_${exerciseId}`);
  const actions = document.getElementById(`videoActions_${exerciseId}`);
  if (!video || !container || !actions) return;
  const previousUrl = previewObjectUrls.get(exerciseId);
  if (previousUrl) URL.revokeObjectURL(previousUrl);
  const url = URL.createObjectURL(blob);
  previewObjectUrls.set(exerciseId, url);
  video.src = url;
  container.classList.remove('hidden');
  actions.classList.remove('hidden');
}

async function restoreTrainingAnalyses(requestId) {
  const inputs = [...viewRoot.querySelectorAll('.video-file-input')];
  await Promise.all(inputs.map(async (input) => {
    const exerciseId = input.dataset.exerciseId;
    const output = document.getElementById(`analysisOutput_${exerciseId}`);
    const status = document.getElementById(`videoStatus_${exerciseId}`);
    const analysis = getSavedAnalysis(exerciseId, today());
    if (requestId !== trainingRestoreRequest || !output || !status) return;

    if (analysis) {
      output.innerHTML = feedbackMarkup(analysis.feedbackHTML);
      status.dataset.state = 'success';
      status.textContent = `Análise de hoje restaurada${analysis.exerciseName ? ` · ${analysis.exerciseName}` : ''}.`;
    }
    try {
      const blob = await getVideoBlob(exerciseId);
      if (requestId !== trainingRestoreRequest) return;
      if (!blob) {
        if (analysis) {
          status.dataset.state = 'warning';
          status.textContent = 'Feedback restaurado; o vídeo não está mais disponível neste dispositivo.';
        }
        return;
      }
      setExercisePreview(exerciseId, blob);
      if (!analysis) {
        status.dataset.state = 'success';
        status.textContent = 'Vídeo restaurado deste dispositivo. Envie outro vídeo para substituir.';
      }
    } catch (error) {
      if (requestId !== trainingRestoreRequest) return;
      status.dataset.state = 'error';
      status.textContent = `${analysis ? 'Feedback restaurado, mas ' : ''}não foi possível recuperar o vídeo: ${error.message}`;
      console.error('Training video restore failed:', error);
    }
  }));
}

async function runExerciseVideoAnalysis(file, exerciseId, exerciseName, requestId, prefix = '', preserveFeedback = false) {
  const status = document.getElementById(`videoStatus_${exerciseId}`);
  const output = document.getElementById(`analysisOutput_${exerciseId}`);
  if (!file || !exerciseId || !exerciseName || !status || !output) return;
  status.dataset.state = 'loading';
  status.textContent = `${prefix}Analisando vídeo...`;
  const actionBar = document.getElementById(`videoActions_${exerciseId}`);
  const actionButtons = actionBar?.querySelectorAll('button') || [];
  actionButtons.forEach((button) => { button.disabled = true; });

  try {
    const analysis = await analyzeExerciseVideo(file, { id: exerciseId, name: exerciseName });
    if (videoValidationRequests.get(exerciseId) !== requestId) return;
    const currentOutput = document.getElementById(`analysisOutput_${exerciseId}`);
    const currentStatus = document.getElementById(`videoStatus_${exerciseId}`);
    if (currentOutput && currentStatus) {
      currentOutput.innerHTML = feedbackMarkup(analysis.feedbackHTML);
      currentStatus.dataset.state = 'success';
      currentStatus.textContent = `Análise salva para hoje${file.name ? ` · ${file.name}` : ''}.`;
    }
  } catch (error) {
    if (videoValidationRequests.get(exerciseId) !== requestId) return;
    const currentOutput = document.getElementById(`analysisOutput_${exerciseId}`);
    const currentStatus = document.getElementById(`videoStatus_${exerciseId}`);
    if (!currentOutput || !currentStatus) return;
    if (!preserveFeedback) currentOutput.replaceChildren();
    const notice = document.createElement('p');
    notice.className = 'analysis-error';
    notice.textContent = error.message || 'Não foi possível analisar o vídeo.';
    currentOutput.prepend(notice);
    currentStatus.dataset.state = 'error';
    currentStatus.textContent = `Vídeo mantido neste dispositivo, mas a análise não foi concluída: ${notice.textContent}`;
  } finally {
    if (videoValidationRequests.get(exerciseId) === requestId) {
      actionButtons.forEach((button) => { button.disabled = false; });
    }
  }
}

async function handleExerciseVideoUpload(input) {
  const file = input.files?.[0];
  const exerciseId = input.dataset.exerciseId;
  const exerciseName = input.dataset.exerciseType;
  const status = document.getElementById(`videoStatus_${exerciseId}`);
  if (!file || !exerciseId || !exerciseName || !status) return;

  const requestId = (videoValidationRequests.get(exerciseId) || 0) + 1;
  videoValidationRequests.set(exerciseId, requestId);
  cancelExerciseAnalysis(exerciseId);
  input.value = '';
  status.dataset.state = 'loading';
  status.textContent = 'Verificando o vídeo e salvando neste dispositivo...';

  try {
    if (file.type && !file.type.startsWith('video/')) throw new Error('Selecione um arquivo de vídeo válido.');
    const { duration, width, height } = await readTrainingVideoMetadata(file);
    if (videoValidationRequests.get(exerciseId) !== requestId) return;
    if (!Number.isFinite(duration) || !width || !height) throw new Error('Não foi possível ler os metadados do vídeo.');

    await saveVideoBlob(exerciseId, file);
    if (videoValidationRequests.get(exerciseId) !== requestId) return;
    removeSavedAnalysis(exerciseId, today());
    document.getElementById(`analysisOutput_${exerciseId}`)?.replaceChildren();
    setExercisePreview(exerciseId, file);
    const warnings = [];
    if (duration < 2) warnings.push('Vídeo muito curto. Lembre-se de gravar a série completa com a câmera fixa de lado.');
    if (Math.max(width, height) < 640 || Math.min(width, height) < 360) {
      warnings.push('Resolução baixa. Se possível, grave em pelo menos 640 × 360 para facilitar a identificação das articulações.');
    }
    await runExerciseVideoAnalysis(file, exerciseId, exerciseName, requestId, warnings.length ? `${warnings.join(' ')} ` : '');
  } catch (error) {
    if (videoValidationRequests.get(exerciseId) !== requestId) return;
    status.dataset.state = 'error';
    status.textContent = error.message || 'Não foi possível salvar ou validar este vídeo.';
  }
}

async function reanalyzeExerciseVideo(exerciseId) {
  const input = document.getElementById(`videoInput_${exerciseId}`);
  const status = document.getElementById(`videoStatus_${exerciseId}`);
  if (!input || !status) return;
  const requestId = (videoValidationRequests.get(exerciseId) || 0) + 1;
  videoValidationRequests.set(exerciseId, requestId);
  cancelExerciseAnalysis(exerciseId);
  try {
    const blob = await getVideoBlob(exerciseId);
    if (videoValidationRequests.get(exerciseId) !== requestId) return;
    if (!blob) throw new Error('Não há vídeo salvo para este exercício. Envie um vídeo antes de reanalisar.');
    await runExerciseVideoAnalysis(blob, exerciseId, input.dataset.exerciseType, requestId, 'Reanálise: ', true);
  } catch (error) {
    if (videoValidationRequests.get(exerciseId) !== requestId) return;
    status.dataset.state = 'error';
    status.textContent = error.message || 'Não foi possível recuperar o vídeo para reanálise.';
  }
}

async function removeExerciseVideo(exerciseId) {
  const actions = document.getElementById(`videoActions_${exerciseId}`);
  const card = actions?.closest('.catalog-exercise');
  const status = document.getElementById(`videoStatus_${exerciseId}`);
  const preview = document.getElementById(`videoContainer_${exerciseId}`);
  const video = document.getElementById(`videoPreview_${exerciseId}`);
  const output = document.getElementById(`analysisOutput_${exerciseId}`);
  if (!card || !status || !preview || !video || !output || !actions) return;
  if (!confirm('Remover o vídeo e todas as análises salvas deste exercício?')) return;

  const requestId = (videoValidationRequests.get(exerciseId) || 0) + 1;
  videoValidationRequests.set(exerciseId, requestId);
  cancelExerciseAnalysis(exerciseId);
  const actionButtons = actions.querySelectorAll('button');
  actionButtons.forEach((button) => { button.disabled = true; });
  status.dataset.state = 'loading';
  status.textContent = 'Removendo vídeo e análises salvas...';

  try {
    await deleteVideoBlob(exerciseId);
    removeSavedAnalyses(exerciseId);

    const objectUrl = previewObjectUrls.get(exerciseId);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    previewObjectUrls.delete(exerciseId);
    video.pause();
    video.removeAttribute('src');
    video.load();
    preview.classList.add('hidden');
    output.replaceChildren();
    actions.classList.add('hidden');
    status.removeAttribute('data-state');
    status.textContent = 'Nenhum vídeo enviado.';
  } catch (error) {
    actionButtons.forEach((button) => { button.disabled = false; });
    status.dataset.state = 'error';
    status.textContent = `Não foi possível remover completamente o vídeo e as análises: ${error.message || 'erro desconhecido'}`;
  }
}

viewRoot.addEventListener('input', (event) => {
  if (event.target.id === 'exerciseSearch') filterExerciseCatalog();
  if (event.target.id === 'foodSearchInput') void handleFoodSearchInput();
  if (event.target.id === 'foodQuantityGrams') void updateMealNutritionPreview();
});

viewRoot.addEventListener('change', async (event) => {
  if (event.target.id === 'exerciseGroupFilter') filterExerciseCatalog();
  if (event.target.matches('.video-file-input')) await handleExerciseVideoUpload(event.target);
});

viewRoot.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;

  try {
    if (form.id === 'authForm') {
      const values = formValues(form);
      const isSignup = state.authMode === 'signup';
      const submitButton = form.querySelector('button[type="submit"]');
      authFlowInProgress = true;
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Conectando...';
      }
      setAuthFeedback('');
      await authReady;
      if (!auth || !authApi) throw firebaseInitializationError || new Error('O serviço de login ainda não está disponível.');
      if (isSignup) {
        const weight = Number(values.currentWeight);
        if (!values.email || !values.password || !values.name) throw new Error('Preencha nome, e-mail e senha para continuar.');
        const age = calculateAge(values.birthDate);
        const height = Number(values.height);
        const goalWeight = Number(values.goalWeight);
        if (weight < 30 || weight > 300 || height < 120 || height > 220 || goalWeight < 30 || goalWeight > 300) throw new Error('Confira peso e meta entre 30–300 kg e altura entre 120–220 cm.');

        const profile = {
          name: values.name.trim() || 'Atleta Fat Fit',
          currentWeight: weight,
          goalWeight,
          calorieTarget: calculateCalorieTarget({ weight, height, age, goal: values.goal, sex: values.sex, activityLevel: values.activityLevel }),
          goal: values.goal,
          difficulties: values.difficulties || 'falta de tempo',
          age,
          birthDate: values.birthDate,
          height,
          sex: values.sex,
          activityLevel: values.activityLevel,
          trainingDays: Number(values.trainingDays),
          foodStyle: values.foodStyle,
          schedule: values.schedule,
          foodContext: values.foodContext,
          support: values.support,
          motivation: values.motivation,
          progressMeasure: values.progressMeasure,
          updatedAt: today()
        };

        const legacyState = legacyStateForEmail(values.email);
        const credential = await authApi.createUserWithEmailAndPassword(auth, values.email, values.password);
        await authApi.updateProfile(credential.user, { displayName: profile.name });
        state = {
          ...emptyUserState(profile),
          ...(legacyState || {}),
          profile,
          workouts: legacyState?.workouts || [],
          completedExercises: legacyState?.completedExercises || [],
          meals: legacyState?.meals || [],
          weightHistory: legacyState?.weightHistory || [{ date: today(), weight }],
          checkins: legacyState?.checkins || [],
          template: suggestedTemplate(values.goal),
          trainingDay: templatePlans[suggestedTemplate(values.goal)][0],
          isAuthenticated: true,
          authSession: { user: { email: credential.user.email } },
          chatHistory: [{ role: 'assistant', text: `Isso é completamente normal, ${profile.name}. Você não está só. Seu plano inicial está pronto para ${values.goal.toLowerCase()}, com ${profile.trainingDays} dias de treino e sugestões alimentares ${profile.foodStyle}. Comece aos poucos; você pode ajustar tudo no seu ritmo.` }]
        };
        state.suggestions = getSuggestions(state);
        if (!(await save())) throw lastSaveError || new Error('Não foi possível salvar seu cadastro no Firestore.');
        if (legacyState) clearLegacyStateForEmail(values.email);
        authFlowInProgress = false;
        render();
        notify('Perfil criado e plano personalizado montado.');
        return;
      }

      const credential = await authApi.signInWithEmailAndPassword(auth, values.email, values.password);
      await applyAuthenticatedUser(credential.user);
      authFlowInProgress = false;
      notify('Login realizado com sucesso.');
      return;
    }

    if (form.id === 'mealForm') {
      const searchInput = form.elements.foodSearchInput;
      if (!searchInput?.dataset.foodId) throw new Error('Selecione um alimento encontrado na tabela oficial antes de registrar.');
      await addMeal(state, {
        foodId: searchInput.dataset.foodId,
        grams: form.elements.foodQuantityGrams.value,
        type: form.elements.type.value,
        date: form.elements.date.value
      });
      await saveAndRender('Refeição adicionada ao seu diário.');
      return;
    }

    if (form.id === 'profileForm') {
      const values = formValues(form);
      const age = Number(values.age);
      const weight = Number(values.currentWeight);
      const height = Number(values.height);
      const goalWeight = Number(values.goalWeight);
      const calorieTarget = Number(values.calorieTarget);
      if (![age, weight, height, goalWeight, calorieTarget].every(Number.isFinite)) throw new Error('Confira os dados numéricos do perfil.');
      if (age < 18 || age > 100 || weight < 30 || weight > 300 || height < 120 || height > 220 || goalWeight < 30 || goalWeight > 300 || calorieTarget < 1200 || calorieTarget > 4000) throw new Error('Confira idade (18–100), peso/meta (30–300 kg), altura (120–220 cm) e meta (1.200–4.000 kcal).');

      const profileInputsChanged = age !== Number(state.profile.age) || weight !== Number(state.profile.currentWeight) || height !== Number(state.profile.height) || values.sex !== state.profile.sex || values.activityLevel !== state.profile.activityLevel || values.goal !== state.profile.goal;
      const profile = {
        ...state.profile,
        name: values.name.trim(), age, currentWeight: weight, height, goalWeight,
        sex: values.sex, activityLevel: values.activityLevel, trainingDays: Number(values.trainingDays),
        foodStyle: values.foodStyle, schedule: values.schedule, support: values.support,
        motivation: values.motivation.trim(), progressMeasure: values.progressMeasure.trim(),
        difficulties: values.difficulties.trim(), foodContext: values.foodContext.trim(),
        calorieTarget: profileInputsChanged ? calculateCalorieTarget({ weight, height, age, goal: values.goal, sex: values.sex, activityLevel: values.activityLevel }) : calorieTarget,
        goal: values.goal, updatedAt: today()
      };
      state.profile = profile;
      state.template = suggestedTemplate(profile.goal);
      state.trainingDay = templatePlans[state.template][0];
      state.suggestions = getSuggestions(state);
      state.weightHistory.push({ date: today(), weight });
      await saveAndRender('Perfil e metas atualizados.');
      return;
    }

  } catch (error) {
    authFlowInProgress = false;
    if (form.id === 'authForm') setAuthFeedback(authErrorMessage(error));
    if (form.id === 'authForm' && auth?.currentUser) {
      state.authSession = { user: { email: auth.currentUser.email } };
      state.isAuthenticated = true;
      authLoadError = authErrorMessage(error);
      render();
    } else if (auth?.currentUser) {
      state.authSession = { user: { email: auth.currentUser.email } };
      state.isAuthenticated = true;
      render();
    }
    const submitButton = form.isConnected ? form.querySelector('button[type="submit"]') : null;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = state.authMode === 'signup' ? 'Criar conta e continuar' : 'Entrar';
    }
    notify(form.id === 'authForm' ? authErrorMessage(error) : error.message || 'Não foi possível salvar.');
  }
});

viewRoot.addEventListener('click', async (event) => {
  const promptToggle = event.target.closest('[data-action="toggle-chat-prompts"]');
  if (promptToggle) {
    const promptList = document.getElementById('chatPromptList');
    if (promptList) {
      promptList.hidden = !promptList.hidden;
      promptToggle.setAttribute('aria-expanded', String(!promptList.hidden));
      promptToggle.querySelector('.chat-prompt-toggle-icon').textContent = promptList.hidden ? '+' : '−';
      if (!promptList.hidden) promptList.querySelector('.chat-prompt')?.focus();
    }
    return;
  }

  const coachPrompt = event.target.closest('[data-coach-prompt]');
  if (coachPrompt) {
    await sendCannedQuestion(coachPrompt.dataset.coachPrompt);
    return;
  }

  const authModeControl = event.target.closest('[data-auth-mode]');
  if (authModeControl) {
    state.authMode = authModeControl.dataset.authMode;
    render();
    return;
  }

  const routeLink = event.target.closest('[data-route]');
  if (routeLink && routeLink.tagName !== 'A') {
    location.hash = routeLink.dataset.route;
    return;
  }

  const planFilter = event.target.closest('[data-catalog-plan]');
  if (planFilter) {
    viewRoot.querySelectorAll('[data-catalog-plan]').forEach((button) => button.classList.toggle('active', button === planFilter));
    filterExerciseCatalog();
    return;
  }

  const action = event.target.closest('[data-action]');
  if (!action) return;

  if (action.dataset.action === 'select-exercise-video') {
    document.getElementById(`videoInput_${action.dataset.exerciseId}`)?.click();
    return;
  }

  if (action.dataset.action === 'change-exercise-video') {
    document.getElementById(`videoInput_${action.dataset.exerciseId}`)?.click();
    return;
  }

  if (action.dataset.action === 'reanalyze-exercise-video') {
    await reanalyzeExerciseVideo(action.dataset.exerciseId);
    return;
  }

  if (action.dataset.action === 'remove-exercise-video') {
    await removeExerciseVideo(action.dataset.exerciseId);
    return;
  }

  if (action.dataset.action === 'retry-auth-load') {
    const user = auth?.currentUser;
    if (!user) return;
    action.disabled = true;
    try {
      await applyAuthenticatedUser(user);
    } catch (error) {
      authLoadError = authErrorMessage(error);
      render();
      notify(`Não foi possível carregar seus dados: ${authLoadError}`);
    }
    return;
  }

  if (action.dataset.action === 'checkin') { await markCheckin(); return; }
  if (action.dataset.action === 'toggle-exercise-done') {
    const name = action.dataset.exerciseName;
    const date = today();
    let message;
    state.completedExercises = state.completedExercises || [];
    const existing = state.completedExercises.findIndex((item) => item.name === name && item.date === date);
    if (existing >= 0) {
      state.completedExercises.splice(existing, 1);
      message = 'Exercício desmarcado.';
    } else {
      state.completedExercises.push({ name, date });
      if (!state.checkins.includes(date)) state.checkins.push(date);
      message = 'Exercício marcado como feito hoje.';
    }
    await saveAndRender(message);
    return;
  }
  if (action.dataset.action === 'signout') {
    if (!auth || !authApi) return;
    await authApi.signOut(auth);
    notify('Sessão encerrada.');
    return;
  }
  if (action.dataset.action === 'delete-account') {
    if (!confirm('Excluir sua conta e todos os dados associados?')) return;
    const user = auth?.currentUser;
    if (!user) return;
    try {
      await firebaseDataApi.deleteUserState(user.uid);
      await authApi.deleteUser(user);
      clearCachedUserState(user.uid);
      clearPendingState(user.uid);
      clearLegacyStateForEmail(user.email);
      notify('Conta e dados excluídos.');
    } catch (error) {
      notify(error.message || 'Não foi possível excluir a conta.');
    }
    return;
  }
  if (action.dataset.action === 'delete-meal') {
    const mealIndex = state.meals.findIndex((meal) => meal.id === action.dataset.id);
    if (mealIndex === -1) return;
    state.meals.splice(mealIndex, 1);
    await saveAndRender('Refeição removida; o balanço calórico foi atualizado.');
    return;
  }
  if (action.dataset.action === 'suggestions') {
    action.disabled = true;
    try {
      state.suggestions = await getSuggestions(state);
      const saved = await save();
      render();
      notify(saved ? 'Outro cardápio da biblioteca local foi montado.' : authErrorMessage(lastSaveError || {}));
    } catch (error) {
      notify(error.message || 'Falha ao carregar sugestões.');
      action.disabled = false;
    }
    return;
  }
  if (action.dataset.action === 'reset-demo') {
    if (confirm('Restaurar os dados demonstrativos? Os registros atuais serão substituídos.')) {
      state = initialState();
      await saveAndRender('Dados demonstrativos restaurados.');
    }
  }
});

document.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-action="checkin"]');
  if (action && !viewRoot.contains(action)) await markCheckin();
  if (event.target.closest('#profileShortcut')) location.hash = 'perfil';
  const routeLink = event.target.closest('[data-route]');
  if (routeLink && routeLink.tagName !== 'A' && viewRoot.contains(routeLink)) location.hash = routeLink.dataset.route;
});

window.addEventListener('hashchange', render);
window.addEventListener('storage', (event) => {
  if (event.key?.startsWith('analysis_') && state.isAuthenticated) render();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && route() === 'treinos' && state.isAuthenticated) {
    void restoreTrainingAnalyses(trainingRestoreRequest);
  }
});
async function initializeFirebaseAuth() {
  try {
    const [dataApi, authenticationApi] = await Promise.all([
      import('./firebase.js?v=firestore-outbox'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')
    ]);
    firebaseDataApi = dataApi;
    authApi = authenticationApi;
    auth = dataApi.auth;
    try { await dataApi.authReady; } catch (error) { console.warn('Firebase persistence unavailable:', error); }

    authApi.onAuthStateChanged(auth, async (user) => {
      if (authFlowInProgress) return;
      if (!user) {
        state = initialState();
        state.authMode = 'login';
        authLoadError = '';
        render();
        return;
      }
      try {
        await applyAuthenticatedUser(user);
      } catch (error) {
        authLoadError = authErrorMessage(error);
        render();
        notify(`Não foi possível carregar seus dados: ${authLoadError}`);
        console.error('Firebase state load failed:', error);
      }
    });
  } catch (error) {
    firebaseInitializationError = error;
    console.error('Firebase initialization failed:', error);
    setAuthFeedback('Não foi possível carregar o login. Confira sua conexão e atualize a página.');
    const submitButton = document.querySelector('#authForm button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Login indisponível';
    }
  }
}

render();
authReady = initializeFirebaseAuth();
