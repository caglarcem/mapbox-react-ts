// This specifies a point on the map, with the additional address property to dynamically

import { LineString } from "geojson";

//    convert the coordinates to address for the left panel (reverse geocode)
export interface Waypoint {
  coordinates: [number, number];
  address: string;
}

export interface CurrentRoute {
  id: number;
  origin: Waypoint | null;
  destination: Waypoint | null;
  // Only the current route can be snapped - keeps the point information
  rerouteSnapPoint: [number, number] | null;
  geometry: LineString | null;
}

export interface Route {
  id: number;
  origin: Waypoint;
  destination: Waypoint;
  geometry: LineString | null;
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
