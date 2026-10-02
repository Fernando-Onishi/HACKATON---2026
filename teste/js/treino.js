export const templates = {
  'Full Body': [
    { name: 'Agachamento livre', group: 'Quadríceps', equipment: 'Barra', sets: 4, reps: 8, load: 50, substitutes: 'Leg press, goblet squat' },
    { name: 'Supino reto', group: 'Peito', equipment: 'Barra', sets: 4, reps: 8, load: 35, substitutes: 'Supino com halteres, máquina' },
    { name: 'Remada curvada', group: 'Costas', equipment: 'Barra', sets: 3, reps: 10, load: 30, substitutes: 'Remada baixa, unilateral' }
  ],
  'Treino A': [
    { name: 'Agachamento livre', group: 'Quadríceps', equipment: 'Barra', sets: 4, reps: 8, load: 50, substitutes: 'Leg press, goblet squat' },
    { name: 'Cadeira extensora', group: 'Quadríceps', equipment: 'Máquina', sets: 3, reps: 12, load: 25, substitutes: 'Step-up, avanço' },
    { name: 'Supino reto', group: 'Peito', equipment: 'Barra', sets: 4, reps: 8, load: 35, substitutes: 'Supino com halteres, máquina' }
  ],
  'Treino B': [
    { name: 'Levantamento terra romeno', group: 'Posterior', equipment: 'Barra', sets: 4, reps: 8, load: 40, substitutes: 'Stiff com halteres, mesa flexora' },
    { name: 'Puxada frontal', group: 'Costas', equipment: 'Cabo', sets: 3, reps: 10, load: 32, substitutes: 'Barra assistida, puxada neutra' },
    { name: 'Desenvolvimento', group: 'Ombros', equipment: 'Halteres', sets: 3, reps: 10, load: 12, substitutes: 'Máquina, landmine press' }
  ],
  'Treino C': [
    { name: 'Leg press', group: 'Quadríceps', equipment: 'Máquina', sets: 4, reps: 10, load: 100, substitutes: 'Agachamento, hack squat' },
    { name: 'Remada baixa', group: 'Costas', equipment: 'Cabo', sets: 3, reps: 12, load: 30, substitutes: 'Remada curvada, unilateral' },
    { name: 'Elevação lateral', group: 'Ombros', equipment: 'Halteres', sets: 3, reps: 12, load: 6, substitutes: 'Cabo, máquina' }
  ]
};
export const templatePlans = { 'Full Body': ['Full Body'], 'A/B': ['Treino A', 'Treino B'], 'A/B/C': ['Treino A', 'Treino B', 'Treino C'] };
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function volumeOf(workout) {
  return (Number(workout.sets) || 0) * (Number(workout.reps) || 0) * (Number(workout.load) || 0);
}

export function volumeState(current, previous) {
  if (previous == null) return { label: 'Sem histórico', state: 'flat' };
  if (current > previous) return { label: 'Evolução', state: 'up' };
  if (current < previous) return { label: 'Regressão', state: 'down' };
  return { label: 'Estagnado', state: 'flat' };
}

export function weeklyVolume(state) {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  return state.workouts.filter((item) => new Date(`${item.date}T00:00:00`) >= since).reduce((total, item) => total + volumeOf(item), 0);
}

export function renderTraining(state) {
  const selected = templatePlans[state.template] ? state.template : 'Full Body';
  const planDays = templatePlans[selected];
  const activeDay = planDays.includes(state.trainingDay) ? state.trainingDay : planDays[0];
  const exercises = templates[activeDay];
  const recent = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const latestExerciseHistory = recent[0] ? state.workouts.filter((item) => item.name.toLowerCase() === recent[0].name.toLowerCase()).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const currentVolume = latestExerciseHistory[0] ? volumeOf(latestExerciseHistory[0]) : 0;
  const previousVolume = latestExerciseHistory[1] ? volumeOf(latestExerciseHistory[1]) : null;
  const progress = volumeState(currentVolume, previousVolume);
  return `
    <div class="page-intro"><div><span class="eyebrow">FORÇA · CONSISTÊNCIA · PROGRESSÃO</span><h2>Treinos</h2><p>Registre sua sessão e acompanhe a evolução de carga com segurança.</p></div><span class="tag">${weeklyVolume(state).toLocaleString('pt-BR')} kg · volume na semana</span></div>
    <section class="panel form-panel"><div class="panel-head"><div><h3>Registrar exercício</h3><p>Volume calculado como séries × repetições × carga.</p></div><div class="template-tabs">${Object.keys(templatePlans).map((name) => `<button type="button" data-template="${name}" class="${selected === name ? 'active' : ''}">${name}</button>`).join('')}</div></div>
      ${planDays.length > 1 ? `<div class="template-tabs" style="margin:0 0 15px">${planDays.map((name) => `<button type="button" data-template-day="${name}" class="${activeDay === name ? 'active' : ''}">${name}</button>`).join('')}</div>` : ''}
      <form id="workoutForm" class="form-grid">
        <div class="field"><label for="exerciseName">Exercício</label><input id="exerciseName" name="name" list="exerciseOptions" placeholder="Ex.: Supino reto" required maxlength="60"><datalist id="exerciseOptions">${Object.values(templates).flat().map((exercise) => `<option value="${exercise.name}">`).join('')}</datalist></div>
        <div class="field"><label for="exerciseGroup">Grupo muscular</label><input id="exerciseGroup" name="group" placeholder="Ex.: Peito" required maxlength="40"></div>
        <div class="field"><label for="exerciseEquipment">Equipamento</label><input id="exerciseEquipment" name="equipment" placeholder="Barra, halteres..." required maxlength="40"></div>
        <div class="field"><label for="exerciseDate">Data</label><input id="exerciseDate" name="date" type="date" max="${new Date().toISOString().slice(0, 10)}" value="${new Date().toISOString().slice(0, 10)}" required></div>
        <div class="field"><label for="exerciseSets">Séries</label><input id="exerciseSets" name="sets" type="number" min="1" max="20" value="3" required></div>
        <div class="field"><label for="exerciseReps">Repetições</label><input id="exerciseReps" name="reps" type="number" min="1" max="100" value="10" required></div>
        <div class="field"><label for="exerciseLoad">Carga (kg)</label><input id="exerciseLoad" name="load" type="number" min="0" max="1000" step="0.5" value="20" required></div>
        <div class="form-actions"><button class="button" type="submit">+ Salvar exercício</button></div>
      </form><p class="form-hint">Treine respeitando sua técnica e seus limites. A progressão pode vir de carga, repetições ou melhor execução.</p>
    </section>
    <div class="content-grid"><section class="panel"><div class="panel-head"><div><h3>${activeDay} · plano de hoje</h3><p>Exercícios e alternativas equivalentes</p></div><span class="tag">${exercises.length} exercícios</span></div>
      ${exercises.map((exercise) => `<article class="panel exercise-card"><div class="exercise-card-head"><strong>${exercise.name}</strong><span>${exercise.group}</span></div><div class="table-overflow"><table class="exercise-table"><thead><tr><th>Equipamento</th><th>Séries</th><th>Reps</th><th>Carga</th><th>Substitutos equivalentes</th></tr></thead><tbody><tr><td>${exercise.equipment}</td><td>${exercise.sets}</td><td>${exercise.reps}</td><td>${exercise.load} kg</td><td>${exercise.substitutes} <button class="link-button" data-action="swap-exercise" data-name="${exercise.name}" title="Trocar por alternativa">Trocar</button></td></tr></tbody></table></div><div class="video-execution-container" data-video="${exercise.name}"><div class="video-placeholder"><button class="play-button" type="button" data-action="video" data-name="${exercise.name}" aria-label="Carregar vídeo de ${exercise.name}">▶</button><strong>Execução do movimento</strong><small>Espaço reservado para vídeo demonstrativo</small></div></div></article>`).join('')}
    </section><section class="panel"><div class="panel-head"><div><h3>Sessões recentes</h3><p>Volume e tendência por exercício</p></div><span class="volume-state"><i class="state-dot ${progress.state}"></i>${progress.label}</span></div>
      ${recent.length ? `<div class="workout-list">${recent.map((item) => { const itemVolume = volumeOf(item); const previousItem = state.workouts.filter((entry) => entry.id !== item.id && entry.name.toLowerCase() === item.name.toLowerCase() && entry.date <= item.date).sort((a, b) => b.date.localeCompare(a.date))[0]; const trend = volumeState(itemVolume, previousItem ? volumeOf(previousItem) : null); return `<div class="list-row"><span class="list-icon">↗</span><span class="row-main"><strong>${escapeHTML(item.name)}</strong><small>${new Date(`${item.date}T00:00:00`).toLocaleDateString('pt-BR')} · ${item.sets} × ${item.reps} · ${item.load} kg</small></span><span class="row-value">${itemVolume.toLocaleString('pt-BR')}<small>${trend.label}</small></span></div>`; }).join('')}</div>` : '<div class="empty-state">Registre seu primeiro exercício para acompanhar sua progressão.</div>'}
    </section></div>`;
}

export function addWorkout(state, values) {
  const workout = { ...values, id: crypto.randomUUID(), sets: Number(values.sets), reps: Number(values.reps), load: Number(values.load) };
  if (!workout.name.trim() || !workout.group.trim() || !workout.equipment.trim()) throw new Error('Preencha os dados do exercício.');
  if (!Number.isFinite(workout.sets) || workout.sets < 1 || workout.sets > 20 || !Number.isFinite(workout.reps) || workout.reps < 1 || workout.reps > 100 || !Number.isFinite(workout.load) || workout.load < 0) throw new Error('Informe séries, repetições e carga válidas.');
  if (workout.date > new Date().toISOString().slice(0, 10)) throw new Error('A data do treino não pode estar no futuro.');
  state.workouts.unshift(workout);
  return workout;
}
