const mealTypes = ['Café da manhã', 'Almoço', 'Lanche', 'Jantar'];
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const localSuggestions = [
  { meal: 'Café da manhã', idea: 'Iogurte natural com aveia e uma fruta da estação', note: 'Combine fibras e uma fonte de proteína.' },
  { meal: 'Almoço', idea: 'Arroz, feijão, legumes e uma proteína grelhada', note: 'Uma composição variada pode apoiar sua rotina.' },
  { meal: 'Lanche', idea: 'Fruta com iogurte ou uma porção de castanhas', note: 'Opções simples ajudam na organização do dia.' },
  { meal: 'Jantar', idea: 'Omelete com vegetais e uma fonte de carboidrato', note: 'Adapte ingredientes às suas preferências.' }
];

export function dailyTotals(state, date = new Date().toISOString().slice(0, 10)) {
  const consumed = state.meals.filter((item) => item.date === date).reduce((sum, item) => sum + Number(item.calories), 0);
  const workoutBurn = state.workouts.filter((item) => item.date === date).reduce((sum, item) => sum + (Number(item.estimatedBurn) || 0), 0);
  const target = Number(state.profile.calorieTarget) || 2000;
  return { consumed, workoutBurn, target, balance: consumed - (target - workoutBurn) };
}

export function renderDiet(state) {
  const today = new Date().toISOString().slice(0, 10);
  const meals = state.meals.filter((item) => item.date === today).sort((a, b) => a.time.localeCompare(b.time)).map((item) => ({ ...item, name: escapeHTML(item.name), type: escapeHTML(item.type), time: escapeHTML(item.time), id: escapeHTML(item.id) }));
  const totals = dailyTotals(state, today);
  const balanceLabel = totals.balance > 0 ? 'Acima da meta líquida' : totals.balance < 0 ? 'Abaixo da meta líquida' : 'Na meta líquida';
  return `
    <div class="page-intro"><div><span class="eyebrow">NUTRIÇÃO CONSCIENTE · SEM PRESCRIÇÕES</span><h2>Alimentação</h2><p>Registre refeições e entenda seu balanço calórico diário.</p></div><button class="button secondary" data-action="suggestions">✦ Sugestões educativas com IA</button></div>
    <div class="balance-banner"><div><span class="eyebrow">BALANÇO LÍQUIDO DE HOJE</span><strong>${totals.balance > 0 ? '+' : ''}${totals.balance.toLocaleString('pt-BR')} <small>kcal</small></strong><small>Consumidas − (meta − gasto estimado do treino)</small></div><span class="balance-state">${balanceLabel}</span></div>
    <div class="content-grid"><section class="panel"><div class="panel-head"><div><h3>Registrar refeição</h3><p>Estimativas são aproximadas; use os dados do alimento quando disponíveis.</p></div></div><form id="mealForm" class="form-grid two">
      <div class="field"><label for="mealName">Alimento ou refeição</label><input id="mealName" name="name" placeholder="Ex.: Iogurte com frutas" required maxlength="80"></div>
      <div class="field"><label for="mealType">Categoria</label><select id="mealType" name="type" required>${mealTypes.map((type) => `<option>${type}</option>`).join('')}</select></div>
      <div class="field"><label for="mealCalories">Calorias (kcal)</label><input id="mealCalories" name="calories" type="number" min="0" max="10000" step="1" placeholder="320" required></div>
      <div class="field"><label for="mealDate">Data</label><input id="mealDate" name="date" type="date" value="${today}" max="${today}" required></div>
      <div class="form-actions"><button class="button" type="submit">+ Adicionar refeição</button></div>
    </form></section>
    <section class="panel"><div class="panel-head"><div><h3>Resumo de hoje</h3><p>Meta diária configurada no seu perfil</p></div><span class="tag">${totals.target.toLocaleString('pt-BR')} kcal</span></div>
      <div class="metric-card" style="background:#1c1c24;margin-bottom:12px"><div class="metric-top">Consumidas <span>${totals.consumed.toLocaleString('pt-BR')} kcal</span></div><div class="progress-track" style="margin-top:12px"><span style="width:${Math.min(100, totals.consumed / totals.target * 100)}%"></span></div><div class="metric-note">Gasto estimado no treino: ${totals.workoutBurn.toLocaleString('pt-BR')} kcal</div></div>
      ${meals.length ? `<div class="meal-list">${meals.map((item) => `<div class="list-row"><span class="list-icon">◉</span><span class="row-main"><span class="meal-type">${item.type}</span><strong>${item.name}</strong><small>${item.time}</small></span><span class="row-value">${Number(item.calories).toLocaleString('pt-BR')}<small>kcal</small></span><span class="meal-actions"><button class="icon-action" data-action="swap-meal" data-id="${item.id}" aria-label="Trocar sugestão da refeição" title="Trocar alimento com IA">↻</button><button class="icon-action" data-action="delete-meal" data-id="${item.id}" aria-label="Remover refeição" title="Remover">×</button></span></div>`).join('')}</div>` : '<div class="empty-state">Nenhuma refeição registrada hoje. Adicione uma acima.</div>'}
    </section></div><section class="panel" style="margin-top:14px" id="suggestionPanel"><div class="panel-head"><div><h3>Sugestões educativas</h3><p>Ideias gerais para inspirar variedade. Não substituem orientação profissional.</p></div><span class="tag">${state.aiEndpoint ? 'Proxy configurado' : 'Modo local'}</span></div><div class="meal-list">${(state.suggestions || localSuggestions).map((item) => `<div class="list-row"><span class="list-icon">✦</span><span class="row-main"><span class="meal-type">${item.meal}</span><strong>${item.idea}</strong><small>${item.note}</small></span></div>`).join('')}</div></section>`;
}

export function addMeal(state, values) {
  const meal = { ...values, id: crypto.randomUUID(), calories: Number(values.calories), time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
  if (!meal.name.trim() || !meal.type) throw new Error('Informe a refeição e a categoria.');
  if (!Number.isFinite(meal.calories) || meal.calories < 0 || meal.calories > 10000) throw new Error('Informe calorias entre 0 e 10.000.');
  if (meal.date > new Date().toISOString().slice(0, 10)) throw new Error('A data da refeição não pode estar no futuro.');
  state.meals.unshift(meal);
  return meal;
}

export async function getSuggestions(state) {
  if (state.aiEndpoint) {
    const endpoint = new URL(state.aiEndpoint);
    const project = state.supabaseUrl ? new URL(state.supabaseUrl) : null;
    if (endpoint.protocol !== 'https:' || !project || endpoint.origin !== project.origin || !endpoint.pathname.includes('/functions/v1/')) throw new Error('A Edge Function precisa usar HTTPS e pertencer ao projeto Supabase configurado.');
    const accessToken = state.authSession?.access_token || state.supabaseAnonKey;
    const response = await fetch(endpoint.href, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(state.supabaseAnonKey ? { apikey: state.supabaseAnonKey, Authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify({ profile: { calorieTarget: state.profile.calorieTarget }, responseFormat: 'json', requirements: 'Retorne somente JSON no formato {"suggestions":[{"meal":"Café da manhã|Almoço|Lanche|Jantar","idea":"...","note":"..."}]}. Forneça ideias educativas gerais, sem diagnóstico, prescrição médica ou dietas extremas.' }) });
    if (!response.ok) throw new Error('Não foi possível consultar a função de sugestões.');
    const result = await response.json();
    const suggestions = Array.isArray(result) ? result : result.suggestions;
    if (!Array.isArray(suggestions) || !suggestions.length || suggestions.some((item) => !mealTypes.includes(item.meal) || typeof item.idea !== 'string' || typeof item.note !== 'string' || !item.idea.trim() || !item.note.trim())) throw new Error('A resposta da IA precisa conter meal, idea e note válidos em JSON.');
    return suggestions.map((item) => ({ meal: escapeHTML(item.meal), idea: escapeHTML(item.idea), note: escapeHTML(item.note) }));
  }
  return localSuggestions;
}

export function swapMeal(state, id) {
  const meal = state.meals.find((item) => item.id === id);
  if (!meal) return false;
  const options = state.suggestions || localSuggestions;
  const other = options.find((item) => item.meal === meal.type && item.idea !== meal.name) || localSuggestions.find((item) => item.meal === meal.type) || localSuggestions[0];
  meal.name = other.idea;
  meal.swapped = true;
  return true;
}