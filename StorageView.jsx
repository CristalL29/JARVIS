import { useEffect, useMemo, useState } from 'react'
import { deleteStoredFile, getStoredFiles, saveFiles } from './localFileStore.js'

const FILE_FILTERS = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'image', label: 'Imágenes' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Vídeos' },
  { value: 'document', label: 'Documentos' },
  { value: 'other', label: 'Otros archivos' },
]

function getFileCategory(file) {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('text/') || file.type === 'application/pdf' || /\.(pdf|txt|md|csv|json|xml)$/i.test(file.name)) return 'document'
  return 'other'
}

function getFileSymbol(file) {
  const symbols = { image: '▧', audio: '♫', video: '▷', document: '▤', other: '□' }
  return symbols[getFileCategory(file)]
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function isTextFile(file) {
  return file.type.startsWith('text/') || /\.(txt|md|csv|json|xml)$/i.test(file.name)
}

function FilePreview({ file, previewUrl, onClose }) {
  const [textContent, setTextContent] = useState('')
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    let isActive = true
    if (isTextFile(file)) {
      file.blob.text()
        .then((content) => { if (isActive) setTextContent(content) })
        .catch(() => { if (isActive) setPreviewError('No se pudo leer el contenido de este archivo.') })
    }
    return () => {
      isActive = false
      URL.revokeObjectURL(previewUrl)
    }
  }, [file, previewUrl])

  const category = getFileCategory(file)
  let preview
  if (category === 'image') preview = <img className="storage-preview-image" src={previewUrl} alt={file.name} />
  else if (category === 'audio') preview = <audio className="storage-preview-media" src={previewUrl} controls />
  else if (category === 'video') preview = <video className="storage-preview-media" src={previewUrl} controls />
  else if (file.type === 'application/pdf') preview = <iframe className="storage-preview-pdf" src={previewUrl} title={`Vista previa de ${file.name}`} />
  else if (isTextFile(file)) preview = previewError
    ? <p className="storage-preview-message">{previewError}</p>
    : <pre className="storage-preview-text">{textContent || 'Cargando contenido…'}</pre>
  else preview = <p className="storage-preview-message">La vista previa no está disponible para este formato. Puedes descargar el archivo para abrirlo.</p>

  return <div className="storage-modal-backdrop" role="presentation" onClick={onClose}>
    <section className="storage-preview-modal" role="dialog" aria-modal="true" aria-labelledby="storage-preview-title" onClick={(event) => event.stopPropagation()}>
      <header className="storage-preview-heading">
        <div><p className="eyebrow">{file.folder} · {formatBytes(file.size)}</p><h2 id="storage-preview-title" title={file.name}>{file.name}</h2></div>
        <div className="storage-preview-actions">
          <a className="storage-icon-button" href={previewUrl} download={file.name} aria-label={`Descargar ${file.name}`} title="Descargar">↓</a>
          <button className="storage-icon-button" type="button" onClick={onClose} aria-label="Cerrar vista previa" title="Cerrar">×</button>
        </div>
      </header>
      <div className="storage-preview-body">{preview}</div>
    </section>
  </div>
}

function StorageView() {
  const [files, setFiles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [folderFilter, setFolderFilter] = useState('all')
  const [uploadFolder, setUploadFolder] = useState('General')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [folderDraft, setFolderDraft] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)

  const refreshFiles = async () => {
    setIsLoading(true)
    try {
      setFiles(await getStoredFiles())
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'No se pudieron cargar los archivos locales.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true
    getStoredFiles()
      .then((storedFiles) => { if (isActive) setFiles(storedFiles) })
      .catch((loadError) => { if (isActive) setError(loadError.message || 'No se pudieron cargar los archivos locales.') })
      .finally(() => { if (isActive) setIsLoading(false) })
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    if (!selectedFile) return undefined
    return () => URL.revokeObjectURL(selectedFile.previewUrl)
  }, [selectedFile])

  const folders = useMemo(() => [...new Set(['General', ...files.map((file) => file.folder)])].sort((first, second) => first.localeCompare(second, 'es')), [files])
  const filteredFiles = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('es')
    return files.filter((file) => {
      const matchesSearch = !normalizedSearch || `${file.name} ${file.folder}`.toLocaleLowerCase('es').includes(normalizedSearch)
      const matchesFolder = folderFilter === 'all' || file.folder === folderFilter
      const matchesType = typeFilter === 'all' || getFileCategory(file) === typeFilter
      return matchesSearch && matchesFolder && matchesType
    })
  }, [files, folderFilter, search, typeFilter])
  const totalSize = files.reduce((total, file) => total + file.size, 0)

  const handleUpload = async (event) => {
    const input = event.currentTarget
    const selectedFiles = [...input.files]
    const folder = (isCreatingFolder ? folderDraft : uploadFolder).trim()
    input.value = ''
    if (!selectedFiles.length) return
    if (!folder) {
      setError('Escribe un nombre para la carpeta antes de guardar archivos.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      await saveFiles(selectedFiles, folder)
      setUploadFolder(folder)
      setIsCreatingFolder(false)
      setFolderDraft('')
      await refreshFiles()
    } catch (saveError) {
      setError(saveError.name === 'QuotaExceededError'
        ? 'No hay espacio disponible en el almacenamiento del navegador.'
        : saveError.message || 'No se pudieron guardar los archivos.')
    } finally {
      setIsSaving(false)
    }
  }

  const removeFile = async (file) => {
    try {
      await deleteStoredFile(file.id)
      if (selectedFile?.id === file.id) setSelectedFile(null)
      await refreshFiles()
    } catch (deleteError) {
      setError(deleteError.message || 'No se pudo eliminar el archivo.')
    }
  }

  return <section className="feature-view storage-view" aria-labelledby="storage-heading">
    <div className="feature-heading storage-heading">
      <div><p className="eyebrow">ARCHIVOS EN ESTE DISPOSITIVO</p><h1 id="storage-heading">Almacenamiento</h1></div>
      <div className="storage-summary" aria-live="polite"><strong>{files.length}</strong><span>archivos</span><i /><strong>{formatBytes(totalSize)}</strong><span>ocupados</span></div>
    </div>

    <section className="storage-upload-panel" aria-label="Guardar archivos">
      <div className="storage-upload-copy"><span className="storage-upload-symbol" aria-hidden="true">↑</span><div><h2>Guardar archivos locales</h2><p>Se guardan en este dispositivo y permanecen disponibles sin conexión.</p></div></div>
      <div className="storage-upload-controls">
        <label className="sr-only" htmlFor="storage-folder">Carpeta de destino</label>
        {isCreatingFolder
          ? <div className="storage-new-folder"><input id="storage-folder" value={folderDraft} onChange={(event) => setFolderDraft(event.target.value)} placeholder="Nombre de carpeta" aria-label="Nombre de carpeta" /><button type="button" onClick={() => { setIsCreatingFolder(false); setFolderDraft('') }} aria-label="Cancelar carpeta nueva" title="Cancelar">×</button></div>
          : <select id="storage-folder" value={uploadFolder} onChange={(event) => event.target.value === '__new__' ? setIsCreatingFolder(true) : setUploadFolder(event.target.value)} aria-label="Carpeta de destino">
            {folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
            <option value="__new__">+ Crear carpeta</option>
          </select>}
        <label className={`storage-upload-button ${isSaving ? 'is-disabled' : ''}`}>
          <input type="file" multiple disabled={isSaving} onChange={handleUpload} />
          <span aria-hidden="true">＋</span>{isSaving ? 'Guardando…' : 'Añadir archivos'}
        </label>
      </div>
    </section>

    {error && <p className="storage-error" role="alert">{error}</p>}

    <div className="storage-library-heading"><div><p className="eyebrow">BIBLIOTECA LOCAL</p><h2>Mis archivos</h2></div><span>{filteredFiles.length} de {files.length}</span></div>
    <div className="storage-filters">
      <label className="storage-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar archivos o carpetas…" aria-label="Buscar archivos o carpetas" /></label>
      <label><span className="sr-only">Filtrar por carpeta</span><select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)}><option value="all">Todas las carpetas</option>{folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}</select></label>
      <label><span className="sr-only">Filtrar por tipo</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>{FILE_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label>
    </div>

    {isLoading ? <div className="storage-empty"><span className="storage-empty-symbol" aria-hidden="true">◌</span><p>Cargando archivos locales…</p></div>
      : filteredFiles.length ? <div className="storage-file-grid">{filteredFiles.map((file) => <article className="storage-file" key={file.id}>
        <button className="storage-file-open" type="button" onClick={() => setSelectedFile({ ...file, previewUrl: URL.createObjectURL(file.blob) })} aria-label={`Abrir ${file.name}`}>
          <span className={`storage-file-symbol is-${getFileCategory(file)}`} aria-hidden="true">{getFileSymbol(file)}</span>
          <span className="storage-file-info"><strong title={file.name}>{file.name}</strong><span>{file.folder} · {formatBytes(file.size)}</span><time dateTime={file.addedAt}>Guardado {formatDate(file.addedAt)}</time></span>
          <span className="storage-file-chevron" aria-hidden="true">›</span>
        </button>
        <button className="storage-delete-button" type="button" onClick={() => removeFile(file)} aria-label={`Eliminar ${file.name}`} title="Eliminar archivo">×</button>
      </article>)}</div>
      : <div className="storage-empty"><span className="storage-empty-symbol" aria-hidden="true">▤</span><h2>{files.length ? 'No se encontraron archivos' : 'Tu biblioteca está vacía'}</h2><p>{files.length ? 'Prueba con otra búsqueda o cambia los filtros.' : 'Añade archivos desde tu dispositivo para acceder a ellos sin conexión.'}</p></div>}

    {selectedFile && <FilePreview key={selectedFile.id} file={selectedFile} previewUrl={selectedFile.previewUrl} onClose={() => setSelectedFile(null)} />}
  </section>
}

export default StorageView