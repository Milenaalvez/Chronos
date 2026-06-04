import { useEffect, useRef } from "react"
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface LocationMapProps {
  latitude: number
  longitude: number
  accuracy: number
  address?: string
  city?: string
  state?: string
  height?: string
  interactive?: boolean
  live?: boolean
}

function MapBoundsUpdater({ latitude, longitude, live }: { latitude: number; longitude: number; live?: boolean }) {
  const map = useMap()
  const done = useRef(false)

  useEffect(() => {
    if (live) {
      map.setView([latitude, longitude], map.getZoom(), { animate: true })
    } else if (!done.current) {
      map.setView([latitude, longitude], 15)
      done.current = true
    }
  }, [map, latitude, longitude, live])

  return null
}

const blueIcon = new L.DivIcon({
  className: "",
  iconSize: [28, 42],
  iconAnchor: [14, 42],
  html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center">
    <div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;display:flex;align-items:center;justify-content:center">
      <div style="width:7px;height:7px;border-radius:50%;background:white"></div>
    </div>
    <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid #3b82f6;margin-top:-1px"></div>
  </div>`,
})

export function LocationMap({ latitude, longitude, accuracy, address, city, state, height = "140px", interactive = false, live = false }: LocationMapProps) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-white/5 w-full h-full">
      <MapContainer
        center={[latitude, longitude]}
        zoom={15}
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        keyboard={interactive}
        attributionControl={false}
        style={{ height, width: "100%" }}
        className="z-0"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          detectRetina
        />

        <Circle
          center={[latitude, longitude]}
          radius={accuracy || 50}
          pathOptions={{
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.08,
            weight: 1,
            opacity: 0.3,
          }}
        />

        <Circle
          center={[latitude, longitude]}
          radius={(accuracy || 50) * 0.5}
          pathOptions={{
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.05,
            weight: 1,
            opacity: 0.15,
            dashArray: "4 6",
          }}
        />

        <Marker
          position={[latitude, longitude]}
          icon={blueIcon}
        />

        <MapBoundsUpdater latitude={latitude} longitude={longitude} live={live} />
      </MapContainer>

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
        <span className="text-[10px] font-medium text-white/80 truncate max-w-[70%]">
          {address && `${address}${city ? ", " : ""}`}{city && `${city}/${state}`}
        </span>
        <span className="text-[8px] font-mono text-white/50 shrink-0">
          ±{accuracy}m
        </span>
      </div>
    </div>
  )
}
