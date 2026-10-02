import { renderTraining, templatePlans, volumeOf, weeklyVolume } from './treino.js?v=workout-checkins';
import { addMeal, dailyTotals, getSuggestions, renderDiet, swapMeal } from './dieta.js?v=exercise-library';
import { mountInsightsChart, renderInsights } from './insights.js?v=streak-achievements';

const storageKey = 'fatfit-state-v1';
const userStorageKey = 'fatfit-user';
const today = () => new Date().toISOString().slice(0, 10);
const shiftDate = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const initialState = () => ({
  profile: { name: 'Atleta Fat Fit', currentWeight: 78.4, goalWeight: 74, calorieTarget: 2200, updatedAt: today(), goal: 'perder peso', difficulties: 'falta de tempo' },
  template: 'Full Body',
  trainingDay: 'Full Body',
  aiEndpoint: '',
  authSession: null,
  isAuthenticated: false,
  authMode: 'login',
  chatHistory: [
    { role: 'assistant', text: 'Olá! Sou seu coach IA. Posso ajustar treino, dieta, metas e foco do seu progresso.' }
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

let state;
try { state = JSON.parse(localStorage.getItem(storageKey)) || initialState(); } catch { state = initialState(); }

let toastTimer;
const viewRoot = document.getElementById('viewRoot');
const titles = { dashboard: 'Visão geral', treinos: 'Treinos', dieta: 'Alimentação', insights: 'Insights', perfil: 'Meu perfil', chat: 'Coach IA' };

function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function calculateCalorieTarget({ weight, height, age, goal }) {
  const base = 10 * Number(weight) + 6.25 * Number(height) - 5 * Number(age) + 5;
  const goalLabel = String(goal || '').toLowerCase();
  if (goalLabel.includes('ganhar') || goalLabel.includes('massa')) return Math.round(base * 1.35 + 220);
  if (goalLabel.includes('manter')) return Math.round(base * 1.25);
  return Math.round(base * 1.2 - 300);
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
  if (syncStatus) syncStatus.innerHTML = '<i></i> Dados salvos neste dispositivo';
}

function buildCoachReply(message, profile = state.profile) {
  const text = String(message || '').toLowerCase();
  if (/treino|muscul|força|full body|a\/b|a\/b\/c/.test(text)) {
    return `Para o seu objetivo de ${profile.goal || 'melhorar o desempenho'}, o melhor caminho é manter o plano ${suggestedTemplate(profile.goal || '')} com foco em consistência e recuperação.`;
  }
  if (/dieta|aliment|caloria|carbo|prote/.test(text)) {
    const target = Number(profile.calorieTarget) || 2200;
    return `Sua meta calórica atual está em ${target} kcal. A melhor base é manter proteína suficiente, carboidratos para treino e gorduras boas em equilíbrio, com refeições consistentes ao longo do dia.`;
  }
  if (/peso|meta|emag|ganhar|manter|evolu/.test(text)) {
    return `Sua meta de peso é ${Number(profile.goalWeight || 0).toFixed(1)} kg e o foco atual é ${profile.goal || 'melhorar sua performance'}. A melhor abordagem é evoluir gradualmente, sem picos ou drasticidade.`;
  }
  if (/dificuldade|motiva|tempo|cansa|recuper/.test(text)) {
    return `Você mencionou ${profile.difficulties || 'algumas dificuldades da rotina'}. O ajuste ideal é priorizar qualidade, reduzir excesso de volume e manter uma rotina sustentável.`;
  }
  return `Tudo certo. Vamos ajustar seu plano com foco em ${profile.goal || 'melhorar sua performance'} e manter a rotina sustentável para ${profile.name || 'você'}.`;
}

function renderAuthScreen() {
  const isSignup = state.authMode === 'signup';
  return `
    <div class="auth-shell">
      <section class="auth-brand-panel">
        <div class="brand-wrap">
          <span class="brand-mark-large">F</span>
          <div>
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
          <div><strong>IA</strong><span>coach adaptativo</span></div>
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
            <div class="field"><label for="signupName">Nome</label><input id="signupName" name="name" maxlength="50" required></div>
            <div class="field"><label for="signupAge">Idade</label><input id="signupAge" name="age" type="number" min="10" max="80" required></div>
            <div class="field"><label for="signupWeight">Peso atual (kg)</label><input id="signupWeight" name="currentWeight" type="number" min="30" max="300" step="0.1" required></div>
            <div class="field"><label for="signupHeight">Altura (cm)</label><input id="signupHeight" name="height" type="number" min="120" max="220" required></div>
            <div class="field"><label for="signupGoalWeight">Meta de peso (kg)</label><input id="signupGoalWeight" name="goalWeight" type="number" min="30" max="300" step="0.1" required></div>
            <div class="field"><label for="signupGoal">Objetivo principal</label><select id="signupGoal" name="goal" required><option value="" disabled selected>Selecione seu objetivo</option><option value="perder peso">Perder peso</option><option value="ganhar massa">Ganhar massa</option><option value="manter o peso">Manter o peso</option><option value="melhorar a performance">Melhorar a performance</option></select></div>
            <div class="field field-wide"><label for="signupDifficulties">Principais dificuldades</label><textarea id="signupDifficulties" name="difficulties" rows="3" placeholder="Ex.: falta de tempo, pouca energia, dificuldade em manter foco..."></textarea></div>
          ` : ''}
          <button type="submit" class="button button-block">${isSignup ? 'Criar conta e continuar' : 'Entrar'}</button>
        </form>
      </section>
    </div>
  `;
}

function renderChat() {
  const entries = state.chatHistory || [];
  return `
    <div class="page-intro"><div><span class="eyebrow">COACH INTELIGENTE</span><h2>Coach IA</h2><p>Receba ajustes em treino, dieta, metas e recuperação.</p></div><span class="tag">Resposta em tempo real</span></div>
    <section class="chat-shell panel">
      <div class="chat-history">
        ${entries.map((entry) => `
          <div class="chat-bubble ${entry.role === 'user' ? 'user' : 'assistant'}">
            <span>${entry.role === 'user' ? 'Você' : 'Coach'}</span>
            <p>${escapeHTML(entry.text)}</p>
          </div>
        `).join('')}
      </div>
      <form id="chatForm" class="chat-form">
        <input id="chatInput" name="message" type="text" maxlength="240" placeholder="Pergunte sobre treino, dieta, peso ou motivação..." required>
        <button type="submit" class="button">Enviar</button>
      </form>
    </section>
  `;
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

function renderProfile() {
  const profile = state.profile;
  return `<div class="page-intro"><div><span class="eyebrow">SEU PONTO DE PARTIDA</span><h2>Perfil e metas</h2><p>Defina referências para acompanhar sua jornada.</p></div></div><section class="profile-summary"><span class="avatar">${escapeHTML((profile.name || 'A').charAt(0).toUpperCase())}</span><div><h2>${escapeHTML(profile.name || 'Atleta Fat Fit')}</h2><p>Perfil salvo neste dispositivo</p></div></section><section class="panel form-panel"><div class="panel-head"><div><h3>Dados e metas</h3><p>Valores numéricos devem ser positivos. O histórico de peso alimenta os insights.</p></div></div><form id="profileForm" class="form-grid two"><div class="field"><label for="profileName">Nome</label><input id="profileName" name="name" value="${escapeHTML(profile.name)}" maxlength="50" required></div><div class="field"><label for="profileWeight">Peso atual (kg)</label><input id="profileWeight" name="currentWeight" type="number" min="1" max="500" step="0.1" value="${profile.currentWeight}" required></div><div class="field"><label for="profileGoal">Meta de peso (kg)</label><input id="profileGoal" name="goalWeight" type="number" min="1" max="500" step="0.1" value="${profile.goalWeight}" required></div><div class="field"><label for="profileCalories">Meta calórica diária (kcal)</label><input id="profileCalories" name="calorieTarget" type="number" min="500" max="10000" step="50" value="${profile.calorieTarget}" required></div><div class="field"><label for="profileGoalText">Objetivo</label><input id="profileGoalText" name="goal" value="${escapeHTML(profile.goal || '')}" maxlength="60"></div><div class="field"><label for="profileDifficulties">Dificuldades</label><input id="profileDifficulties" name="difficulties" value="${escapeHTML(profile.difficulties || '')}" maxlength="120"></div><div class="form-actions"><button class="button" type="submit">Salvar perfil</button></div></form></section>`;
}

function renderAccountPanel() {
  const email = state.authSession?.user?.email || '';
  return `<section class="panel account-panel"><div class="panel-head"><div><h3>Conta</h3>${email ? `<p>${escapeHTML(email)}</p>` : ''}</div></div><div class="account-actions"><button class="button secondary" data-action="signout">Sair da conta</button><button class="button danger" data-action="delete-account">Excluir conta</button></div></section>`;
}

function render() {
  document.body.classList.toggle('auth-mode', !state.isAuthenticated);
  if (!state.isAuthenticated) {
    viewRoot.innerHTML = renderAuthScreen();
    return;
  }

  let active = route();
  if (!titles[active]) { active = 'dashboard'; if (location.hash) history.replaceState(null, '', '#dashboard'); }
  updateShell(active);
  viewRoot.innerHTML = active === 'dashboard' ? renderDashboard() : active === 'treinos' ? renderTraining(state) : active === 'dieta' ? renderDiet(state) : active === 'insights' ? renderInsights(state) : active === 'chat' ? renderChat() : renderProfile();

  if (active === 'perfil') {
    viewRoot.insertAdjacentHTML('afterbegin', renderAccountPanel());
  }
  if (active === 'dashboard') mountDashboardChart();
  if (active === 'insights') mountInsightsChart();
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

function markCheckin() {
  if (!state.checkins.includes(today())) { state.checkins.push(today()); save(); render(); notify('Check-in registrado. Bom trabalho!'); }
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

viewRoot.addEventListener('input', (event) => {
  if (event.target.id === 'exerciseSearch') filterExerciseCatalog();
});

viewRoot.addEventListener('change', (event) => {
  if (event.target.id === 'exerciseGroupFilter') filterExerciseCatalog();
});

viewRoot.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;

  try {
    if (form.id === 'authForm') {
      const values = formValues(form);
      const isSignup = state.authMode === 'signup';

      if (isSignup) {
        const weight = Number(values.currentWeight);
        if (!values.email || !values.password || !values.name) throw new Error('Preencha nome, e-mail e senha para continuar.');

        const profile = {
          name: values.name.trim() || 'Atleta Fat Fit',
          currentWeight: weight,
          goalWeight: Number(values.goalWeight),
          calorieTarget: calculateCalorieTarget({ weight, height: values.height, age: values.age, goal: values.goal }),
          goal: values.goal,
          difficulties: values.difficulties || 'falta de tempo',
          age: Number(values.age),
          height: Number(values.height),
          updatedAt: today()
        };

        state.profile = profile;
        state.template = suggestedTemplate(values.goal);
        state.trainingDay = templatePlans[state.template][0];
        state.isAuthenticated = true;
        state.authSession = { access_token: 'local-session', user: { email: values.email } };
        state.chatHistory = [{ role: 'assistant', text: `Tudo certo, ${profile.name}! Vou ajustar seu plano para ${values.goal.toLowerCase()} e manter a rotina sustentável.` }];

        const saved = JSON.parse(localStorage.getItem(userStorageKey) || '{}');
        saved.email = values.email;
        saved.password = values.password;
        saved.name = profile.name;
        localStorage.setItem(userStorageKey, JSON.stringify(saved));
        save();
        render();
        notify('Perfil criado e plano personalizado montado.');
        return;
      }

      const savedUser = JSON.parse(localStorage.getItem(userStorageKey) || '{}');
      const match = savedUser.email === values.email && savedUser.password === values.password;
      if (!match) throw new Error('E-mail ou senha inválidos. Cadastre-se primeiro para continuar.');

      state.isAuthenticated = true;
      state.authSession = { access_token: 'local-session', user: { email: values.email } };
      save();
      render();
      notify('Login realizado com sucesso.');
      return;
    }

    if (form.id === 'mealForm') {
      addMeal(state, formValues(form));
      save();
      render();
      notify('Refeição adicionada ao seu diário.');
      return;
    }

    if (form.id === 'profileForm') {
      const values = formValues(form);
      const numeric = ['currentWeight', 'goalWeight', 'calorieTarget'];
      if (numeric.some((key) => !Number.isFinite(Number(values[key])) || Number(values[key]) <= 0)) throw new Error('Peso e meta calórica devem ser valores positivos.');

      const weight = Number(values.currentWeight);
      if (weight < 1 || weight > 500 || Number(values.goalWeight) > 500 || Number(values.calorieTarget) < 500 || Number(values.calorieTarget) > 10000) throw new Error('Confira os limites de peso (1–500 kg) e meta (500–10.000 kcal).');

      state.profile = { ...state.profile, name: values.name.trim(), currentWeight: weight, goalWeight: Number(values.goalWeight), calorieTarget: Number(values.calorieTarget), goal: values.goal || state.profile.goal, difficulties: values.difficulties || state.profile.difficulties, updatedAt: today() };
      state.weightHistory.push({ date: today(), weight });
      save();
      render();
      notify('Perfil e metas atualizados.');
      return;
    }

    if (form.id === 'chatForm') {
      const message = formValues(form).message.trim();
      if (!message) return;
      state.chatHistory = [...(state.chatHistory || []), { role: 'user', text: message }];
      state.chatHistory.push({ role: 'assistant', text: buildCoachReply(message, state.profile) });
      save();
      render();
      notify('Resposta do coach atualizada.');
    }
  } catch (error) {
    notify(error.message || 'Não foi possível salvar.');
  }
});

viewRoot.addEventListener('click', async (event) => {
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

  if (action.dataset.action === 'checkin') { markCheckin(); return; }
  if (action.dataset.action === 'toggle-exercise-done') {
    const name = action.dataset.exerciseName;
    const date = today();
    state.completedExercises = state.completedExercises || [];
    const existing = state.completedExercises.findIndex((item) => item.name === name && item.date === date);
    if (existing >= 0) {
      state.completedExercises.splice(existing, 1);
      notify('Exercício desmarcado.');
    } else {
      state.completedExercises.push({ name, date });
      if (!state.checkins.includes(date)) state.checkins.push(date);
      notify('Exercício marcado como feito hoje.');
    }
    save();
    render();
    return;
  }
  if (action.dataset.action === 'signout') {
    state.isAuthenticated = false;
    state.authSession = null;
    state.authMode = 'login';
    save();
    render();
    notify('Sessão encerrada.');
    return;
  }
  if (action.dataset.action === 'delete-account') {
    if (!confirm('Excluir sua conta e apagar o perfil e os dados salvos neste navegador?')) return;
    localStorage.removeItem(storageKey);
    localStorage.removeItem(userStorageKey);
    state = initialState();
    state.authMode = 'login';
    render();
    notify('Conta e dados locais excluídos.');
    return;
  }
  if (action.dataset.action === 'delete-meal') { state.meals = state.meals.filter((meal) => meal.id !== action.dataset.id); save(); render(); notify('Refeição removida.'); return; }
  if (action.dataset.action === 'swap-meal') { swapMeal(state, action.dataset.id); save(); render(); notify('Sugestão de alimento atualizada.'); return; }
  if (action.dataset.action === 'suggestions') {
    action.disabled = true;
    action.textContent = 'Consultando...';
    try {
      state.suggestions = await getSuggestions(state);
      save();
      render();
      notify(state.aiEndpoint ? 'Sugestões recebidas da Edge Function.' : 'Sugestões locais carregadas.');
    } catch (error) {
      notify(error.message || 'Falha ao carregar sugestões.');
      action.disabled = false;
      action.textContent = '✦ Sugestões educativas com IA';
    }
    return;
  }
  if (action.dataset.action === 'reset-demo') {
    if (confirm('Restaurar os dados demonstrativos? Os registros atuais serão substituídos.')) {
      state = initialState();
      save();
      render();
      notify('Dados demonstrativos restaurados.');
    }
  }
});

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action="checkin"]');
  if (action && !viewRoot.contains(action)) markCheckin();
  if (event.target.closest('#profileShortcut')) location.hash = 'perfil';
  const routeLink = event.target.closest('[data-route]');
  if (routeLink && routeLink.tagName !== 'A' && viewRoot.contains(routeLink)) location.hash = routeLink.dataset.route;
});

window.addEventListener('hashchange', render);
window.addEventListener('storage', (event) => {
  if (event.key === storageKey && event.newValue) {
    state = JSON.parse(event.newValue);
    render();
  }
});

render();