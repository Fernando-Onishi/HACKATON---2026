import { getDailyExtraKcal } from './poseAnalyzer.js?v=mediapipe-video-reliability';

const mealTypes = ['Café da manhã', 'Almoço', 'Lanche', 'Jantar'];
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
let foodCatalogPromise;

export function getFoodCatalog() {
  if (!foodCatalogPromise) {
    foodCatalogPromise = fetch(new URL('../data/alimentos.json', import.meta.url))
      .then((response) => {
        if (!response.ok) throw new Error(`Não foi possível carregar a tabela de alimentos (HTTP ${response.status}).`);
        return response.json();
      })
      .then((database) => {
        if (!Array.isArray(database.foods) || database.foods.some((food) => (
          !food.id
          || !food.name
          || !['gramsBase', 'kcal', 'protein', 'carbs', 'fat'].every((key) => Number.isFinite(Number(food[key])))
          || Number(food.gramsBase) <= 0
        ))) throw new Error('A tabela de alimentos está inválida ou contém nutrientes ausentes.');
        return database.foods;
      })
      .catch((error) => {
        foodCatalogPromise = null;
        throw error;
      });
  }
  return foodCatalogPromise;
}

export async function calculateFoodPortion(foodId, grams) {
  const food = (await getFoodCatalog()).find((item) => item.id === foodId);
  if (!food) throw new Error('Selecione um alimento disponível na tabela oficial.');
  const quantity = Number(grams);
  const baseGrams = Number(food.gramsBase);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 3000) throw new Error('Informe uma quantidade entre 1 e 3.000 g.');
  if (!Number.isFinite(baseGrams) || baseGrams <= 0) throw new Error(`A tabela não contém uma porção-base válida para ${food.name}.`);
  const factor = quantity / baseGrams;
  return {
    food,
    grams: quantity,
    calories: Math.round(Number(food.kcal) * factor),
    protein: Math.round(Number(food.protein) * factor * 10) / 10,
    carbs: Math.round(Number(food.carbs) * factor * 10) / 10,
    fat: Math.round(Number(food.fat) * factor * 10) / 10
  };
}

const localSuggestionOptions = [
  { meal: 'Café da manhã', idea: 'Iogurte natural, aveia e banana', portions: [{ food: 'Iogurte natural', grams: 170 }, { food: 'Aveia', grams: 30 }, { food: 'Banana', grams: 80 }], calories: 290, protein: 15, carbs: 48, fat: 5, dietary: ['omnívoro', 'vegetariano'], note: 'Combine fibras e uma fonte de proteína.' },
  { meal: 'Café da manhã', idea: 'Tapioca com ovos e mamão', portions: [{ food: 'Goma de tapioca', grams: 60 }, { food: 'Ovo', grams: 100 }, { food: 'Mamão', grams: 100 }], calories: 355, protein: 14, carbs: 56, fat: 9, dietary: ['omnívoro', 'vegetariano'], note: 'Uma opção simples com ingredientes comuns.' },
  { meal: 'Café da manhã', idea: 'Tofu mexido, pão integral e tomate', portions: [{ food: 'Tofu', grams: 120 }, { food: 'Pão integral', grams: 50 }, { food: 'Tomate', grams: 50 }], calories: 285, protein: 19, carbs: 31, fat: 10, dietary: ['vegano', 'vegetariano'], note: 'Alternativa vegetal com ingredientes acessíveis.' },
  { meal: 'Almoço', idea: 'Arroz, feijão, frango e salada', portions: [{ food: 'Arroz cozido', grams: 120 }, { food: 'Feijão cozido', grams: 100 }, { food: 'Frango grelhado', grams: 100 }, { food: 'Salada variada', grams: 120 }], calories: 490, protein: 39, carbs: 58, fat: 10, dietary: ['omnívoro'], note: 'Uma combinação brasileira variada e familiar.' },
  { meal: 'Almoço', idea: 'Arroz, lentilha e legumes', portions: [{ food: 'Arroz cozido', grams: 120 }, { food: 'Lentilha cozida', grams: 140 }, { food: 'Legumes cozidos', grams: 150 }], calories: 410, protein: 20, carbs: 76, fat: 4, dietary: ['vegano', 'vegetariano'], note: 'Leguminosas e cereais podem compor uma refeição sem carne.' },
  { meal: 'Almoço', idea: 'Peixe, batata e salada', portions: [{ food: 'Peixe assado', grams: 120 }, { food: 'Batata cozida', grams: 180 }, { food: 'Salada variada', grams: 120 }], calories: 390, protein: 32, carbs: 46, fat: 8, dietary: ['omnívoro'], note: 'Varie os vegetais e as fontes de proteína.' },
  { meal: 'Almoço', idea: 'Tofu, arroz e legumes salteados', portions: [{ food: 'Tofu', grams: 150 }, { food: 'Arroz cozido', grams: 120 }, { food: 'Legumes variados', grams: 160 }], calories: 440, protein: 24, carbs: 57, fat: 13, dietary: ['vegano', 'vegetariano'], note: 'Use os legumes disponíveis e ajuste os temperos.' },
  { meal: 'Lanche', idea: 'Maçã e pasta de amendoim', portions: [{ food: 'Maçã', grams: 130 }, { food: 'Pasta de amendoim', grams: 15 }], calories: 175, protein: 4, carbs: 28, fat: 7, dietary: ['vegano', 'vegetariano', 'omnívoro'], note: 'Uma combinação prática para levar.' },
  { meal: 'Lanche', idea: 'Iogurte natural e mamão', portions: [{ food: 'Iogurte natural', grams: 160 }, { food: 'Mamão', grams: 100 }], calories: 145, protein: 9, carbs: 22, fat: 3, dietary: ['omnívoro', 'vegetariano'], note: 'Uma alternativa simples entre refeições.' },
  { meal: 'Lanche', idea: 'Pão integral e homus', portions: [{ food: 'Pão integral', grams: 50 }, { food: 'Homus', grams: 35 }], calories: 190, protein: 8, carbs: 29, fat: 6, dietary: ['vegano', 'vegetariano'], note: 'Pode ser preparado com antecedência.' },
  { meal: 'Jantar', idea: 'Omelete com legumes e batata', portions: [{ food: 'Ovo', grams: 100 }, { food: 'Legumes variados', grams: 150 }, { food: 'Batata cozida', grams: 120 }], calories: 335, protein: 19, carbs: 37, fat: 12, dietary: ['omnívoro', 'vegetariano'], note: 'Adapte os vegetais ao que já tem em casa.' },
  { meal: 'Jantar', idea: 'Sopa de legumes com feijão', portions: [{ food: 'Legumes para sopa', grams: 220 }, { food: 'Feijão cozido', grams: 100 }, { food: 'Pão integral', grams: 35 }], calories: 310, protein: 14, carbs: 55, fat: 4, dietary: ['vegano', 'vegetariano'], note: 'Uma refeição quente com vegetais e leguminosas.' },
  { meal: 'Jantar', idea: 'Frango, purê de abóbora e brócolis', portions: [{ food: 'Frango grelhado', grams: 100 }, { food: 'Abóbora cozida', grams: 180 }, { food: 'Brócolis', grams: 100 }], calories: 280, protein: 34, carbs: 25, fat: 6, dietary: ['omnívoro'], note: 'Uma combinação simples para variar o jantar.' },
  { meal: 'Jantar', idea: 'Grão-de-bico, abóbora e couve', portions: [{ food: 'Grão-de-bico cozido', grams: 120 }, { food: 'Abóbora cozida', grams: 150 }, { food: 'Couve', grams: 60 }], calories: 330, protein: 15, carbs: 56, fat: 6, dietary: ['vegano', 'vegetariano'], note: 'Uma opção vegetal com leguminosa e vegetais.' }
];

function pickLocalSuggestion(meal, previousIdea = '') {
  const options = localSuggestionOptions.filter((item) => item.meal === meal && item.idea !== previousIdea);
  const pool = options.length ? options : localSuggestionOptions.filter((item) => item.meal === meal);
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickLocalSuggestions(previousSuggestions = []) {
  return mealTypes.map((meal) => {
    const previousIdea = previousSuggestions.find((item) => item.meal === meal)?.idea || '';
    return pickLocalSuggestion(meal, previousIdea);
  });
}

function buildPersonalizedMealPlan(state, previousSuggestions = []) {
  const preferences = String(state.profile.foodStyle || 'omnívoro').toLocaleLowerCase('pt-BR');
  const eligible = preferences.includes('vegano') ? 'vegano' : preferences.includes('vegetar') ? 'vegetariano' : 'omnívoro';
  const distribution = [0.23, 0.32, 0.15, 0.30];
  const target = Math.max(1200, Number(state.profile.calorieTarget) || 2000);
  const selected = mealTypes.map((meal) => {
    const candidates = localSuggestionOptions.filter((item) => item.meal === meal && item.dietary.includes(eligible));
    const previousIdea = previousSuggestions.find((item) => item.meal === meal)?.idea || '';
    const available = candidates.filter((item) => item.idea !== previousIdea);
    return (available.length ? available : candidates)[Math.floor(Math.random() * (available.length || candidates.length))];
  });
  return selected.map((item, index) => {
    const multiplier = target * distribution[index] / item.calories;
    return {
      ...item,
      calories: Math.round(item.calories * multiplier),
      protein: Math.round(item.protein * multiplier),
      carbs: Math.round(item.carbs * multiplier),
      fat: Math.round(item.fat * multiplier),
      portions: item.portions.map((portion) => ({ ...portion, grams: Math.max(5, Math.round(portion.grams * multiplier / 5) * 5) }))
    };
  });
}

export function dailyTotals(state, date = new Date().toISOString().slice(0, 10)) {
  const consumed = state.meals.filter((item) => item.date === date).reduce((sum, item) => sum + Number(item.calories), 0);
  const workoutBurn = state.workouts.filter((item) => item.date === date).reduce((sum, item) => sum + (Number(item.estimatedBurn) || 0), 0)
    + getDailyExtraKcal(date);
  const target = Number(state.profile.calorieTarget) || 2000;
  return { consumed, workoutBurn, target, balance: consumed - (target - workoutBurn) };
}

export function renderDiet(state) {
  const today = new Date().toISOString().slice(0, 10);
  const meals = state.meals.filter((item) => item.date === today).sort((a, b) => a.time.localeCompare(b.time)).map((item) => ({ ...item, name: escapeHTML(item.name), type: escapeHTML(item.type), time: escapeHTML(item.time), id: escapeHTML(item.id) }));
  const mealPlan = Array.isArray(state.suggestions) && state.suggestions.every((item) => Array.isArray(item.portions)) ? state.suggestions : getSuggestions(state);
  const totals = dailyTotals(state, today);
  const balanceLabel = totals.balance > 0 ? 'Acima da meta líquida' : totals.balance < 0 ? 'Abaixo da meta líquida' : 'Na meta líquida';
  const caloriesRemaining = totals.target - totals.consumed;
  const calorieBorderClass = caloriesRemaining > 150 ? 'calorie-border-green' : caloriesRemaining >= 1 ? 'calorie-border-yellow' : 'calorie-border-red';
  return `
    <div class="page-intro"><div><span class="eyebrow">NUTRIÇÃO CONSCIENTE · SEM PRESCRIÇÕES</span><h2>Alimentação</h2><p>Plano local estimado para sua meta; ajuste as escolhas à sua fome, cultura e rotina.</p></div><button class="button secondary" data-action="suggestions">↻ Sortear outro cardápio</button></div>
    <div class="balance-banner"><div><span class="eyebrow">BALANÇO LÍQUIDO DE HOJE</span><strong>${totals.balance > 0 ? '+' : ''}${totals.balance.toLocaleString('pt-BR')} <small>kcal</small></strong><small>Consumidas − (meta − gasto estimado do treino)</small></div><span class="balance-state">${balanceLabel}</span></div>
    <div class="content-grid"><section class="panel"><div class="panel-head"><div><h3>Registrar refeição</h3><p>Calorias e macros são calculados exclusivamente pela tabela oficial de alimentos.</p></div></div><form id="mealForm" class="form-grid two">
      <div class="field food-search-field"><label for="foodSearchInput">Alimento</label><input type="text" id="foodSearchInput" placeholder="Busque um alimento (ex: Arroz, Frango)..." autocomplete="off" aria-controls="foodSearchSuggestions" aria-autocomplete="list" required><div id="foodSearchSuggestions" class="food-search-suggestions" role="group" aria-label="Resultados da busca de alimentos"></div></div>
      <div class="field"><label for="mealType">Categoria</label><select id="mealType" name="type" required>${mealTypes.map((type) => `<option>${type}</option>`).join('')}</select></div>
      <div class="food-portion-section" id="foodPortionSection" hidden>
        <div class="field"><label for="foodQuantityGrams">Quantidade consumida (g)</label><input type="number" id="foodQuantityGrams" value="100" min="1" max="3000" step="1" disabled required></div>
        <div class="food-nutrition-preview" aria-live="polite">
          <strong>Valor nutricional estimado</strong>
          <span class="food-kcal-value" id="calculatedKcalDisplay">0 kcal</span>
          <div class="food-macros"><span>Proteínas <strong id="calculatedProteinDisplay">0 g</strong></span><span>Carboidratos <strong id="calculatedCarbsDisplay">0 g</strong></span><span>Gorduras <strong id="calculatedFatDisplay">0 g</strong></span></div>
        </div>
      </div>
      <p class="form-hint" id="foodNutritionHint" role="status">Pesquise e selecione um alimento da tabela oficial para informar a porção.</p>
      <div class="field"><label for="mealDate">Data</label><input id="mealDate" name="date" type="date" value="${today}" max="${today}" required></div>
      <div class="form-actions"><button class="button" type="submit">+ Adicionar refeição</button></div>
    </form></section>
    <section class="panel calorie-summary ${calorieBorderClass}"><div class="panel-head"><div><h3>Resumo de hoje</h3><p>Meta diária configurada no seu perfil</p></div><span class="tag">${totals.target.toLocaleString('pt-BR')} kcal</span></div>
      <div class="metric-card" style="background:#1c1c24;margin-bottom:12px"><div class="metric-top">Consumidas <span>${totals.consumed.toLocaleString('pt-BR')} kcal</span></div><div class="progress-track" style="margin-top:12px"><span style="width:${Math.min(100, totals.consumed / totals.target * 100)}%"></span></div><div class="metric-note">Gasto estimado no treino: ${totals.workoutBurn.toLocaleString('pt-BR')} kcal</div><div class="calorie-remaining ${calorieBorderClass}">${caloriesRemaining < 0 ? `Meta excedida em ${Math.abs(caloriesRemaining).toLocaleString('pt-BR')} kcal` : `Restam ${caloriesRemaining.toLocaleString('pt-BR')} kcal`}</div></div>
      ${caloriesRemaining < 0 ? `<div class="calorie-alert" role="alert">⚠️ Alerta: Você ultrapassou sua meta diária em ${Math.abs(caloriesRemaining).toLocaleString('pt-BR')} kcal!</div>` : ''}
      ${meals.length ? `<div class="meal-list">${meals.map((item) => `<div class="list-row"><span class="list-icon">◉</span><span class="row-main"><span class="meal-type">${item.type}</span><strong>${item.name}</strong><small>${item.time}${item.grams ? ` · ${Number(item.grams).toLocaleString('pt-BR')} g` : ''}</small></span><span class="row-value">${Number(item.calories).toLocaleString('pt-BR')}<small>kcal</small></span><span class="meal-actions"><button type="button" class="button secondary meal-delete-button" data-action="delete-meal" data-id="${item.id}" aria-label="Excluir ${item.name} da refeição">🗑️ Excluir</button></span></div>`).join('')}</div>` : '<div class="empty-state">Nenhuma refeição registrada hoje. Adicione uma acima.</div>'}
    </section></div><section class="panel meal-plan-panel" style="margin-top:14px" id="suggestionPanel"><div class="panel-head"><div><h3>Cardápio-base para hoje</h3><p>Opções prontas compatíveis com sua preferência alimentar. Porções e nutrientes são estimativas, não prescrição.</p></div><span class="tag">Biblioteca local · ${mealPlan.reduce((sum, item) => sum + item.calories, 0).toLocaleString('pt-BR')} kcal/dia</span></div><div class="diet-meal-list">${mealPlan.map((item) => `<article class="diet-meal-item"><div class="diet-meal-head"><span class="meal-type">${escapeHTML(item.meal)}</span><strong>${escapeHTML(item.idea)}</strong></div><div class="diet-macro-row"><span>${item.portions.reduce((sum, portion) => sum + portion.grams, 0).toLocaleString('pt-BR')} g total</span><span>${item.calories} kcal</span><span>Prot. ${item.protein} g</span><span>Carb. ${item.carbs} g</span><span>Gord. ${item.fat} g</span></div><p class="meal-portions">${item.portions.map((portion) => `${escapeHTML(portion.food)} ${portion.grams} g`).join(' · ')}</p><small class="subtle">${escapeHTML(item.note)}</small></article>`).join('')}</div><p class="form-hint">Inspiração baseada em refeições simples e variadas, priorizando alimentos in natura ou minimamente processados. As estimativas não consideram marcas, preparo ou necessidades clínicas. Converse com nutricionista antes de mudanças importantes.</p></section>`;
}

export async function addMeal(state, values) {
  if (!values.type) throw new Error('Informe a categoria da refeição.');
  if (values.date > new Date().toISOString().slice(0, 10)) throw new Error('A data da refeição não pode estar no futuro.');
  const nutrition = await calculateFoodPortion(values.foodId, values.grams);
  const meal = {
    id: crypto.randomUUID(),
    foodId: nutrition.food.id,
    name: nutrition.food.name,
    type: values.type,
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fat: nutrition.fat,
    grams: nutrition.grams,
    date: values.date,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  };
  state.meals.unshift(meal);
  return meal;
}

export function getSuggestions(state) {
  return buildPersonalizedMealPlan(state, Array.isArray(state.suggestions) ? state.suggestions : []);
}
