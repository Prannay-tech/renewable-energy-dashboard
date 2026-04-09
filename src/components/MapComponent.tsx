'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, CircleMarker } from 'leaflet'
import type { StateElectricityData } from '@/store/dashboard'

// State centroids for placing markers
const STATE_CENTROIDS: Record<string, [number, number]> = {
  AL: [32.7, -86.7], AK: [64.2, -153.4], AZ: [34.3, -111.1], AR: [34.9, -92.4],
  CA: [36.8, -119.4], CO: [39.0, -105.5], CT: [41.6, -72.7], DE: [38.9, -75.5],
  FL: [28.6, -81.5], GA: [32.7, -83.4], HI: [20.3, -156.4], ID: [44.4, -114.6],
  IL: [40.0, -89.2], IN: [39.9, -86.3], IA: [42.1, -93.5], KS: [38.5, -98.4],
  KY: [37.5, -85.3], LA: [31.1, -91.9], ME: [45.4, -69.2], MD: [39.0, -76.8],
  MA: [42.3, -71.8], MI: [44.3, -85.4], MN: [46.3, -94.3], MS: [32.7, -89.7],
  MO: [38.4, -92.5], MT: [47.0, -110.5], NE: [41.5, -99.8], NV: [39.5, -116.8],
  NH: [43.7, -71.6], NJ: [40.1, -74.5], NM: [34.4, -106.1], NY: [42.9, -75.5],
  NC: [35.6, -79.4], ND: [47.5, -100.5], OH: [40.4, -82.8], OK: [35.6, -97.5],
  OR: [44.0, -120.6], PA: [40.9, -77.8], RI: [41.7, -71.6], SC: [33.9, -80.9],
  SD: [44.4, -100.2], TN: [35.9, -86.4], TX: [31.5, -99.3], UT: [39.3, -111.1],
  VT: [44.1, -72.7], VA: [37.5, -79.0], WA: [47.4, -120.5], WV: [38.9, -80.5],
  WI: [44.3, -90.0], WY: [43.0, -107.6],
}

interface MapComponentProps {
  stateData: StateElectricityData[]
  nrelData: Record<string, number>
  overlayMode: 'electricity' | 'solar'
  selectedState: StateElectricityData | null
  onStateSelect: (state: StateElectricityData) => void
}

function getPriceColor(price: number): string {
  if (price < 10) return '#1d4ed8'
  if (price < 13) return '#16a34a'
  if (price < 17) return '#d97706'
  return '#dc2626'
}

function getSolarColor(irradiance: number): string {
  if (irradiance < 4.0) return '#93c5fd'
  if (irradiance < 5.0) return '#fbbf24'
  if (irradiance < 6.0) return '#f97316'
  return '#dc2626'
}

export default function MapComponent({
  stateData,
  nrelData,
  overlayMode,
  selectedState,
  onStateSelect,
}: MapComponentProps) {
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<CircleMarker[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    // Guard against double-init in React strict mode
    if (mapRef.current) return

    let cancelled = false

    const initMap = async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current) return

      // Fix leaflet default icon paths
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      // Destroy any stale Leaflet instance that may be attached to the DOM node
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((containerRef.current as any)._leaflet_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(containerRef.current as any)._leaflet_id = null
      }

      const map = L.map(containerRef.current, {
        center: [39.5, -98.35],
        zoom: 4,
        zoomControl: true,
        attributionControl: true,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map)

      mapRef.current = map
    }

    initMap()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update markers when data or overlay changes
  useEffect(() => {
    if (!mapRef.current) return

    const updateMarkers = async () => {
      const L = (await import('leaflet')).default

      // Clear existing markers
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      if (stateData.length === 0) return

      stateData.forEach((state) => {
        const centroid = STATE_CENTROIDS[state.stateCode]
        if (!centroid) return

        const isSelected = selectedState?.stateCode === state.stateCode

        let color: string
        let value: string
        let secondLine: string

        if (overlayMode === 'electricity') {
          color = getPriceColor(state.avgPrice)
          value = `${state.avgPrice.toFixed(1)}¢/kWh`
          secondLine = `Solar: ${state.solarIrradiance?.toFixed(1) ?? 'N/A'} kWh/m²/d`
        } else {
          const irr = nrelData[state.stateCode] ?? 4.5
          color = getSolarColor(irr)
          value = `${irr.toFixed(1)} kWh/m²/d`
          secondLine = `Electricity: ${state.avgPrice.toFixed(1)}¢/kWh`
        }

        const marker = L.circleMarker(centroid, {
          radius: isSelected ? 14 : 10,
          fillColor: color,
          color: isSelected ? '#ffffff' : '#1e293b',
          weight: isSelected ? 3 : 1,
          opacity: 1,
          fillOpacity: 0.85,
        })

        marker.bindPopup(`
          <div style="font-family: system-ui; min-width: 160px;">
            <p style="font-weight: 700; font-size: 14px; margin: 0 0 8px; color: #1e293b;">${state.stateName}</p>
            <p style="margin: 3px 0; font-size: 12px; color: #334155;">⚡ ${value}</p>
            <p style="margin: 3px 0; font-size: 12px; color: #334155;">☀ ${secondLine}</p>
            <button
              onclick="window.__selectMapState('${state.stateCode}')"
              style="margin-top: 8px; width: 100%; padding: 5px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: 600;"
            >
              Use in Calculator →
            </button>
          </div>
        `, { maxWidth: 200 })

        marker.on('click', () => {
          onStateSelect(state)
          marker.openPopup()
        })

        marker.addTo(mapRef.current!)
        markersRef.current.push(marker)
      })
    }

    updateMarkers()
  }, [stateData, nrelData, overlayMode, selectedState, onStateSelect])

  // Expose global handler for popup button
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__selectMapState = (code: string) => {
      const state = stateData.find((s) => s.stateCode === code)
      if (state) onStateSelect(state)
    }
  }, [stateData, onStateSelect])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: '400px', background: '#0f172a' }}
    />
  )
}
