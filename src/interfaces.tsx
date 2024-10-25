export interface Waypoint {
  coordinates: [number, number];
  address: string;
}

export interface CurrentRoute {
  origin: Waypoint | null;
  destination: Waypoint | null;
  imaginaryPoint: [number, number] | null;
  geometry: any;
}

export interface Route {
  id: number;
  origin: Waypoint;
  destination: Waypoint;
  geometry: any;
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
