const ANALYSIS_PREFIX = 'analysis_';
const ANALYSIS_VERSION = 2;
const POSE_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/';
const MIN_LANDMARK_VISIBILITY = 0.5;
const MAX_SAMPLED_FRAMES = 24;
const MIN_SAMPLED_FRAMES = 8;
const MIN_PHASE_FRAME_RATIO = 0.15;
const MIN_EXTENSION_ANGLE_MARGIN = 45;
const MEDIA_EVENT_TIMEOUT_MS = 12000;
const POSE_FRAME_TIMEOUT_MS = 20000;
const analysisRequests = new Map();
const pendingPoseFrames = new WeakMap();
let poseScriptPromise;
let poseInstancePromise;
let exerciseDatabasePromise;
let analysisQueue = Promise.resolve();

const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

function analysisKey(exerciseId, date) {
  return `${ANALYSIS_PREFIX}${exerciseId}_${date}`;
}

function normalizeExerciseName(name) {
  return String(name || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function loadExerciseDatabase() {
  if (exerciseDatabasePromise) return exerciseDatabasePromise;
  exerciseDatabasePromise = fetch(new URL('../data/exercicios.json', import.meta.url))
    .then((response) => {
      if (!response.ok) throw new Error(`Não foi possível carregar data/exercicios.json (HTTP ${response.status}).`);
      return response.json();
    })
    .then((database) => {
      if (!Array.isArray(database.exercises)) throw new Error('A base data/exercicios.json tem um formato inválido.');
      return database.exercises;
    })
    .catch((error) => {
      exerciseDatabasePromise = null;
      throw error;
    });
  return exerciseDatabasePromise;
}

async function standardForExercise(name) {
  const normalized = normalizeExerciseName(name);
  const exercises = await loadExerciseDatabase();
  const match = exercises.find((exercise) => (
    exercise.poseStandard
    && Array.isArray(exercise.analysisNames)
    && exercise.analysisNames.some((alias) => normalized.includes(normalizeExerciseName(alias)))
  ));
  return match?.poseStandard || null;
}

function loadPoseScript() {
  if (typeof window.Pose === 'function') return Promise.resolve();
  if (poseScriptPromise) return poseScriptPromise;

  poseScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${POSE_BASE_URL}pose.js`;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => {
      if (typeof window.Pose !== 'function') {
        poseScriptPromise = null;
        reject(new Error('O MediaPipe foi carregado, mas a API Pose não ficou disponível.'));
        return;
      }
      resolve();
    };
    script.onerror = () => {
      poseScriptPromise = null;
      reject(new Error('Falha ao carregar o MediaPipe Pose. Verifique a conexão e tente novamente.'));
    };
    document.head.append(script);
  });
  return poseScriptPromise;
}

async function getPose() {
  await loadPoseScript();
  if (!poseInstancePromise) {
    poseInstancePromise = Promise.resolve().then(() => {
      const pose = new window.Pose({
        locateFile: (file) => `${POSE_BASE_URL}${file}`
      });
      pose.setOptions({
        smoothLandmarks: true,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      pose.onResults((results) => {
        const pending = pendingPoseFrames.get(pose);
        if (!pending) return;
        pendingPoseFrames.delete(pose);
        clearTimeout(pending.timeoutId);
        pending.resolve(results);
      });
      return pose;
    });
    poseInstancePromise.catch(() => { poseInstancePromise = null; });
  }
  return poseInstancePromise;
}

function waitForMediaEvent(media, successEvent, message) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(message));
    }, MEDIA_EVENT_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timeoutId);
      media.removeEventListener(successEvent, onSuccess);
      media.removeEventListener('error', onError);
    };
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(message));
    };
    media.addEventListener(successEvent, onSuccess, { once: true });
    media.addEventListener('error', onError, { once: true });
  });
}

async function waitForSeek(video, time) {
  if (Math.abs(video.currentTime - time) < 0.01 && video.readyState >= 2) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return;
  }
  const seeked = waitForMediaEvent(video, 'seeked', 'A leitura de quadros expirou ao avançar no vídeo.');
  video.currentTime = time;
  await seeked;
}

function sendPoseFrame(pose, video) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingPoseFrames.delete(pose);
      poseInstancePromise = null;
      Promise.resolve(pose.close()).catch(() => {});
      reject(new Error('A análise de um quadro expirou. Tente um vídeo menor ou em MP4/H.264.'));
    }, POSE_FRAME_TIMEOUT_MS);
    pendingPoseFrames.set(pose, { resolve, reject, timeoutId });
    Promise.resolve(pose.send({ image: video })).catch((error) => {
      const pending = pendingPoseFrames.get(pose);
      if (!pending || pending.resolve !== resolve) return;
      pendingPoseFrames.delete(pose);
      clearTimeout(timeoutId);
      reject(new Error(`O MediaPipe não conseguiu processar o quadro: ${error.message || 'erro de leitura'}`));
    });
  });
}

function calculateAngle(pointA, pointB, pointC) {
  if (![pointA, pointB, pointC].every((point) => (
    point
    && Number.isFinite(point.x)
    && Number.isFinite(point.y)
  ))) return null;

  const vectorA = { x: pointA.x - pointB.x, y: pointA.y - pointB.y };
  const vectorC = { x: pointC.x - pointB.x, y: pointC.y - pointB.y };
  if (!Math.hypot(vectorA.x, vectorA.y) || !Math.hypot(vectorC.x, vectorC.y)) return null;

  const radians = Math.atan2(vectorC.y, vectorC.x) - Math.atan2(vectorA.y, vectorA.x);
  let angle = Math.abs((radians * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

function getFrameAngle(landmarks, standard) {
  let best = null;
  for (const [firstIndex, jointIndex, lastIndex] of standard.landmarkTriplets) {
    const points = [landmarks[firstIndex], landmarks[jointIndex], landmarks[lastIndex]];
    if (points.some((point) => (
      !point
      || !Number.isFinite(Number(point.visibility))
      || Number(point.visibility) < MIN_LANDMARK_VISIBILITY
    ))) continue;
    const angle = calculateAngle(...points);
    const confidence = points.reduce((sum, point) => sum + Number(point.visibility), 0) / points.length;
    if (Number.isFinite(angle) && (!best || confidence > best.confidence)) best = { angle, confidence };
  }
  return best?.angle ?? null;
}

async function sampleVideoFrames(file, exerciseId, requestId, standard) {
  const pose = await getPose();
  const video = document.createElement('video');
  const objectUrl = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  try {
    const metadataLoaded = waitForMediaEvent(video, 'loadedmetadata', 'O navegador não conseguiu ler os metadados do vídeo.');
    video.src = objectUrl;
    video.load();
    await metadataLoaded;
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error('O vídeo não tem uma duração válida para análise.');
    }
    if (video.readyState < 2) {
      const frameDataLoaded = waitForMediaEvent(video, 'loadeddata', 'O navegador não conseguiu decodificar o primeiro quadro do vídeo.');
      await frameDataLoaded;
    }

    const frameCount = Math.min(MAX_SAMPLED_FRAMES, Math.max(MIN_SAMPLED_FRAMES, Math.ceil(video.duration * 2)));
    const angles = [];
    for (let index = 0; index < frameCount; index += 1) {
      if (analysisRequests.get(exerciseId) !== requestId) {
        throw new Error('A análise foi cancelada porque o vídeo deste exercício foi removido ou substituído.');
      }
      const fraction = frameCount === 1 ? 0 : index / (frameCount - 1);
      const time = Math.min(video.duration * fraction, Math.max(0, video.duration - 0.05));
      await waitForSeek(video, time);
      const result = await sendPoseFrame(pose, video);
      if (result.poseLandmarks) {
        const angle = getFrameAngle(result.poseLandmarks, standard);
        if (Number.isFinite(angle)) angles.push(angle);
      }
    }

    const requiredFrames = Math.max(3, Math.ceil(frameCount * 0.2));
    if (angles.length < requiredFrames) {
      throw new Error('Não foi possível identificar as articulações com confiança. Posicione a câmera de lado, mantenha o corpo inteiro visível e grave com boa iluminação.');
    }
    return angles;
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function analyzeInQueue(file, exercise, standard, requestId) {
  const run = async () => {
    if (analysisRequests.get(exercise.id) !== requestId) {
      throw new Error('A análise foi cancelada porque o vídeo deste exercício foi removido ou substituído.');
    }
    return sampleVideoFrames(file, exercise.id, requestId, standard);
  };
  const result = analysisQueue.then(run, run);
  analysisQueue = result.catch(() => {});
  return result;
}

export function getSavedAnalysis(exerciseId, date) {
  const key = analysisKey(exerciseId, date);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const analysis = JSON.parse(raw);
    if (
      analysis?.version !== ANALYSIS_VERSION
      || analysis?.exerciseId !== exerciseId
      || analysis.timestamp !== date
      || typeof analysis.isCorrect !== 'boolean'
      || typeof analysis.feedbackHTML !== 'string'
      || !Number.isFinite(Number(analysis.extraKcal))
    ) {
      localStorage.removeItem(key);
      return null;
    }
    return analysis;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function removeSavedAnalysis(exerciseId, date) {
  localStorage.removeItem(analysisKey(exerciseId, date));
}

export function removeSavedAnalyses(exerciseId) {
  if (!exerciseId) throw new TypeError('O ID do exercício é obrigatório para remover as análises.');
  const prefix = `${ANALYSIS_PREFIX}${exerciseId}_`;
  const keysToRemove = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

export function cancelExerciseAnalysis(exerciseId) {
  analysisRequests.set(exerciseId, (analysisRequests.get(exerciseId) || 0) + 1);
}

export function getDailyExtraKcal(date) {
  let total = 0;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(ANALYSIS_PREFIX) || !key.endsWith(`_${date}`)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const analysis = JSON.parse(raw);
      if (
        analysis.version === ANALYSIS_VERSION
        && analysis.timestamp === date
        && typeof analysis.exerciseId === 'string'
        && key === analysisKey(analysis.exerciseId, date)
        && Number.isFinite(Number(analysis.extraKcal))
      ) total += Math.max(0, Number(analysis.extraKcal));
    } catch {
      localStorage.removeItem(key);
      index -= 1;
    }
  }
  return total;
}

function createFeedback(standard, angles, exerciseId, exerciseName, date) {
  const minAngle = Math.min(...angles);
  const maxAngle = Math.max(...angles);
  const requiredPhaseFrames = Math.max(2, Math.ceil(angles.length * MIN_PHASE_FRAME_RATIO));
  const extensionAngle = standard.targetAngle + MIN_EXTENSION_ANGLE_MARGIN;
  const flexedFrames = angles.filter((angle) => angle <= standard.minAcceptableAngle).length;
  const extendedFrames = angles.filter((angle) => angle >= extensionAngle).length;
  const isCorrect = flexedFrames >= requiredPhaseFrames && extendedFrames >= requiredPhaseFrames;
  const statusText = isCorrect ? '🟢 AMPLITUDE DENTRO DA REFERÊNCIA' : '🟡 AMPLITUDE A REVISAR';
  const advice = isCorrect ? standard.adviceCorrect : standard.adviceIncorrect;
  const feedbackHTML = `<article class="analysis-feedback ${isCorrect ? 'correct' : 'needs-work'}"><h4>${statusText}</h4><p><strong>${escapeHTML(exerciseName)}</strong></p><p>Amplitude observada: <strong>${minAngle.toFixed(0)}°–${maxAngle.toFixed(0)}°</strong> (flexão de referência: até ${standard.minAcceptableAngle}°; extensão aproximada: ${extensionAngle}° ou mais).</p><p>${escapeHTML(advice)}</p><p class="analysis-disclaimer">Estimativa de amplitude 2D; não confirma a execução completa, não estima calorias e não substitui orientação profissional.</p></article>`;
  return {
    version: ANALYSIS_VERSION,
    exerciseId,
    isCorrect,
    minAngle,
    maxAngle,
    extraKcal: 0,
    statusText,
    feedbackHTML,
    timestamp: date
  };
}

export async function analyzeExerciseVideo(file, exercise) {
  if (!(file instanceof Blob) || !exercise?.id || !exercise?.name) {
    throw new TypeError('O vídeo e o exercício são obrigatórios para iniciar a análise.');
  }
  const requestId = (analysisRequests.get(exercise.id) || 0) + 1;
  analysisRequests.set(exercise.id, requestId);
  const standard = await standardForExercise(exercise.name);
  if (!standard) {
    throw new Error(`Não há parâmetros de análise cadastrados para “${exercise.name}”. Confira data/exercicios.json.`);
  }

  const angles = await analyzeInQueue(file, exercise, standard, requestId);
  if (analysisRequests.get(exercise.id) !== requestId) {
    throw new Error('A análise foi cancelada porque o vídeo deste exercício foi removido ou substituído.');
  }
  const date = new Date().toISOString().slice(0, 10);
  const analysis = createFeedback(standard, angles, exercise.id, exercise.name, date);
  localStorage.setItem(analysisKey(exercise.id, date), JSON.stringify(analysis));
  return analysis;
}
