import { useState, useCallback, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const COLOR_MAP: Record<string, string> = {
  yellow: 'rgba(255, 235, 59, 0.35)',
  red: 'rgba(244, 67, 54, 0.3)',
  green: 'rgba(76, 175, 80, 0.3)',
  blue: 'rgba(33, 150, 243, 0.3)',
  purple: 'rgba(156, 39, 176, 0.3)',
}

export interface HypothesisAnnotation {
  id: string
  uri: string
  text?: string
  tags?: string[]
  target?: Array<{
    source: string
    selector?: Array<{
      type: string
      exact?: string
    }>
  }>
}

interface HighlightOverlay {
  top: number
  left: number
  width: number
  height: number
  color: string
}

interface PDFViewerProps {
  url: string
  annotations: HypothesisAnnotation[]
}

function getAnnotationColor(annotation: HypothesisAnnotation): string {
  const colorTag = annotation.tags?.find((t) => t.startsWith('color:'))
  if (colorTag) {
    const colorName = colorTag.split(':')[1]
    return COLOR_MAP[colorName] ?? COLOR_MAP.yellow
  }
  return COLOR_MAP.yellow
}

function getAnnotationExact(annotation: HypothesisAnnotation): string | null {
  if (!annotation.target) return null
  for (const target of annotation.target) {
    if (!target.selector) continue
    for (const sel of target.selector) {
      if (sel.type === 'TextQuoteSelector' && sel.exact) {
        return sel.exact
      }
    }
  }
  return null
}

export default function PDFViewer({ url, annotations }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pageOverlays, setPageOverlays] = useState<Record<number, HighlightOverlay[]>>({})
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Reset state when URL changes
  useEffect(() => {
    setNumPages(0)
    setLoadError(null)
    setPageOverlays({})
    pageRefs.current.clear()
  }, [url])

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n)
    setLoadError(null)
  }, [])

  const onDocumentLoadError = useCallback((error: Error) => {
    setLoadError(
      `Failed to load PDF. This may be due to CORS restrictions. Try a PDF from arxiv.org or another CORS-friendly host. (${error.message})`
    )
  }, [])

  const computeOverlaysForPage = useCallback(
    (pageNumber: number) => {
      const pageDiv = pageRefs.current.get(pageNumber)
      if (!pageDiv) return

      const textLayer = pageDiv.querySelector('.react-pdf__Page__textContent')
      if (!textLayer) return

      const spans = Array.from(textLayer.querySelectorAll('span'))
      if (spans.length === 0) return

      // Build concatenated text and track span boundaries
      const spanTexts: string[] = []
      let fullText = ''
      const spanOffsets: Array<{ start: number; end: number }> = []

      for (const span of spans) {
        const text = span.textContent ?? ''
        spanOffsets.push({ start: fullText.length, end: fullText.length + text.length })
        spanTexts.push(text)
        fullText += text
      }

      const overlays: HighlightOverlay[] = []
      const pageRect = pageDiv.getBoundingClientRect()

      for (const annotation of annotations) {
        const exact = getAnnotationExact(annotation)
        if (!exact) continue

        const color = getAnnotationColor(annotation)

        // Find all occurrences of the exact text in this page
        let searchStart = 0
        while (searchStart < fullText.length) {
          const idx = fullText.indexOf(exact, searchStart)
          if (idx === -1) break

          const matchEnd = idx + exact.length

          // Find which spans overlap with this match
          for (let i = 0; i < spanOffsets.length; i++) {
            const so = spanOffsets[i]
            if (so.end <= idx || so.start >= matchEnd) continue

            // Use Range API to get the rect of only the matching substring
            const textNode = spans[i].firstChild
            if (!textNode) continue

            const rangeStart = Math.max(0, idx - so.start)
            const rangeEnd = Math.min(so.end - so.start, matchEnd - so.start)

            const range = document.createRange()
            range.setStart(textNode, rangeStart)
            range.setEnd(textNode, rangeEnd)

            const rects = range.getClientRects()
            for (const rect of rects) {
              overlays.push({
                top: rect.top - pageRect.top,
                left: rect.left - pageRect.left,
                width: rect.width,
                height: rect.height,
                color,
              })
            }
            range.detach()
          }

          searchStart = idx + 1
        }
      }

      setPageOverlays((prev) => ({ ...prev, [pageNumber]: overlays }))
    },
    [annotations]
  )

  // Recompute overlays when annotations change
  useEffect(() => {
    if (annotations.length === 0) {
      setPageOverlays({})
      return
    }
    // Small delay to allow text layers to render
    const timer = setTimeout(() => {
      for (let i = 1; i <= numPages; i++) {
        computeOverlaysForPage(i)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [annotations, numPages, computeOverlaysForPage])

  const onPageRenderSuccess = useCallback(
    (page: { pageNumber: number }) => {
      // Delay to ensure text layer DOM is ready
      setTimeout(() => computeOverlaysForPage(page.pageNumber), 200)
    },
    [computeOverlaysForPage]
  )

  return (
    <div className="pdf-viewer-container">
      {loadError && <p className="error">{loadError}</p>}
      <Document
        file={url}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={<p>Loading PDF...</p>}
      >
        {Array.from({ length: numPages }, (_, i) => {
          const pageNum = i + 1
          return (
            <div
              key={pageNum}
              className="pdf-page-wrapper"
              ref={(el) => {
                if (el) pageRefs.current.set(pageNum, el)
              }}
            >
              <Page
                pageNumber={pageNum}
                width={800}
                onRenderSuccess={() => onPageRenderSuccess({ pageNumber: pageNum })}
              />
              {(pageOverlays[pageNum] ?? []).map((ov, idx) => (
                <div
                  key={idx}
                  className="highlight-overlay"
                  style={{
                    top: ov.top,
                    left: ov.left,
                    width: ov.width,
                    height: ov.height,
                    backgroundColor: ov.color,
                  }}
                />
              ))}
            </div>
          )
        })}
      </Document>
    </div>
  )
}
