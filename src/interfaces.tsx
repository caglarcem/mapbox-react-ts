export interface Location {
  coordinates: [number, number];
  address: string;
}

export interface ContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  lngLat: {
    lng: number;
    lat: number;
  };
}

export interface CurrentRoute {
  origin: Location | null;
  destination: Location | null;
  geometry: GeoJSON.LineString | null;
}

export interface Route {
  id: number;
  origin: Location;
  destination: Location;
  geometry: GeoJSON.LineString;
}
