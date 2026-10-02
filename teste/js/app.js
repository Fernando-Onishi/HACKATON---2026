import { addWorkout, renderTraining, templates, templatePlans, volumeOf, weeklyVolume } from './treino.js';
import { addMeal, dailyTotals, getSuggestions, renderDiet, swapMeal } from './dieta.js';
import { mountInsightsChart, renderInsights } from './insights.js';

const storageKey = 'fatfit-state-v1';
const today = () => new Date().toISOString().slice(0, 10);
const initialState = () => ({
  profile: { name: 'Atleta Fat Fit', currentWeight: 78.4, goalWeight: 74, calorieTarget: 2200, updatedAt: today() },
  template: 'Full Body', trainingDay: 'Full Body', aiEndpoint: '', supabaseUrl: '', supabaseAnonKey: '', authSession: null,
  workouts: [
    { id: 'demo-w1', name: 'Agachamento livre', group: 'Quadríceps', equipment: 'Barra', sets: 4, reps: 8, load: 50, date: shiftDate(-6) },
    { id: 'demo-w2', name: 'Supino reto', group: 'Peito', equipment: 'Barra', sets: 4, reps: 8, load: 35, date: shiftDate(-4) },
    { id: 'demo-w3', name: 'Remada curvada', group: 'Costas', equipment: 'Barra', sets: 3, reps: 10, load: 30, date: shiftDate(-2) }
  ],
  meals: [
    { id: 'demo-m1', name: 'Iogurte natural com aveia', type: 'Café da manhã', calories: 350, date: today(), time: '08:15' },
    { id: 'demo-m2', name: 'Arroz, feijão e frango grelhado', type: 'Almoço', calories: 680, date: today(), time: '12:40' },
    { id: 'demo-m3', name: 'Fruta da estação', type: 'Lanche', calories: 140, date: shiftDate(-1), time: '16:10' }
  ],
  weightHistory: [{ date: shiftDate(-6), weight: 79 }, { date: shiftDate(-3), weight: 78.7 }, { date: today(), weight: 78.4 }],
  checkins: [shiftDate(-6), shiftDate(-4), shiftDate(-2)], suggestions: null
});
function shiftDate(offset) { const date = new Date(); date.setDate(date.getDate() + offset); return date.toISOString().slice(0, 10); }

let state;
try { state = JSON.parse(localStorage.getItem(storageKey)) || initialState(); } catch { state = initialState(); }
let toastTimer;
const viewRoot = document.getElementById('viewRoot');
const titles = { dashboard: 'Visão geral', treinos: 'Treinos', dieta: 'Alimentação', insights: 'Insights', perfil: 'Meu perfil' };

function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  if (state.authSession?.access_token) syncSupabaseState();
}
function supabaseHeaders(token = state.authSession?.access_token || state.supabaseAnonKey) {
  return { apikey: state.supabaseAnonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
async function supabaseRequest(path, options = {}) {
  if (!state.supabaseUrl || !state.supabaseAnonKey) throw new Error('Configure a URL e a chave pública do Supabase no perfil.');
  const response = await fetch(`${state.supabaseUrl.replace(/\/$/, '')}${path}`, options);
  const result = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.msg || result?.message || result?.error_description || 'Falha na comunicação com o Supabase.');
  return result;
}
async function syncSupabaseState() {
  if (!state.authSession?.user?.id || !state.supabaseUrl || !state.supabaseAnonKey) return;
  const remoteState = { ...state, authSession: null, supabaseAnonKey: '' };
  try {
    await supabaseRequest('/rest/v1/fatfit_state?on_conflict=user_id', {
      method: 'POST', headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: state.authSession.user.id, state: remoteState, updated_at: new Date().toISOString() })
    });
  } catch (error) { console.warn('Supabase sync failed:', error.message); }
}
async function loadSupabaseState() {
  const userId = state.authSession?.user?.id;
  if (!userId) return;
  const params = new URLSearchParams({ select: 'state', user_id: `eq.${userId}` });
  const rows = await supabaseRequest(`/rest/v1/fatfit_state?${params}`, { headers: supabaseHeaders() });
  if (rows?.[0]?.state) {
    const remote = rows[0].state;
    state = { ...initialState(), ...remote, profile: { ...initialState().profile, ...remote.profile }, authSession: state.authSession, supabaseUrl: state.supabaseUrl, supabaseAnonKey: state.supabaseAnonKey };
    localStorage.setItem(storageKey, JSON.stringify(state));
    render();
  } else await syncSupabaseState();
}
async function authenticate(mode, values) {
  const path = mode === 'signup' ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password';
  const result = await supabaseRequest(path, { method: 'POST', headers: supabaseHeaders(state.supabaseAnonKey), body: JSON.stringify({ email: values.email, password: values.password }) });
  if (!result?.access_token) { notify('Conta criada. Confirme seu e-mail para depois entrar.'); return; }
  state.authSession = { access_token: result.access_token, refresh_token: result.refresh_token, user: result.user };
  try { await loadSupabaseState(); } catch (error) { console.warn('Supabase load failed:', error.message); }
  save(); render(); notify(mode === 'signup' ? 'Conta criada e conectada.' : 'Login realizado; sincronização ativa.');
}
function escapeHTML(value = '') { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function notify(message) { const toast = document.getElementById('toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2800); }
function route() { return (location.hash.slice(1) || 'dashboard').split('?')[0]; }
function updateShell(active) {
  document.getElementById('pageTitle').textContent = titles[active] || titles.dashboard;
  document.getElementById('topEyebrow').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase();
  document.querySelectorAll('[data-route]').forEach((link) => link.classList.toggle('active', link.dataset.route === active));
  const firstName = state.profile.name || 'Atleta Fat Fit';
  document.getElementById('sideName').textContent = firstName;
  document.getElementById('sideAvatar').textContent = firstName.trim().charAt(0).toUpperCase();
  const checkins = state.checkins.filter((date) => date >= weekStart());
  document.getElementById('weeklyCount').innerHTML = `${checkins.length} <small>/ 5 dias</small>`;
  document.getElementById('weeklyProgress').style.width = `${Math.min(100, checkins.length / 5 * 100)}%`;
  document.getElementById('weeklyPrompt').textContent = checkins.length < 3 ? 'Uma meta flexível de 2 a 3 dias pode ajudar.' : 'Ótimo ritmo. Preserve espaço para recuperação.';
  document.getElementById('syncStatus').innerHTML = state.authSession ? '<i></i> Sincronização Supabase ativa' : '<i></i> Dados salvos neste dispositivo';
}
function weekStart() { const date = new Date(); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return date.toISOString().slice(0, 10); }

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
    <section class="metrics-grid"><article class="metric-card"><div class="metric-top">Peso atual <span class="metric-icon">⌁</span></div><div class="metric-value">${weight.toLocaleString('pt-BR')} <small>kg</small></div><div class="metric-note">${remaining > 0 ? `${remaining} kg até sua meta` : 'Meta atingida ou não definida'}</div></article><article class="metric-card"><div class="metric-top">Calorias hoje <span class="metric-icon">◉</span></div><div class="metric-value">${total.consumed.toLocaleString('pt-BR')} <small>/ ${total.target.toLocaleString('pt-BR')} kcal</small></div><div class="metric-note">Balanço líquido: ${total.balance > 0 ? '+' : ''}${total.balance.toLocaleString('pt-BR')} kcal</div></article><article class="metric-card"><div class="metric-top">Volume na semana <span class="metric-icon">↗</span></div><div class="metric-value">${weeklyVolume(state).toLocaleString('pt-BR')} <small>kg</small></div><div class="metric-note">${workoutsThisWeek} exercícios registrados</div></article><article class="metric-card"><div class="metric-top">Meta semanal <span class="metric-icon">✓</span></div><div class="metric-value">${state.checkins.filter((date) => date >= weekStart()).length} <small>/ 5 dias</small></div><div class="progress-track" style="margin-top:8px"><span style="width:${Math.min(100, state.checkins.filter((date) => date >= weekStart()).length / 5 * 100)}%"></span></div></article></section>
    <div class="section-heading"><div><h2>Visão integrada</h2><p>Treino e alimentação dos últimos dias.</p></div></div><div class="content-grid"><section class="panel"><div class="panel-head"><div><h3>Volume de treino</h3><p>Registros dos últimos 7 dias</p></div><span class="tag">${workoutsThisWeek} sessões</span></div><div class="chart-wrap"><canvas id="dashboardChart" role="img" aria-label="Gráfico do volume de treino por dia"></canvas></div></section><section class="panel"><div class="panel-head"><div><h3>Refeições de hoje</h3><p>${total.consumed.toLocaleString('pt-BR')} kcal registradas</p></div><button class="link-button" data-route="dieta">Adicionar →</button></div>${state.meals.filter((meal) => meal.date === today()).length ? `<div class="meal-list">${state.meals.filter((meal) => meal.date === today()).slice(0, 4).map((meal) => `<div class="list-row"><span class="list-icon">◉</span><span class="row-main"><strong>${escapeHTML(meal.name)}</strong><small>${escapeHTML(meal.type)}</small></span><span class="row-value">${Number(meal.calories).toLocaleString('pt-BR')}<small>kcal</small></span></div>`).join('')}</div>` : '<div class="empty-state">Registre sua primeira refeição hoje.</div>'}</section></div>
    <div class="section-heading"><div><h2>Suas conquistas</h2><p>Pequenos marcos que mostram sua consistência.</p></div></div><div class="badges-row"><span class="badge ${state.workouts.length ? '' : 'locked'}">⚡ Primeiro Treino</span><span class="badge ${state.checkins.length >= 5 ? '' : 'locked'}">🔥 Sequência 5 Dias</span><span class="badge ${state.checkins.filter((date) => date >= weekStart()).length >= 5 ? '' : 'locked'}">🏆 Semana Perfeita</span></div>`;
}

function renderProfile() {
  const profile = state.profile;
  return `<div class="page-intro"><div><span class="eyebrow">SEU PONTO DE PARTIDA</span><h2>Perfil e metas</h2><p>Defina referências para acompanhar sua jornada.</p></div></div><section class="profile-summary"><span class="avatar">${escapeHTML((profile.name || 'A').charAt(0).toUpperCase())}</span><div><h2>${escapeHTML(profile.name || 'Atleta Fat Fit')}</h2><p>Perfil salvo neste dispositivo</p></div></section><section class="panel form-panel"><div class="panel-head"><div><h3>Dados e metas</h3><p>Valores numéricos devem ser positivos. O histórico de peso alimenta os insights.</p></div></div><form id="profileForm" class="form-grid two"><div class="field"><label for="profileName">Nome</label><input id="profileName" name="name" value="${escapeHTML(profile.name)}" maxlength="50" required></div><div class="field"><label for="profileWeight">Peso atual (kg)</label><input id="profileWeight" name="currentWeight" type="number" min="1" max="500" step="0.1" value="${profile.currentWeight}" required></div><div class="field"><label for="profileGoal">Meta de peso (kg)</label><input id="profileGoal" name="goalWeight" type="number" min="1" max="500" step="0.1" value="${profile.goalWeight}" required></div><div class="field"><label for="profileCalories">Meta calórica diária (kcal)</label><input id="profileCalories" name="calorieTarget" type="number" min="500" max="10000" step="50" value="${profile.calorieTarget}" required></div><div class="field"><label for="aiEndpoint">URL da Supabase Edge Function (opcional)</label><input id="aiEndpoint" name="aiEndpoint" type="url" placeholder="https://seu-projeto.supabase.co/functions/v1/sugestoes" value="${escapeHTML(state.aiEndpoint)}"></div><div class="field"><label for="anonKey">Supabase anon key (opcional)</label><input id="anonKey" name="supabaseAnonKey" type="password" autocomplete="off" placeholder="Somente chave pública anon" value="${escapeHTML(state.supabaseAnonKey)}"></div><div class="form-actions"><button class="button" type="submit">Salvar perfil</button></div></form><p class="form-hint">Nunca coloque chaves secretas de IA no navegador. Para uso real, configure autenticação e RLS no Supabase e mantenha a chave do provedor exclusivamente na Edge Function.</p></section><section class="panel"><div class="panel-head"><div><h3>Privacidade e dados</h3><p>Esta versão funciona sem conta, sincronização remota ou backend conectado.</p></div></div><button class="button secondary small" data-action="reset-demo">Restaurar dados demonstrativos</button><p class="form-hint">Os registros ficam neste navegador, via localStorage. Evite inserir informações médicas sensíveis.</p></section>`;
}

function renderAccountPanel() {
  const signedIn = state.authSession?.user;
  return `<section class="panel form-panel"><div class="panel-head"><div><h3>Conta e sincronização</h3><p>Supabase Auth e Postgres são opcionais; sem configuração, seus dados ficam no navegador.</p></div><span class="tag">${signedIn ? 'Conectado' : 'Local'}</span></div>
    <form id="connectionForm" class="form-grid two"><div class="field"><label for="supabaseUrl">URL do projeto Supabase</label><input id="supabaseUrl" name="supabaseUrl" type="url" placeholder="https://seu-projeto.supabase.co" value="${escapeHTML(state.supabaseUrl)}"></div><div class="field"><label for="supabaseAnonKey">Chave pública anon</label><input id="supabaseAnonKey" name="supabaseAnonKey" type="password" autocomplete="off" placeholder="Chave pública do projeto" value="${escapeHTML(state.supabaseAnonKey)}"></div><div class="form-actions"><button class="button secondary" type="submit">Salvar conexão</button></div></form>
    ${signedIn ? `<div class="checkin-banner"><div><h3>Conta conectada</h3><p>${escapeHTML(signedIn.email || 'Conta Supabase')} · dados sincronizados com fatfit_state</p></div><button class="button secondary small" data-action="signout">Sair da conta</button></div>` : `<form id="authForm" class="form-grid two" style="margin-top:17px"><div class="field"><label for="authEmail">E-mail</label><input id="authEmail" name="email" type="email" autocomplete="email" required></div><div class="field"><label for="authPassword">Senha</label><input id="authPassword" name="password" type="password" autocomplete="current-password" minlength="6" required></div><div class="form-actions"><button class="button" type="submit" name="mode" value="signin">Entrar</button><button class="button secondary" type="submit" name="mode" value="signup">Criar conta</button></div></form>`}
    <p class="form-hint">Use somente a chave pública anon no navegador. A tabela exige RLS por usuário; instruções SQL estão no README.</p></section>`;
}

function render() {
  let active = route();
  if (!titles[active]) { active = 'dashboard'; if (location.hash) history.replaceState(null, '', '#dashboard'); }
  updateShell(active);
  viewRoot.innerHTML = active === 'dashboard' ? renderDashboard() : active === 'treinos' ? renderTraining(state) : active === 'dieta' ? renderDiet(state) : active === 'insights' ? renderInsights(state) : renderProfile();
  if (active === 'perfil') {
    viewRoot.insertAdjacentHTML('afterbegin', renderAccountPanel());
    document.getElementById('anonKey')?.closest('.field').remove();
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
  window.fatFitChart = new window.Chart(canvas, { type: 'bar', data: { labels: labels.map((date) => date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')), datasets: [{ label: 'Volume (kg)', data: values, backgroundColor: '#e5091490', borderColor: '#e50914', borderWidth: 1, borderRadius: 4 }] }, options: { maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#141419' } }, scales: { x: { grid: { display: false }, ticks: { color: '#888893', font: { family: 'Outfit' } } }, y: { beginAtZero: true, grid: { color: '#ffffff0c' }, ticks: { color: '#888893', font: { family: 'Outfit' } } } } } });
}

function markCheckin() {
  if (!state.checkins.includes(today())) { state.checkins.push(today()); save(); render(); notify('Check-in registrado. Bom trabalho!'); }
  else notify('Seu check-in de hoje já está registrado.');
}
function formValues(form) { return Object.fromEntries(new FormData(form).entries()); }

viewRoot.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;
  try {
    if (form.id === 'connectionForm') {
      const values = formValues(form);
      const url = values.supabaseUrl.trim().replace(/\/$/, '');
      if ((url || values.supabaseAnonKey.trim()) && (!url || !values.supabaseAnonKey.trim() || new URL(url).protocol !== 'https:')) throw new Error('Informe a URL HTTPS do projeto e a chave pública anon.');
      state.supabaseUrl = url; state.supabaseAnonKey = values.supabaseAnonKey.trim(); save(); render();
      if (state.authSession) await loadSupabaseState();
      notify('Configuração Supabase salva.');
    } else if (form.id === 'authForm') {
      await authenticate(event.submitter?.value || 'signin', formValues(form));
    } else if (form.id === 'workoutForm') {
      const workout = addWorkout(state, formValues(form));
      workout.estimatedBurn = Math.round(Number(workout.sets) * Number(workout.reps) * 0.5);
      if (!state.checkins.includes(workout.date)) state.checkins.push(workout.date);
      save(); render(); notify('Exercício registrado e volume atualizado.');
    } else if (form.id === 'mealForm') {
      addMeal(state, formValues(form)); save(); render(); notify('Refeição adicionada ao seu diário.');
    } else if (form.id === 'profileForm') {
      const values = formValues(form);
      const numeric = ['currentWeight', 'goalWeight', 'calorieTarget'];
      if (numeric.some((key) => !Number.isFinite(Number(values[key])) || Number(values[key]) <= 0)) throw new Error('Peso e meta calórica devem ser valores positivos.');
      const weight = Number(values.currentWeight);
      if (weight < 1 || weight > 500 || Number(values.goalWeight) > 500 || Number(values.calorieTarget) < 500 || Number(values.calorieTarget) > 10000) throw new Error('Confira os limites de peso (1–500 kg) e meta (500–10.000 kcal).');
      state.profile = { name: values.name.trim(), currentWeight: weight, goalWeight: Number(values.goalWeight), calorieTarget: Number(values.calorieTarget), updatedAt: today() };
      state.aiEndpoint = values.aiEndpoint.trim();
      state.weightHistory.push({ date: today(), weight }); save(); render(); notify('Perfil e metas atualizados.');
    }
  } catch (error) { notify(error.message || 'Não foi possível salvar.'); }
});

viewRoot.addEventListener('click', async (event) => {
  const routeLink = event.target.closest('[data-route]');
  if (routeLink && routeLink.tagName !== 'A') { location.hash = routeLink.dataset.route; return; }
  const templateButton = event.target.closest('[data-template]');
  if (templateButton) { state.template = templateButton.dataset.template; state.trainingDay = templatePlans[state.template][0]; save(); render(); return; }
  const trainingDayButton = event.target.closest('[data-template-day]');
  if (trainingDayButton) { state.trainingDay = trainingDayButton.dataset.templateDay; save(); render(); return; }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  if (action.dataset.action === 'checkin') { markCheckin(); return; }
  if (action.dataset.action === 'signout') {
    try { await supabaseRequest('/auth/v1/logout', { method: 'POST', headers: supabaseHeaders() }); } catch (error) { console.warn('Supabase logout failed:', error.message); }
    state.authSession = null; save(); render(); notify('Sessão encerrada. Seus dados locais continuam disponíveis.'); return;
  }
  if (action.dataset.action === 'delete-meal') { state.meals = state.meals.filter((meal) => meal.id !== action.dataset.id); save(); render(); notify('Refeição removida.'); return; }
  if (action.dataset.action === 'swap-meal') { swapMeal(state, action.dataset.id); save(); render(); notify('Sugestão de alimento atualizada.'); return; }
  if (action.dataset.action === 'swap-exercise') { const match = Object.values(templates).flat().find((item) => item.name === action.dataset.name); if (match) { const alternative = match.substitutes.split(',')[0].trim(); document.getElementById('exerciseName').value = alternative; notify(`Alternativa equivalente: ${alternative}`); } return; }
  if (action.dataset.action === 'video') { const container = action.closest('.video-execution-container'); const url = prompt('Cole uma URL de vídeo MP4 ou um link do YouTube para este exercício:'); if (!url) return; const safeUrl = safeVideoUrl(url); if (!safeUrl) { notify('Use uma URL HTTPS de YouTube ou arquivo MP4.'); return; } container.innerHTML = safeUrl.includes('youtube.com/embed/') ? `<iframe src="${safeUrl}" title="Execução de ${escapeHTML(action.dataset.name)}" allowfullscreen loading="lazy"></iframe>` : `<video src="${safeUrl}" controls playsinline></video>`; return; }
  if (action.dataset.action === 'suggestions') { action.disabled = true; action.textContent = 'Consultando...'; try { state.suggestions = await getSuggestions(state); save(); render(); notify(state.aiEndpoint ? 'Sugestões recebidas da Edge Function.' : 'Sugestões locais carregadas.'); } catch (error) { notify(error.message || 'Falha ao carregar sugestões.'); action.disabled = false; action.textContent = '✦ Sugestões educativas com IA'; } return; }
  if (action.dataset.action === 'reset-demo') { if (confirm('Restaurar os dados demonstrativos? Os registros atuais serão substituídos.')) { state = initialState(); save(); render(); notify('Dados demonstrativos restaurados.'); } }
});

function safeVideoUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (url.hostname === 'youtu.be') return `https://www.youtube.com/embed/${encodeURIComponent(url.pathname.slice(1))}`;
    if (['youtube.com', 'www.youtube.com'].includes(url.hostname) && url.pathname === '/watch') { const id = url.searchParams.get('v'); return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null; }
    if (['youtube.com', 'www.youtube.com'].includes(url.hostname) && url.pathname.startsWith('/embed/')) return url.href;
    return url.pathname.toLowerCase().endsWith('.mp4') ? url.href : null;
  } catch { return null; }
}

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action="checkin"]');
  if (action && !viewRoot.contains(action)) markCheckin();
  if (event.target.closest('#profileShortcut')) location.hash = 'perfil';
  const routeLink = event.target.closest('[data-route]');
  if (routeLink && routeLink.tagName !== 'A' && viewRoot.contains(routeLink)) location.hash = routeLink.dataset.route;
});
window.addEventListener('hashchange', render);
window.addEventListener('storage', (event) => { if (event.key === storageKey && event.newValue) { state = JSON.parse(event.newValue); render(); } });
render();
if (state.authSession?.access_token) loadSupabaseState().catch((error) => console.warn('Supabase restore failed:', error.message));
