import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';

// Under a bundler Leaflet cannot find its default marker images: point it at the imported files, once.
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

interface HotelMapProps {
  lat: number;
  lon: number;
  tiles: { urlTemplate: string; attribution: string; maxZoom: number };
  name: string;
}

/** A static pin on OpenStreetMap tiles. No routes, no directions. The attribution stays visible. */
export function HotelMap({ lat, lon, tiles, name }: HotelMapProps) {
  return (
    <div className="h-map overflow-hidden rounded-md border border-border" role="region" aria-label={`Map showing ${name}`}>
      <MapContainer center={[lat, lon]} zoom={15} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer url={tiles.urlTemplate} attribution={tiles.attribution} maxZoom={tiles.maxZoom} />
        <Marker position={[lat, lon]} />
      </MapContainer>
    </div>
  );
}
