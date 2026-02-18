import { type FormEvent, useState, useCallback } from 'react'
import PDFViewer, { type HypothesisAnnotation } from './components/PDFViewer.tsx'
import './App.css'

const HYPOTHESIS_API_URL = 'https://hypothes.is/api/annotations'
const HYPOTHESIS_SEARCH_URL = 'https://hypothes.is/api/search'

const COLORS = [
  { name: 'yellow', hex: '#FFEB3B' },
  { name: 'red', hex: '#F44336' },
  { name: 'green', hex: '#4CAF50' },
  { name: 'blue', hex: '#2196F3' },
  { name: 'purple', hex: '#9C27B0' },
]

function App() {
  const [pdfUrlInput, setPdfUrlInput] = useState('')
  const [loadedPdfUrl, setLoadedPdfUrl] = useState<string | null>(null)
  const [highlightText, setHighlightText] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [annotations, setAnnotations] = useState<HypothesisAnnotation[]>([])
  const [selectedColor, setSelectedColor] = useState('yellow')

  const fetchAnnotations = useCallback(async (pdfUrl: string) => {
    try {
      const token = import.meta.env.VITE_HYPOTHESIS_API_TOKEN
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {}

      const res = await fetch(
        `${HYPOTHESIS_SEARCH_URL}?uri=${encodeURIComponent(pdfUrl)}&limit=200`,
        { headers }
      )
      if (!res.ok) return
      const data = await res.json()
      setAnnotations(data.rows ?? [])
    } catch {
      // Silently fail — annotations just won't render
    }
  }, [])

  const handleLoadPdf = (e: FormEvent) => {
    e.preventDefault()
    const url = pdfUrlInput.trim()
    if (!url) return
    setLoadedPdfUrl(url)
    setStatus(null)
    setError(null)
    setAnnotations([])
    fetchAnnotations(url)
  }

  const handleCreateHighlight = async () => {
    if (!loadedPdfUrl) {
      setError('Please load a PDF URL first.')
      return
    }
    if (!highlightText.trim()) {
      setError('Please enter text to highlight.')
      return
    }

    setStatus('Creating highlight annotation via Hypothesis...')
    setError(null)

    try {
      const token = import.meta.env.VITE_HYPOTHESIS_API_TOKEN

      if (!token) {
        throw new Error(
          'API token not found. Please create a .env file in the project root with: VITE_HYPOTHESIS_API_TOKEN=your_token_here and restart the dev server.'
        )
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }

      const annotationPayload = {
        uri: loadedPdfUrl,
        text: `Highlight: ${highlightText.trim()}`,
        tags: [`color:${selectedColor}`],
        group: '__world__',
        permissions: {
          read: ['group:__world__'],
        },
        target: [
          {
            source: loadedPdfUrl,
            selector: [
              {
                type: 'TextQuoteSelector',
                exact: highlightText.trim(),
              },
            ],
          },
        ],
      }

      const response = await fetch(HYPOTHESIS_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(annotationPayload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        console.log('Error response body:', body)

        const errorMsg =
          body && body.reason
            ? `Hypothesis error: ${body.reason}`
            : `Request failed with status ${response.status}`

        if (response.status === 404) {
          throw new Error(
            `Endpoint not found (404). URL: ${HYPOTHESIS_API_URL}. Please check: 1) Your API token is correct (check .env file), 2) You've restarted the dev server, 3) The token format is correct.`
          )
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error(
            `${errorMsg}. The REST API requires a separate API token. Get one from https://hypothes.is/settings/developer and add it to .env as VITE_HYPOTHESIS_API_TOKEN=your_token_here, then restart the dev server.`
          )
        }
        throw new Error(errorMsg)
      }

      // Optimistically add the new annotation so it renders immediately
      const created: HypothesisAnnotation = await response.json()
      setAnnotations((prev) => [...prev, created])
      setStatus('Highlight created and rendered on the PDF.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unknown error while creating highlight.'
      )
      setStatus(null)
    }
  }

  return (
    <div className="app-root">
      <h1>Hypothesis PDF Highlight Demo</h1>

      <section className="card">
        <h2>1. Enter a PDF URL</h2>
        <form onSubmit={handleLoadPdf} className="form">
          <label>
            PDF URL (publicly accessible, CORS-friendly):
            <input
              type="url"
              value={pdfUrlInput}
              onChange={(e) => setPdfUrlInput(e.target.value)}
              placeholder="https://arxiv.org/pdf/2301.00001"
              required
            />
          </label>
          <button type="submit">Load PDF</button>
        </form>
      </section>

      <section className="card">
        <h2>2. Create a highlight</h2>
        <label>
          Exact text in the PDF:
          <input
            type="text"
            value={highlightText}
            onChange={(e) => setHighlightText(e.target.value)}
            placeholder="Type text that exists in the PDF"
          />
        </label>
        <div className="color-picker">
          <span className="color-picker-label">Highlight color:</span>
          {COLORS.map((c) => (
            <button
              key={c.name}
              className={`color-swatch ${selectedColor === c.name ? 'selected' : ''}`}
              style={{ backgroundColor: c.hex }}
              onClick={() => setSelectedColor(c.name)}
              title={c.name}
              type="button"
            />
          ))}
        </div>
        <button onClick={handleCreateHighlight} disabled={!loadedPdfUrl}>
          Create Hypothesis highlight
        </button>
      </section>

      {status && <p className="status">{status}</p>}
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>3. PDF Viewer</h2>
        {!loadedPdfUrl && (
          <p>Load a PDF URL above to see it here with highlights.</p>
        )}
        {loadedPdfUrl && (
          <PDFViewer url={loadedPdfUrl} annotations={annotations} />
        )}
      </section>
    </div>
  )
}

export default App
