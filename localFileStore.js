const DATABASE_NAME = 'jarvis-local-storage'
const DATABASE_VERSION = 1
const FILE_STORE = 'files'

let databasePromise

function openDatabase() {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('Este navegador no permite almacenamiento local de archivos.'))
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(FILE_STORE)) {
          database.createObjectStore(FILE_STORE, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento local.'))
      request.onblocked = () => reject(new Error('Cierra otras pestañas de JARVIS para actualizar el almacenamiento.'))
    }).catch((error) => {
      databasePromise = undefined
      throw error
    })
  }

  return databasePromise
}

function waitForTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar el archivo.'))
    transaction.onabort = () => reject(transaction.error || new Error('Se canceló el almacenamiento del archivo.'))
  })
}

export async function getStoredFiles() {
  const database = await openDatabase()
  const transaction = database.transaction(FILE_STORE, 'readonly')
  const request = transaction.objectStore(FILE_STORE).getAll()
  const files = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('No se pudieron leer los archivos guardados.'))
  })
  return files.sort((first, second) => second.addedAt.localeCompare(first.addedAt))
}

export async function saveFiles(files, folder) {
  const database = await openDatabase()
  const transaction = database.transaction(FILE_STORE, 'readwrite')
  const completed = waitForTransaction(transaction)
  const store = transaction.objectStore(FILE_STORE)

  for (const file of files) {
    store.put({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      lastModified: file.lastModified,
      folder,
      addedAt: new Date().toISOString(),
      blob: file,
    })
  }

  await completed
}

export async function deleteStoredFile(id) {
  const database = await openDatabase()
  const transaction = database.transaction(FILE_STORE, 'readwrite')
  const completed = waitForTransaction(transaction)
  transaction.objectStore(FILE_STORE).delete(id)
  await completed
}