export const templates = {
  'Full Body': [
    { name: 'Agachamento livre', group: 'Quadríceps', equipment: 'Barra', sets: 4, reps: 8, load: 50, substitutes: 'Leg press, goblet squat' },
    { name: 'Supino reto', group: 'Peito', equipment: 'Barra', sets: 4, reps: 8, load: 35, substitutes: 'Supino com halteres, máquina' },
    { name: 'Remada curvada', group: 'Costas', equipment: 'Barra', sets: 3, reps: 10, load: 30, substitutes: 'Remada baixa, unilateral' },
    { name: 'Levantamento terra romeno', group: 'Posterior', equipment: 'Barra', sets: 3, reps: 10, load: 40, substitutes: 'Stiff com halteres, mesa flexora' },
    { name: 'Desenvolvimento com halteres', group: 'Ombros', equipment: 'Halteres', sets: 3, reps: 10, load: 12, substitutes: 'Desenvolvimento na máquina, landmine press' },
    { name: 'Prancha', group: 'Abdômen', equipment: 'Peso corporal', sets: 3, reps: 30, load: 0, substitutes: 'Dead bug, prancha lateral' }
  ],
  'Treino A': [
    { name: 'Agachamento livre', group: 'Quadríceps', equipment: 'Barra', sets: 4, reps: 8, load: 50, substitutes: 'Leg press, goblet squat' },
    { name: 'Cadeira extensora', group: 'Quadríceps', equipment: 'Máquina', sets: 3, reps: 12, load: 25, substitutes: 'Step-up, avanço' },
    { name: 'Hip thrust', group: 'Glúteos', equipment: 'Barra', sets: 3, reps: 10, load: 40, substitutes: 'Ponte de glúteos, coice no cabo' },
    { name: 'Supino reto', group: 'Peito', equipment: 'Barra', sets: 4, reps: 8, load: 35, substitutes: 'Supino com halteres, máquina' },
    { name: 'Supino inclinado com halteres', group: 'Peito', equipment: 'Halteres', sets: 3, reps: 10, load: 14, substitutes: 'Supino inclinado na máquina, flexão' },
    { name: 'Tríceps na polia', group: 'Tríceps', equipment: 'Cabo', sets: 3, reps: 12, load: 15, substitutes: 'Tríceps testa, mergulho assistido' }
  ],
  'Treino B': [
    { name: 'Levantamento terra romeno', group: 'Posterior', equipment: 'Barra', sets: 4, reps: 8, load: 40, substitutes: 'Stiff com halteres, mesa flexora' },
    { name: 'Mesa flexora', group: 'Posterior', equipment: 'Máquina', sets: 3, reps: 12, load: 25, substitutes: 'Flexora sentada, Nordic curl assistido' },
    { name: 'Puxada frontal', group: 'Costas', equipment: 'Cabo', sets: 3, reps: 10, load: 32, substitutes: 'Barra assistida, puxada neutra' },
    { name: 'Remada baixa', group: 'Costas', equipment: 'Cabo', sets: 3, reps: 12, load: 30, substitutes: 'Remada curvada, remada unilateral' },
    { name: 'Elevação lateral', group: 'Ombros', equipment: 'Halteres', sets: 3, reps: 12, load: 6, substitutes: 'Elevação no cabo, máquina' },
    { name: 'Rosca direta', group: 'Bíceps', equipment: 'Barra', sets: 3, reps: 12, load: 12, substitutes: 'Rosca alternada, rosca na polia' }
  ],
  'Treino C': [
    { name: 'Leg press', group: 'Quadríceps', equipment: 'Máquina', sets: 4, reps: 10, load: 100, substitutes: 'Agachamento, hack squat' },
    { name: 'Panturrilha em pé', group: 'Panturrilhas', equipment: 'Máquina', sets: 4, reps: 12, load: 30, substitutes: 'Panturrilha no leg press, unilateral' },
    { name: 'Crucifixo no cabo', group: 'Peito', equipment: 'Cabo', sets: 3, reps: 12, load: 8, substitutes: 'Peck deck, crucifixo com halteres' },
    { name: 'Face pull', group: 'Ombros', equipment: 'Cabo', sets: 3, reps: 15, load: 10, substitutes: 'Voo inverso, pull-apart com faixa' },
    { name: 'Abdominal na polia', group: 'Abdômen', equipment: 'Cabo', sets: 3, reps: 12, load: 15, substitutes: 'Crunch, dead bug' },
    { name: 'Rosca martelo', group: 'Bíceps', equipment: 'Halteres', sets: 3, reps: 12, load: 8, substitutes: 'Rosca corda, rosca martelo alternada' }
  ]
};
export const templatePlans = { 'Full Body': ['Full Body'], 'A/B': ['Treino A', 'Treino B'], 'A/B/C': ['Treino A', 'Treino B', 'Treino C'] };
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function exerciseCatalog() {
  const exercises = new Map();
  Object.entries(templates).forEach(([day, items]) => {
    const plans = Object.entries(templatePlans).filter(([, days]) => days.includes(day)).map(([name]) => name);
    items.forEach((item) => {
      const existing = exercises.get(item.name);
      if (existing) {
        existing.plans = [...new Set([...existing.plans, ...plans])];
      } else {
        exercises.set(item.name, { ...item, plans });
      }
    });
  });
  return [...exercises.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

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
  const exercises = exerciseCatalog();
  const groups = [...new Set(exercises.map((exercise) => exercise.group))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const today = new Date().toISOString().slice(0, 10);
  const completedExercises = state.completedExercises || [];
  const completedToday = completedExercises.filter((item) => item.date === today).length;
  return `
    <div class="page-intro"><div><span class="eyebrow">BIBLIOTECA DE MOVIMENTOS</span><h2>Encontre seu exercício</h2><p>Pesquise por nome, grupo muscular ou equipamento e explore as divisões de treino.</p></div><span class="tag">${completedToday} feitos hoje · ${exercises.length} exercícios</span></div>
    <section class="panel exercise-library">
      <div class="exercise-search-row">
        <label class="exercise-search" for="exerciseSearch"><span aria-hidden="true">⌕</span><input id="exerciseSearch" type="search" placeholder="Buscar exercício, músculo ou equipamento" autocomplete="off"></label>
        <label class="exercise-group-filter" for="exerciseGroupFilter"><span>Grupo muscular</span><select id="exerciseGroupFilter"><option value="">Todos</option>${groups.map((group) => `<option value="${escapeHTML(group)}">${escapeHTML(group)}</option>`).join('')}</select></label>
      </div>
      <div class="exercise-plan-filter" role="group" aria-label="Filtrar pela divisão de treino">
        <span>Divisão</span>
        <button type="button" class="active" data-catalog-plan="all">Todos</button>
        ${Object.keys(templatePlans).map((plan) => `<button type="button" data-catalog-plan="${escapeHTML(plan)}">${escapeHTML(plan)}</button>`).join('')}
      </div>
      <div class="exercise-results-head"><h3>Catálogo</h3><span id="exerciseResultCount">${exercises.length} exercícios</span></div>
      <div id="exerciseResults" class="exercise-catalog-grid">
        ${exercises.map((exercise) => {
          const doneToday = completedExercises.some((item) => item.name === exercise.name && item.date === today);
          return `
          <article class="exercise-card catalog-exercise" data-exercise-card data-name="${escapeHTML(exercise.name.toLocaleLowerCase('pt-BR'))}" data-group="${escapeHTML(exercise.group)}" data-search="${escapeHTML(`${exercise.name} ${exercise.group} ${exercise.equipment} ${exercise.substitutes}`.toLocaleLowerCase('pt-BR'))}" data-plans="${escapeHTML(exercise.plans.join('|'))}">
            <div class="exercise-card-head"><div><strong>${escapeHTML(exercise.name)}</strong><small>${escapeHTML(exercise.equipment)}</small></div><span>${escapeHTML(exercise.group)}</span></div>
            <div class="catalog-exercise-details"><span>${exercise.sets} séries</span><span>${exercise.reps} repetições</span></div>
            <p class="catalog-substitutes"><strong>Alternativas:</strong> ${escapeHTML(exercise.substitutes)}</p>
            <button type="button" class="exercise-done-button${doneToday ? ' done' : ''}" data-action="toggle-exercise-done" data-exercise-name="${escapeHTML(exercise.name)}" aria-pressed="${doneToday}">${doneToday ? '✓ Feito hoje' : 'Marcar como feito'}</button>
            <a class="catalog-video-link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.name} execução correta`)}" target="_blank" rel="noopener noreferrer">Pesquisar execução <span aria-hidden="true">↗</span></a>
          </article>
        `;
        }).join('')}
      </div>
      <div id="exerciseEmptyState" class="empty-state" hidden>Nenhum exercício encontrado. Tente outro termo ou filtro.</div>
    </section>`;
}