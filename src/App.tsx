import { type FormEvent, useState, useRef } from 'react'
import './App.css'

const HYPOTHESIS_API_URL = 'https://hypothes.is/api/annotations'

interface Annotation {
  id: string
  uri: string
  text?: string
  target?: Array<{
    source: string
    selector?: Array<{
      type: string
      exact?: string
    }>
  }>
}

function App() {
  const [pdfUrlInput, setPdfUrlInput] = useState('')
  const [loadedPdfUrl, setLoadedPdfUrl] = useState<string | null>(null)
  const [highlightText, setHighlightText] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [foundAnnotations, setFoundAnnotations] = useState<Annotation[]>([])
  const [iframeKey, setIframeKey] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handleLoadPdf = (e: FormEvent) => {
    e.preventDefault()
    if (!pdfUrlInput.trim()) return
    setLoadedPdfUrl(pdfUrlInput.trim())
    setStatus(null)
    setError(null)
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

    setStatus('Creating highlight annotation via Hypothesis…')
    setError(null)

    try {
      // Get API token from environment variable
      const token = import.meta.env.VITE_HYPOTHESIS_API_TOKEN
      
      if (!token) {
        throw new Error(
          'API token not found. Please create a .env file in the project root with: VITE_HYPOTHESIS_API_TOKEN=your_token_here and restart the dev server.'
        )
      }

      // Debug: Log token presence (but not the actual token for security)
      console.log('API token found:', token ? 'Yes (length: ' + token.length + ')' : 'No')
      console.log('Endpoint URL:', HYPOTHESIS_API_URL)

      // Create annotation via the Hypothesis API
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }

      const annotationPayload = {
        uri: loadedPdfUrl,
        text: `Highlight: ${highlightText.trim()}`,
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

      console.log('Sending request to:', HYPOTHESIS_API_URL)
      console.log('Request payload:', JSON.stringify(annotationPayload, null, 2))

      const response = await fetch(HYPOTHESIS_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(annotationPayload),
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        console.log('Error response body:', body)
        
        const errorMsg =
          body && body.reason
            ? `Hypothesis error: ${body.reason}`
            : `Request failed with status ${response.status}`

        // 404 can occur if endpoint is wrong or authentication is missing
        if (response.status === 404) {
          throw new Error(
            `Endpoint not found (404). URL: ${HYPOTHESIS_API_URL}. Please check: 1) Your API token is correct (check .env file), 2) You've restarted the dev server, 3) The token format is correct (should start with a string, no quotes needed in .env). Check the browser console for more details.`
          )
        }

        if (response.status === 401 || response.status === 403) {
          // Even if logged into Hypothesis web interface, REST API requires an API token
          throw new Error(
            `${errorMsg}. Even though you're logged into Hypothesis, the REST API requires a separate API token for programmatic access. Get one from https://hypothes.is/settings/developer and add it to a .env file as VITE_HYPOTHESIS_API_TOKEN=your_token_here, then restart the dev server (npm run dev). Alternatively, you can manually highlight text using the Hypothesis sidebar in the PDF viewer.`
          )
        }
        throw new Error(errorMsg)
      }

      const createdAnnotation = await response.json()
      setFoundAnnotations([createdAnnotation])
      
      setStatus(
        `Successfully created highlight annotation! Reloading viewer to show it...`
      )

      // Reload the iframe to show the new annotation
      setTimeout(() => {
        setIframeKey((prev) => prev + 1)
        setStatus(
          `Highlight created successfully! The annotation should now be visible in the PDF. If you don't see it, try opening the Hypothesis sidebar (click the Hypothesis icon) or refreshing the page.`
        )
      }, 500)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unknown error while creating highlight.'
      )
      setStatus(null)
    }
  }

  // Construct URL - via.hypothes.is will automatically show annotations for the PDF
  const viaHypothesisUrl =
    loadedPdfUrl != null ? `https://via.hypothes.is/${loadedPdfUrl}` : null

  return (
    <div className="app-root">
      <h1>Hypothesis PDF Highlight Demo</h1>

      <section className="card">
        <h2>1. Enter a PDF URL</h2>
        <form onSubmit={handleLoadPdf} className="form">
          <label>
            PDF URL (publicly accessible):
            <input
              type="url"
              value={pdfUrlInput}
              onChange={(e) => setPdfUrlInput(e.target.value)}
              placeholder="https://example.com/sample.pdf"
              required
            />
          </label>
          <button type="submit">Load PDF</button>
        </form>
      </section>

      <section className="card">
        <h2>2. Text to highlight</h2>
        <label>
          Exact text in the PDF:
          <input
            type="text"
            value={highlightText}
            onChange={(e) => setHighlightText(e.target.value)}
            placeholder="Type text that exists in the PDF"
          />
        </label>
        <button onClick={handleCreateHighlight} disabled={!loadedPdfUrl}>
          Create Hypothesis highlight
        </button>
      </section>

      {status && <p className="status">{status}</p>}
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>3. PDF Viewer (via Hypothesis)</h2>
        {!viaHypothesisUrl && (
          <p>Load a PDF URL above to see it here with Hypothesis enabled.</p>
        )}
        {viaHypothesisUrl && (
          <>
            <iframe
              key={iframeKey}
              ref={iframeRef}
              title="PDF via Hypothesis"
              src={viaHypothesisUrl}
              className="pdf-frame"
            />
            {foundAnnotations.length > 0 && (
              <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#666' }}>
                <p>
                  <strong>Found {foundAnnotations.length} annotation(s):</strong>
                </p>
                <ul style={{ textAlign: 'left', display: 'inline-block' }}>
                  {foundAnnotations.map((ann, idx) => (
                    <li key={ann.id}>
                      <a
                        href={`https://hypothes.is/a/${ann.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#0066cc' }}
                      >
                        Annotation {idx + 1}
                      </a>
                      {ann.text && (
                        <span style={{ marginLeft: '10px', fontStyle: 'italic' }}>
                          "{ann.text.substring(0, 50)}..."
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p style={{ marginTop: '10px' }}>
                  <em>
                    Note: Open the Hypothesis sidebar (click the Hypothesis icon) to see
                    highlights in the PDF. You may need to log in to Hypothesis to see
                    all annotations.
                  </em>
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

export default App
