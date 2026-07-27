"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

// Типы для проектов на карте
export interface MapProject {
  id: string
  name: string
  address: string
  district?: string
  lat: number
  lng: number
  minPrice?: number
  class?: string
  buildingStatus?: string
  images?: string[]
}

interface ProjectMapProps {
  projects?: MapProject[]
  center?: [number, number]
  zoom?: number
  height?: string
  onProjectClick?: (project: MapProject) => void
  // Режим выбора координат для формы создания
  selectMode?: boolean
  onLocationSelect?: (lat: number, lng: number, address: string) => void
  selectedLocation?: { lat: number; lng: number } | null
}

// Динамический импорт карты (чтобы избежать SSR проблем)
export default function ProjectMap({
  projects = [],
  center = [51.1694, 71.4491], // Астана по умолчанию
  zoom = 12,
  height = "400px",
  onProjectClick,
  selectMode = false,
  onLocationSelect,
  selectedLocation,
}: ProjectMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const selectedMarkerRef = useRef<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Динамический импорт Leaflet
    const initMap = async () => {
      if (typeof window === "undefined" || !mapRef.current) return

      const L = (await import("leaflet")).default

      // Check cancellation AFTER the async import (StrictMode cleanup may have fired)
      if (cancelled || mapInstanceRef.current) return
      
      // Импортируем CSS через link элемент
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      // Фикс для иконок Leaflet
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      })

      // Clean up any leftover Leaflet state on the DOM element (React StrictMode re-mount)
      if ((mapRef.current as any)._leaflet_id) {
        delete (mapRef.current as any)._leaflet_id
      }

      // Создаем карту
      const map = L.map(mapRef.current).setView(center, zoom)
      mapInstanceRef.current = map

      // Ограничиваем карту границами Астаны
      const astanaBounds = L.latLngBounds(
        [50.85, 71.05], // Юго-западный угол
        [51.45, 71.85]  // Северо-восточный угол
      )
      map.setMaxBounds(astanaBounds)
      map.options.minZoom = 10

      // Добавляем тайлы OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map)

      // Режим выбора координат
      if (selectMode) {
        map.on("click", async (e: any) => {
          const { lat, lng } = e.latlng

          // Проверяем что координаты в пределах Астаны
          if (lat < 50.85 || lat > 51.45 || lng < 71.05 || lng > 71.85) {
            console.log("Координаты вне границ Астаны")
            return
          }

          // Удаляем предыдущий маркер
          if (selectedMarkerRef.current) {
            map.removeLayer(selectedMarkerRef.current)
          }

          // Добавляем новый маркер
          const marker = L.marker([lat, lng], {
            icon: L.divIcon({
              className: "custom-marker",
              html: `<div style="background: #22c55e; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            }),
          }).addTo(map)
          selectedMarkerRef.current = marker

          // Получаем адрес по координатам (reverse geocoding)
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ru`
            )
            const data = await response.json()
            const address = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
            onLocationSelect?.(lat, lng, address)
          } catch {
            onLocationSelect?.(lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`)
          }
        })

        // Если есть выбранная локация, показываем маркер
        if (selectedLocation) {
          const marker = L.marker([selectedLocation.lat, selectedLocation.lng], {
            icon: L.divIcon({
              className: "custom-marker",
              html: `<div style="background: #22c55e; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            }),
          }).addTo(map)
          selectedMarkerRef.current = marker
        }
      }

      setMapLoaded(true)
    }

    initMap()

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Обновляем маркеры проектов при изменении списка
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || selectMode) return

    const L = require("leaflet")

    // Удаляем старые маркеры
    markersRef.current.forEach((marker) => {
      mapInstanceRef.current.removeLayer(marker)
    })
    markersRef.current = []

    // Добавляем новые маркеры
    projects.forEach((project) => {
      if (!project.lat || !project.lng) return

      const marker = L.marker([project.lat, project.lng], {
        icon: L.divIcon({
          className: "custom-marker",
          html: `
            <div style="
              background: linear-gradient(135deg, #3b82f6, #1d4ed8);
              width: 36px;
              height: 36px;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg style="transform: rotate(45deg); width: 16px; height: 16px; fill: white;" viewBox="0 0 24 24">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -36],
        }),
      }).addTo(mapInstanceRef.current)

      // Popup с информацией
      const popupContent = `
        <div style="min-width: 200px; font-family: system-ui;">
          <h3 style="font-weight: 600; font-size: 14px; margin: 0 0 8px 0;">${project.name}</h3>
          <p style="color: #666; font-size: 12px; margin: 0 0 4px 0;">${project.address}</p>
          ${project.district ? `<p style="color: #666; font-size: 12px; margin: 0 0 4px 0;">Район: ${project.district}</p>` : ""}
          ${project.class ? `<p style="color: #888; font-size: 11px; margin: 0 0 8px 0;">Класс: ${project.class}</p>` : ""}
          ${project.minPrice ? `<p style="color: #22c55e; font-weight: 600; font-size: 13px; margin: 0;">от ${project.minPrice.toLocaleString()} ₸</p>` : ""}
        </div>
      `
      marker.bindPopup(popupContent)

      marker.on("click", () => {
        onProjectClick?.(project)
      })

      markersRef.current.push(marker)
    })

    // Центрируем карту на всех маркерах
    if (projects.length > 0 && projects.some((p) => p.lat && p.lng)) {
      const validProjects = projects.filter((p) => p.lat && p.lng)
      const bounds = L.latLngBounds(validProjects.map((p) => [p.lat, p.lng]))
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [projects, mapLoaded, selectMode, onProjectClick])

  // Обновляем выбранную локацию
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !selectMode || !selectedLocation) return

    const L = require("leaflet")

    if (selectedMarkerRef.current) {
      mapInstanceRef.current.removeLayer(selectedMarkerRef.current)
    }

    const marker = L.marker([selectedLocation.lat, selectedLocation.lng], {
      icon: L.divIcon({
        className: "custom-marker",
        html: `<div style="background: #22c55e; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(mapInstanceRef.current)
    selectedMarkerRef.current = marker

    mapInstanceRef.current.setView([selectedLocation.lat, selectedLocation.lng], 15)
  }, [selectedLocation, mapLoaded, selectMode])

  // Поиск адреса через Nominatim - только в Астане
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)

    try {
      // Ограничиваем поиск Астаной через viewbox и bounded=1
      const viewbox = "71.05,50.85,71.85,51.45" // lon_min,lat_min,lon_max,lat_max для Астаны
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ", Астана")}&limit=5&accept-language=ru&viewbox=${viewbox}&bounded=1`
      )
      const data = await response.json()
      // Дополнительно фильтруем результаты по координатам Астаны
      const filteredData = data.filter((item: any) => {
        const lat = parseFloat(item.lat)
        const lng = parseFloat(item.lon)
        return lat >= 50.85 && lat <= 51.45 && lng >= 71.05 && lng <= 71.85
      })
      setSearchResults(filteredData)
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)

    // Проверяем что координаты в пределах Астаны
    if (lat < 50.85 || lat > 51.45 || lng < 71.05 || lng > 71.85) {
      console.log("Выбранный адрес вне границ Астаны")
      setSearchResults([])
      setSearchQuery("")
      return
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 16)
    }

    if (selectMode) {
      // Удаляем предыдущий маркер
      if (selectedMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(selectedMarkerRef.current)
      }

      // Добавляем новый маркер
      const L = require("leaflet")
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "custom-marker",
          html: `<div style="background: #22c55e; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(mapInstanceRef.current)
      selectedMarkerRef.current = marker

      onLocationSelect?.(lat, lng, result.display_name)
    }

    setSearchResults([])
    setSearchQuery("")
  }

  return (
    <div className="relative" style={{ height }}>
      {/* Поиск адреса */}
      <div className="absolute top-2 left-2 right-2 z-[1000]">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск адреса..."
              className="pl-8 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? "..." : "Найти"}
          </Button>
        </div>

        {/* Результаты поиска */}
        {searchResults.length > 0 && (
          <Card className="mt-2 max-h-60 overflow-y-auto">
            {searchResults.map((result, index) => (
              <div
                key={index}
                className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                onClick={() => handleSelectSearchResult(result)}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="text-sm">{result.display_name}</span>
                </div>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setSearchResults([])}
            >
              <X className="h-4 w-4 mr-2" />
              Закрыть
            </Button>
          </Card>
        )}
      </div>

      {/* Карта */}
      <div ref={mapRef} className="w-full h-full rounded-lg" />

      {/* Подсказка для режима выбора */}
      {selectMode && (
        <div className="absolute bottom-2 left-2 right-2 z-[1000]">
          <Card className="p-2 bg-background/90 backdrop-blur-sm">
            <p className="text-sm text-muted-foreground text-center">
              Кликните на карту или найдите адрес для выбора местоположения
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
