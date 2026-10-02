import { volumeOf } from './treino.js';
import { dailyTotals } from './dieta.js';

export function buildInsights(state) {
  const insights = [];
  const workouts = [...state.workouts].sort((a, b) => a.date.localeCompare(b.date));
  const sessionDates = [...new Set(workouts.map((item) => item.date))];
  if (sessionDates.length >= 2) {
    const previousDate = sessionDates[sessionDates.length - 2];
    const latestDate = sessionDates[sessionDates.length - 1];
    const previous = workouts.filter((item) => item.date === previousDate).reduce((sum, item) => sum + volumeOf(item), 0);
    const latest = workouts.filter((item) => item.date === latestDate).reduce((sum, item) => sum + volumeOf(item), 0);
    const change = previous ? Math.round((latest - previous) / previous * 100) : 0;
    if (change > 0) insights.push({ title: 'Volume em alta', text: `O volume total registrado na sua última sessão foi ${change}% maior que na sessão anterior. Observe também recuperação, técnica e bem-estar.`, icon: '↗' });
    else if (change < 0) insights.push({ title: 'Ritmo de treino', text: `O volume total da última sessão foi ${Math.abs(change)}% menor que na sessão anterior. Variações acontecem; priorize uma execução confortável.`, icon: '⌁' });
    else insights.push({ title: 'Consistência', text: 'O volume total das duas últimas sessões ficou estável. Uma rotina consistente ajuda a acompanhar tendências.', icon: '•' });
  } else {
    insights.push({ title: 'Comece registrando', text: 'Com mais sessões registradas, você verá comparações de volume e tendências ao longo do tempo.', icon: '↗' });
  }

  const datesWithoutWorkout = new Set();
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    datesWithoutWorkout.add(date.toISOString().slice(0, 10));
  }
  let overTarget = 0;
  let noWorkoutDays = 0;
  datesWithoutWorkout.forEach((date) => {
    if (state.workouts.some((item) => item.date === date)) return;
    const totals = dailyTotals(state, date);
    if (totals.consumed > totals.target) { overTarget += totals.consumed - totals.target; noWorkoutDays += 1; }
  });
  if (noWorkoutDays) insights.push({ title: 'Alimentação em dias sem treino', text: `Nos últimos 7 dias, ${noWorkoutDays} dia(s) sem treino registrado ficaram acima da meta, em média ${Math.round(overTarget / noWorkoutDays)} kcal. São estimativas baseadas nos registros disponíveis.`, icon: '◉' });
  else insights.push({ title: 'Rotina equilibrada', text: 'Não encontramos dias sem treino acima da sua meta nos registros recentes. Continue acompanhando os dados sem buscar perfeição.', icon: '◉' });

  const weights = state.weightHistory || [];
  if (weights.length >= 2) {
    const first = Number(weights[0].weight);
    const last = Number(weights[weights.length - 1].weight);
    const difference = last - first;
    insights.push({ title: 'Tendência de peso', text: `Entre seus registros, o peso variou ${Math.abs(difference).toFixed(1)} kg ${difference < 0 ? 'para baixo' : difference > 0 ? 'para cima' : 'e permaneceu estável'}. O peso varia naturalmente; observe tendências ao longo do tempo.`, icon: '⌁' });
  }
  return insights;
}

export function renderInsights(state) {
  const insights = buildInsights(state);
  const labels = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return date.toISOString().slice(0, 10); });
  const volumeData = labels.map((date) => state.workouts.filter((item) => item.date === date).reduce((sum, item) => sum + volumeOf(item), 0));
  const calorieData = labels.map((date) => dailyTotals(state, date).consumed);
  const weightData = labels.map((date) => { const prior = (state.weightHistory || []).filter((entry) => entry.date <= date).at(-1); return prior ? Number(prior.weight) : null; });
  const weekDays = labels.map((date) => new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''));
  const streak = [...new Set(state.checkins || [])].sort((a, b) => b.localeCompare(a));
  let consecutiveDays = 0;
  let previousCheckin = null;
  for (const dateText of streak) {
    const date = new Date(`${dateText}T00:00:00`);
    const expectedPrevious = previousCheckin ? new Date(previousCheckin) : null;
    if (expectedPrevious) expectedPrevious.setDate(expectedPrevious.getDate() - 1);
    if (expectedPrevious && date.getTime() !== expectedPrevious.getTime()) break;
    consecutiveDays += 1;
    previousCheckin = date;
  }
  const recentCheckins = streak.filter((date) => date >= new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weeklyCheckins = streak.filter((date) => date >= weekStart.toISOString().slice(0, 10));
  const earned = [
    { name: 'Primeiro Treino', active: state.workouts.length > 0, icon: '⚡' },
    { name: 'Sequência 5 Dias', active: consecutiveDays >= 5, icon: '🔥' },
    { name: 'Semana Perfeita', active: consecutiveDays >= 7, icon: '🏆' }
  ];
  return `<div class="page-intro"><div><span class="eyebrow">SEUS DADOS, CONECTADOS</span><h2>Insights integrados</h2><p>Leituras automáticas de treino, alimentação e peso.</p></div><span class="tag">Atualizado agora</span></div>
    <section class="panel"><div class="panel-head"><div><h3>Volume, calorias e peso</h3><p>Últimos 7 dias · volume de treino e calorias; peso no eixo secundário</p></div></div><div class="chart-wrap"><canvas id="insightsChart" role="img" aria-label="Gráfico de volume de treino, calorias e peso nos últimos sete dias"></canvas></div></section>
    <div class="content-grid" style="margin-top:14px"><section class="panel"><div class="panel-head"><div><h3>O que seus dados mostram</h3><p>Regras explicáveis com base nos registros salvos.</p></div></div>${insights.map((item) => `<article class="insight-card"><span class="insight-symbol">${item.icon}</span><div><strong>${item.title}</strong><p>${item.text}</p></div></article>`).join('')}</section>
    <section class="panel"><div class="panel-head"><div><h3>Conquistas</h3><p>Marcos da sua consistência</p></div><span class="tag">${earned.filter((badge) => badge.active).length}/${earned.length}</span></div><div class="badges-row">${earned.map((badge) => `<span class="badge ${badge.active ? '' : 'locked'}">${badge.icon} ${badge.name}</span>`).join('')}</div><div class="checkin-banner"><div><h3>Check-in semanal</h3><p>${weeklyCheckins.length < 7 ? `Você registrou ${weeklyCheckins.length} de 7 check-ins nesta semana.` : 'Semana completa. Recuperação também faz parte da consistência.'}</p></div><button class="button small" data-action="checkin">Registrar hoje</button></div></section></div>
    <script type="application/json" id="chartPayload">${JSON.stringify({ labels: weekDays, volume: volumeData, calories: calorieData, weight: weightData }).replace(/</g, '\\u003c')}</script>`;
}

export function mountInsightsChart() {
  const canvas = document.getElementById('insightsChart');
  const payload = document.getElementById('chartPayload');
  if (!canvas || !payload || !window.Chart) return;
  const data = JSON.parse(payload.textContent);
  if (window.fatFitChart) window.fatFitChart.destroy();
  window.fatFitChart = new window.Chart(canvas, {
    type: 'bar',
    data: { labels: data.labels, datasets: [
      { type: 'bar', label: 'Volume (kg)', data: data.volume, backgroundColor: '#e5091488', borderColor: '#e50914', borderWidth: 1, borderRadius: 3, yAxisID: 'y' },
      { type: 'line', label: 'Calorias (kcal)', data: data.calories, borderColor: '#e8e8ef', backgroundColor: '#e8e8ef', pointBackgroundColor: '#e8e8ef', pointRadius: 3, tension: .35, yAxisID: 'y' },
      { type: 'line', label: 'Peso (kg)', data: data.weight, borderColor: '#73d6a0', pointBackgroundColor: '#73d6a0', pointRadius: 4, spanGaps: true, tension: .25, yAxisID: 'y1' }
    ] },
    options: { maintainAspectRatio: false, responsive: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { color: '#b8b8c2', usePointStyle: true, boxWidth: 7, font: { family: 'Outfit', size: 10 } } }, tooltip: { backgroundColor: '#141419', borderColor: '#383840', borderWidth: 1 } }, scales: { x: { grid: { display: false }, ticks: { color: '#888893', font: { family: 'Outfit', size: 10 } } }, y: { beginAtZero: true, grid: { color: '#ffffff0c' }, ticks: { color: '#888893', font: { family: 'Outfit', size: 10 } } }, y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#73d6a0', font: { family: 'Outfit', size: 10 } } } } }
  });
}