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
const trainingGuideIcons = {
  camera: '<svg class="video-guide-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11H3V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  profile: '<svg class="video-guide-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="10" cy="7" r="3"/><path d="M4.5 20c.3-3.2 2.2-5 5.5-5s5.2 1.8 5.5 5M19 5v14"/></svg>',
  phone: '<svg class="video-guide-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>',
  body: '<svg class="video-guide-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="5" r="2.5"/><path d="M12 8v6m-4 8 1-6-2-3m9 9-1-6 2-3M8 11l4 2 4-2"/></svg>',
  light: '<svg class="video-guide-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 18h6m-5 4h4m-5.5-7.5a7 7 0 1 1 7 0c-.9.7-1.5 1.5-1.5 2.5h-5c0-1-.6-1.8-1.5-2.5Z"/></svg>'
};

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
  return [...exercises.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map((exercise, index) => {
      const slug = exercise.name.toLocaleLowerCase('pt-BR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      return { ...exercise, id: `ex_${slug}_${index}` };
    });
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
    <details class="video-guide panel">
      <summary class="video-guide-title"><span class="video-guide-heading">${trainingGuideIcons.camera}<span>Como gravar para a IA analisar corretamente (Clique para ver as dicas)</span></span><span class="video-guide-chevron" aria-hidden="true">⌄</span></summary>
      <div class="video-guide-content">
        <ul class="video-guide-tips">
          <li><strong>${trainingGuideIcons.profile}Posição de Perfil (De Lado):</strong> Gravando agachamentos ou pernas? Coloque a câmera exatamente de lado para registrarmos a profundidade real.</li>
          <li><strong>${trainingGuideIcons.phone}Câmera Fixa:</strong> Apoie o celular em um suporte ou garrafa na altura da cintura. Não segure o celular na mão!</li>
          <li><strong>${trainingGuideIcons.body}Corpo Inteiro na Tela:</strong> Mantenha de 2 a 3 metros de distância. Garanta que seus pés não saiam do vídeo ao descer.</li>
          <li><strong>${trainingGuideIcons.light}Boa Iluminação:</strong> Grave em um local claro para que as articulações sejam identificadas sem falhas.</li>
        </ul>
        <p class="video-guide-upload-hint">Cada exercício tem seu próprio botão de vídeo e feedback.</p>
      </div>
    </details>
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
          <article class="exercise-card catalog-exercise" data-exercise-card data-exercise-id="${escapeHTML(exercise.id)}" data-name="${escapeHTML(exercise.name.toLocaleLowerCase('pt-BR'))}" data-group="${escapeHTML(exercise.group)}" data-search="${escapeHTML(`${exercise.name} ${exercise.group} ${exercise.equipment} ${exercise.substitutes}`.toLocaleLowerCase('pt-BR'))}" data-plans="${escapeHTML(exercise.plans.join('|'))}">
            <div class="exercise-card-head"><div><strong>${escapeHTML(exercise.name)}</strong><small>${escapeHTML(exercise.equipment)}</small></div><span>${escapeHTML(exercise.group)}</span></div>
            <div class="catalog-exercise-details"><span>${exercise.sets} séries</span><span>${exercise.reps} repetições</span></div>
            <p class="catalog-substitutes"><strong>Alternativas:</strong> ${escapeHTML(exercise.substitutes)}</p>
            <button type="button" class="exercise-done-button${doneToday ? ' done' : ''}" data-action="toggle-exercise-done" data-exercise-name="${escapeHTML(exercise.name)}" aria-pressed="${doneToday}">${doneToday ? '✓ Feito hoje' : 'Marcar como feito'}</button>
            <div class="exercise-video-upload">
              <input type="file" id="videoInput_${escapeHTML(exercise.id)}" class="video-file-input" data-exercise-id="${escapeHTML(exercise.id)}" data-exercise-type="${escapeHTML(exercise.name)}" accept="video/*" hidden>
              <button type="button" class="button small video-upload-button" data-action="select-exercise-video" data-exercise-id="${escapeHTML(exercise.id)}" aria-controls="videoInput_${escapeHTML(exercise.id)}">Enviar vídeo deste exercício</button>
              <p class="video-validation-status" id="videoStatus_${escapeHTML(exercise.id)}" role="status" aria-live="polite">Nenhum vídeo enviado.</p>
            </div>
            <div id="videoContainer_${escapeHTML(exercise.id)}" class="video-preview-container hidden">
              <video id="videoPreview_${escapeHTML(exercise.id)}" controls playsinline preload="metadata" aria-label="Prévia do vídeo de ${escapeHTML(exercise.name)}"></video>
              <canvas id="poseCanvas_${escapeHTML(exercise.id)}" aria-hidden="true"></canvas>
            </div>
            <div id="analysisOutput_${escapeHTML(exercise.id)}" class="analysis-output" aria-live="polite"></div>
            <div class="video-actions-bar hidden" id="videoActions_${escapeHTML(exercise.id)}" aria-label="Ações do vídeo deste exercício">
              <div class="video-actions-row">
                <button type="button" class="btn-action btn-reanalyze" data-action="reanalyze-exercise-video" data-exercise-id="${escapeHTML(exercise.id)}">
                  <span class="btn-icon" aria-hidden="true">🔄</span>
                  <span class="btn-text">Reanalisar Vídeo</span>
                </button>
                <button type="button" class="btn-action btn-change-video" data-action="change-exercise-video" data-exercise-id="${escapeHTML(exercise.id)}">
                  <span class="btn-icon" aria-hidden="true">📁</span>
                  <span class="btn-text">Trocar Vídeo</span>
                </button>
              </div>
              <button type="button" class="btn-action btn-remove-video" data-action="remove-exercise-video" data-exercise-id="${escapeHTML(exercise.id)}">
                <span class="btn-icon" aria-hidden="true">🗑️</span>
                <span class="btn-text">Remover Vídeo</span>
              </button>
            </div>
            <a class="catalog-video-link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.name} execução correta`)}" target="_blank" rel="noopener noreferrer">Pesquisar execução <span aria-hidden="true">↗</span></a>
          </article>
        `;
        }).join('')}
      </div>
      <div id="exerciseEmptyState" class="empty-state" hidden>Nenhum exercício encontrado. Tente outro termo ou filtro.</div>
    </section>`;
}