import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as d3 from 'd3'
import { wikiApi } from '../../api/wikiApi'

export default function KnowledgeGraph({ currentSlug, onClose }) {
  const svgRef = useRef(null)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nodeCount, setNodeCount] = useState(0)

  useEffect(() => {
    // Escape schließt den Graph
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false

    async function buildGraph() {
      try {
        const { data } = await wikiApi.getGraph()
        if (cancelled) return

        const { nodes, links } = data
        setNodeCount(nodes.length)
        setLoading(false)

        if (nodes.length === 0) return

        const container = svgRef.current.parentElement
        const W = container.clientWidth
        const H = container.clientHeight

        // SVG aufräumen
        d3.select(svgRef.current).selectAll('*').remove()

        const svg = d3.select(svgRef.current)
          .attr('width', W)
          .attr('height', H)

        // Zoom-Container
        const g = svg.append('g')

        svg.call(
          d3.zoom()
            .scaleExtent([0.2, 4])
            .on('zoom', (event) => g.attr('transform', event.transform))
        )

        // Verbindungen-Set für Hover
        const linkedMap = new Map()
        links.forEach(({ source, target }) => {
          const s = typeof source === 'object' ? source.id : source
          const t = typeof target === 'object' ? target.id : target
          if (!linkedMap.has(s)) linkedMap.set(s, new Set())
          if (!linkedMap.has(t)) linkedMap.set(t, new Set())
          linkedMap.get(s).add(t)
          linkedMap.get(t).add(s)
        })

        // Force-Simulation
        const simulation = d3.forceSimulation(nodes)
          .force('link', d3.forceLink(links).id((d) => d.id).distance(80))
          .force('charge', d3.forceManyBody().strength(-180))
          .force('center', d3.forceCenter(W / 2, H / 2))
          .force('collision', d3.forceCollide(28))

        // Kanten
        const link = g.append('g')
          .selectAll('line')
          .data(links)
          .join('line')
          .attr('stroke', '#4b5563')
          .attr('stroke-opacity', 0.35)
          .attr('stroke-width', 1.5)

        // Knoten-Gruppen
        const node = g.append('g')
          .selectAll('g')
          .data(nodes)
          .join('g')
          .style('cursor', 'pointer')
          .on('click', (event, d) => {
            event.stopPropagation()
            navigate(`/knowledge/${d.id}`)
            onClose()
          })

        // Drag
        node.call(
          d3.drag()
            .on('start', (event, d) => {
              if (!event.active) simulation.alphaTarget(0.3).restart()
              d.fx = d.x; d.fy = d.y
            })
            .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
            .on('end', (event, d) => {
              if (!event.active) simulation.alphaTarget(0)
              d.fx = null; d.fy = null
            })
        )

        // Knoten-Kreise
        node.append('circle')
          .attr('r', (d) => d.id === currentSlug ? 9 : 6)
          .attr('fill', (d) => {
            if (d.id === currentSlug) return '#7c3aed'  // aktuell: primary-700
            const hasLinks = linkedMap.has(d.id) && linkedMap.get(d.id).size > 0
            return hasLinks ? '#a78bfa' : '#6b7280'     // verlinkt: primary-400, solo: gray
          })
          .attr('stroke', '#1f2937')
          .attr('stroke-width', 1)

        // Labels
        node.append('text')
          .text((d) => d.title.length > 20 ? d.title.slice(0, 18) + '…' : d.title)
          .attr('x', 10)
          .attr('y', 4)
          .attr('font-size', '11px')
          .attr('fill', '#e5e7eb')
          .attr('pointer-events', 'none')

        // Hover: verbundene Knoten hervorheben
        node
          .on('mouseenter', (event, d) => {
            const neighbors = linkedMap.get(d.id) || new Set()
            node.select('circle').attr('opacity', (n) =>
              n.id === d.id || neighbors.has(n.id) ? 1 : 0.2
            )
            link.attr('stroke-opacity', (l) => {
              const s = typeof l.source === 'object' ? l.source.id : l.source
              const t = typeof l.target === 'object' ? l.target.id : l.target
              return s === d.id || t === d.id ? 0.9 : 0.05
            })
          })
          .on('mouseleave', () => {
            node.select('circle').attr('opacity', 1)
            link.attr('stroke-opacity', 0.35)
          })

        // Tick
        simulation.on('tick', () => {
          link
            .attr('x1', (d) => d.source.x)
            .attr('y1', (d) => d.source.y)
            .attr('x2', (d) => d.target.x)
            .attr('y2', (d) => d.target.y)
          node.attr('transform', (d) => `translate(${d.x},${d.y})`)
        })
      } catch {
        if (!cancelled) setError('Graph konnte nicht geladen werden')
        setLoading(false)
      }
    }

    buildGraph()
    return () => { cancelled = true }
  }, [currentSlug, navigate, onClose])

  return (
    <div className="fixed inset-0 z-[9000] bg-gray-950/96 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold text-sm">Knowledge Graph</span>
          {!loading && !error && (
            <span className="text-xs text-gray-500">{nodeCount} Seiten</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-600">Scrollen zum Zoomen · Ziehen zum Verschieben · Klick öffnet Seite</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1.5 rounded hover:bg-gray-800"
            title="Schließen (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-gray-500 text-sm">Lade Graph…</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}
        {!loading && !error && nodeCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
            <span className="text-4xl">📭</span>
            <span className="text-gray-500 text-sm">Noch keine Knowledge-Seiten vorhanden.</span>
          </div>
        )}
        <svg ref={svgRef} className="w-full h-full" />
      </div>

      {/* Legende */}
      <div className="flex items-center gap-5 px-5 py-2 border-t border-gray-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-purple-700 inline-block" />
          <span className="text-xs text-gray-500">Aktuelle Seite</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-400 inline-block" />
          <span className="text-xs text-gray-500">Verlinkte Seite</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-500 inline-block" />
          <span className="text-xs text-gray-500">Unverlinkte Seite</span>
        </div>
      </div>
    </div>
  )
}
