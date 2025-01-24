import { LineString } from "geojson";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import React, { useEffect, useRef, useState } from "react";
import MapGL, {
  Layer,
  MapLayerMouseEvent,
  MapMouseEvent,
  MapRef,
  Marker,
  Source,
} from "react-map-gl";
import AddressEntry from "./AddressEntry";
import { ContextMenuProps, CurrentRoute, Route, Waypoint } from "./interfaces";
import CustomMarker from "./Marker";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_API_TOKEN || "";

const mapboxDirectionsApi =
  "https://api.mapbox.com/directions/v5/mapbox/walking";
const mapboxGeocodingApi = "https://api.mapbox.com/geocoding/v5/mapbox.places";

const App: React.FC = () => {
  const [contextMenu, setContextMenu] = useState<ContextMenuProps>({
    visible: false,
    x: 0,
    y: 0,
    lngLat: { lng: 0, lat: 0 },
  });

  const [currentRoute, setCurrentRoute] = useState<CurrentRoute>({
    origin: null,
    destination: null,
    rerouteSnapPoint: null,
    geometry: null,
    id: 0,
  });

  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeCounter, setRouteCounter] = useState<number>(1);
  // Caching reverse geocode in-memory in order to reduce the number of calls to the api
  //  This avoids exceeding the rate limit for the geocoding api
  const reverseGeocodeCache = new Map<string, string>();

  const mapRef = useRef<MapRef | null>(null);

  // Right-click context menu which records the point and opens up for setting origin or destination
  const handleContextMenu = (e: MapMouseEvent) => {
    e.preventDefault();

    const { point, lngLat } = e;
    setContextMenu({
      visible: true,
      x: point.x,
      y: point.y,
      lngLat,
    });
  };

  // Closes the context menu
  // TODO we will add setting single point later on
  const handleMapClick = (e: MapLayerMouseEvent) => {
    if (contextMenu.visible) {
      setContextMenu({ ...contextMenu, visible: false });
    }
  };

  // Handle setting origin or destination from context menu
  const handleMenuItemClick = async (action: "origin" | "destination") => {
    const { lngLat } = contextMenu;
    const address = await reverseGeocode(lngLat.lng, lngLat.lat);

    if (action === "origin") {
      setCurrentRoute((prev) => ({
        ...prev,
        origin: {
          coordinates: [lngLat.lng, lngLat.lat],
          address,
        } as Waypoint,
      }));
    } else if (action === "destination") {
      setCurrentRoute((prev) => ({
        ...prev,
        destination: {
          coordinates: [lngLat.lng, lngLat.lat],
          address,
        } as Waypoint,
      }));
    }

    setContextMenu({ ...contextMenu, visible: false });
  };

  // Reverse geocode to get address from coordinates
  // The address isthen updated in the left panel where the addresses match the origin and destination dynamically
  const reverseGeocode = async (lng: number, lat: number) => {
    const key = `${lng.toFixed(5)},${lat.toFixed(5)}`;
    if (reverseGeocodeCache.has(key)) {
      return reverseGeocodeCache.get(key);
    }

    const url = `${mapboxGeocodingApi}/${lng},${lat}.json?access_token=${mapboxgl.accessToken}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data?.features.length > 0) {
        const address = data.features[0].place_name;
        // Cached if the same address is hit back again.
        // This can be common since the user is likely to be working on the same area.
        reverseGeocodeCache.set(key, address);
        return address;
      } else {
        return "Unknown Location";
      }
    } catch (error) {
      console.error("Error reverse geocoding:", error);
      return "Unknown Location";
    }
  };

  // Fetch shortest path between the points when origin or destination changes
  useEffect(() => {
    const fetchRoute = async () => {
      if (currentRoute.origin && currentRoute.destination) {
        const coordinates = [
          currentRoute.origin.coordinates,
          ...(currentRoute.rerouteSnapPoint
            ? [currentRoute.rerouteSnapPoint]
            : []),
          currentRoute.destination.coordinates,
        ];

        const coordinatesString = coordinates
          .map((coord) => `${coord[0]},${coord[1]}`)
          .join(";");

        // Use the 'continue_straight' parameter to avoid U-turns - these look like double dips on the same route
        // TODO This doesn't completely get rid of turning back from different roads on the same route (opposite road). But prevents the other lane on the same road.
        const url = `${mapboxDirectionsApi}/${coordinatesString}?geometries=geojson&continue_straight=true&access_token=${mapboxgl.accessToken}`;

        try {
          const response = await fetch(url);
          const data = await response.json();

          if (data.routes && data.routes.length > 0) {
            const geometry = data.routes[0].geometry as LineString;

            setCurrentRoute((prev) => ({
              ...prev,
              geometry,
            }));
          }
        } catch (error) {
          console.error("Error fetching route:", error);
        }
      }
    };

    fetchRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // The suggestion of the warning here (disabled) doesn't work because there are other parameters in the origin and destination that changes dynamically.
    // Which results in flickering and flaky behaviour. So specifying ecah property in the dependencies.
    currentRoute.origin?.coordinates,
    currentRoute.destination?.coordinates,
    currentRoute.rerouteSnapPoint,
  ]);

  return (
    <div style={{ height: "100vh", display: "flex" }}>
      {/* Left side - address text boxes for the current route and saved route list*/}
      <div
        style={{
          width: "300px",
          padding: "10px",
          backgroundColor: "#f7f7f7",
          overflowY: "auto",
        }}
      >
        {/* Current route */}
        {currentRoute && (
          <div style={{ marginBottom: "20px" }}>
            <h3>Current Route</h3>
            {currentRoute.origin && (
              <div>
                <label>Origin:</label>
                <AddressEntry
                  value={currentRoute.origin.address}
                  onSelect={(address, coords) => {
                    setCurrentRoute((prev) => ({
                      ...prev,
                      origin: {
                        coordinates: coords,
                        address,
                      },
                    }));
                  }}
                />
              </div>
            )}
            {currentRoute.destination && (
              <div>
                <label>Destination:</label>
                <AddressEntry
                  value={currentRoute.destination.address}
                  onSelect={(address, coords) => {
                    setCurrentRoute((prev) => ({
                      ...prev,
                      destination: {
                        coordinates: coords,
                        address,
                      },
                    }));
                  }}
                />
              </div>
            )}
            <button
              onClick={() => {
                if (
                  currentRoute.origin &&
                  currentRoute.destination &&
                  currentRoute.geometry
                ) {
                  const newRouteId = routeCounter;
                  setRoutes([
                    ...routes,
                    {
                      id: newRouteId,
                      origin: currentRoute.origin,
                      destination: currentRoute.destination,
                      geometry: currentRoute.geometry,
                    },
                  ]);
                  setCurrentRoute({
                    id: newRouteId + 1,
                    origin: null,
                    destination: null,
                    rerouteSnapPoint: null,
                    geometry: null,
                  });
                  setRouteCounter(newRouteId + 1);
                }
              }}
              disabled={
                !(
                  currentRoute.origin &&
                  currentRoute.destination &&
                  currentRoute.geometry
                )
              }
            >
              Save Route
            </button>
          </div>
        )}

        {/* Saved Routes */}
        {routes.length > 0 && (
          <div>
            <h3>Saved Routes</h3>
            {routes.map((route) => (
              <div key={route.id}>
                <p>Route {route.id}</p>
                <p>From: {route.origin.address}</p>
                <p>To: {route.destination.address}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div style={{ flexGrow: 1, position: "relative" }}>
        <MapGL
          ref={mapRef}
          initialViewState={{
            longitude: 153.0251,
            latitude: -27.4698,
            zoom: 12,
          }}
          mapStyle="mapbox://styles/mapbox/streets-v11"
          onContextMenu={handleContextMenu}
          onClick={handleMapClick}
          style={{ width: "100%", height: "100%" }}
          mapboxAccessToken={mapboxgl.accessToken}
        >
          {/* Current origin */}
          {currentRoute.origin && (
            <Marker
              longitude={currentRoute.origin.coordinates[0]}
              latitude={currentRoute.origin.coordinates[1]}
            >
              <CustomMarker type={`S-${currentRoute.id}`} />
            </Marker>
          )}

          {/* Current destination */}
          {currentRoute.destination && (
            <Marker
              longitude={currentRoute.destination.coordinates[0]}
              latitude={currentRoute.destination.coordinates[1]}
            >
              <CustomMarker type={`E-${currentRoute.id}`} />
            </Marker>
          )}

          {/* Current Route Line */}
          {currentRoute.geometry && (
            <Source
              id={`route-${currentRoute.id}`}
              type="geojson"
              data={{
                type: "Feature",
                geometry: currentRoute.geometry,
              }}
            >
              <Layer
                id={`route-line-${currentRoute.id}`}
                type="line"
                paint={{
                  "line-color": "#3887be",
                  "line-width": 16,
                }}
                layout={{
                  "line-cap": "round",
                  "line-join": "round",
                }}
              />
            </Source>
          )}

          {/* Saved Routes */}
          {routes.map((route) => (
            <React.Fragment key={`route-${route.id}`}>
              {/* Route Line */}
              <Source
                id={`route-${route.id}`}
                type="geojson"
                data={{
                  type: "Feature",
                  geometry: route.geometry,
                }}
              >
                <Layer
                  id={`route-line-${route.id}`}
                  type="line"
                  paint={{
                    "line-color": "#888",
                    "line-width": 4,
                  }}
                  layout={{
                    "line-cap": "round",
                    "line-join": "round",
                  }}
                />
              </Source>

              {/* Origin Marker */}
              <Marker
                longitude={route.origin.coordinates[0]}
                latitude={route.origin.coordinates[1]}
              >
                <CustomMarker type={`S-${route.id}`} />
              </Marker>

              {/* Destination Marker */}
              <Marker
                longitude={route.destination.coordinates[0]}
                latitude={route.destination.coordinates[1]}
              >
                <CustomMarker type={`E-${route.id}`} />
              </Marker>
            </React.Fragment>
          ))}
        </MapGL>

        {/* Context menu */}
        {contextMenu.visible && (
          <div
            style={{
              position: "absolute",
              top: contextMenu.y,
              left: contextMenu.x,
              backgroundColor: "white",
              border: "1px solid #ccc",
              zIndex: 1000,
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            }}
          >
            <ul style={{ listStyleType: "none", margin: 0, padding: 0 }}>
              <li
                style={{ padding: "8px", cursor: "pointer" }}
                onClick={() => handleMenuItemClick("origin")}
              >
                Set As Origin
              </li>
              <li
                style={{ padding: "8px", cursor: "pointer" }}
                onClick={() => handleMenuItemClick("destination")}
              >
                Set As Destination
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
