const DATABASE_NAME = 'fatfit-training-videos';
const DATABASE_VERSION = 1;
const VIDEO_STORE = 'videos';

let databasePromise;

function openDatabase() {
  if (!('indexedDB' in globalThis)) {
    return Promise.reject(new Error('Este navegador não oferece armazenamento local de vídeos.'));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(VIDEO_STORE)) {
        database.createObjectStore(VIDEO_STORE, { keyPath: 'exerciseId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error('Não foi possível abrir o armazenamento de vídeos.'));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error('O armazenamento de vídeos está bloqueado por outra aba. Feche outras abas do Fat Fit e tente novamente.'));
    };
  });
  return databasePromise;
}

export async function saveVideoBlob(exerciseId, file) {
  if (!exerciseId || !(file instanceof Blob)) throw new TypeError('Exercício ou vídeo inválido para armazenamento.');
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(VIDEO_STORE, 'readwrite');
    transaction.objectStore(VIDEO_STORE).put({
      exerciseId,
      blob: file,
      fileName: file.name || 'video',
      mimeType: file.type || 'video/mp4',
      savedAt: new Date().toISOString()
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Não foi possível salvar o vídeo.'));
    transaction.onabort = () => reject(transaction.error || new Error('O salvamento do vídeo foi cancelado.'));
  });
}

export async function getVideoBlob(exerciseId) {
  if (!exerciseId) throw new TypeError('O ID do exercício é obrigatório para recuperar o vídeo.');
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(VIDEO_STORE, 'readonly');
    const request = transaction.objectStore(VIDEO_STORE).get(exerciseId);
    request.onsuccess = () => resolve(request.result?.blob || null);
    request.onerror = () => reject(request.error || new Error('Não foi possível recuperar o vídeo salvo.'));
    transaction.onabort = () => reject(transaction.error || new Error('A leitura do vídeo foi cancelada.'));
  });
}

export async function deleteVideoBlob(exerciseId) {
  if (!exerciseId) throw new TypeError('O ID do exercício é obrigatório para remover o vídeo.');
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(VIDEO_STORE, 'readwrite');
    transaction.objectStore(VIDEO_STORE).delete(exerciseId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Não foi possível remover o vídeo salvo.'));
    transaction.onabort = () => reject(transaction.error || new Error('A remoção do vídeo foi cancelada.'));
  });
}
