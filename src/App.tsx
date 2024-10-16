import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import React, { useEffect, useRef, useState } from "react";
import Map, {
  Layer,
  MapMouseEvent,
  MapRef,
  Marker,
  MarkerDragEvent,
  Source,
} from "react-map-gl";
import AddressEntry from "./AddressEntry";
import { ContextMenuProps, CurrentRoute, Route } from "./interfaces";
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

  const [currentRoute, setCurrentRoute] = useState<CurrentRoute | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [, setLastSettedRoute] = useState<"origin" | "destination" | null>(
    null
  );
  const [routeCounter, setRouteCounter] = useState<number>(1);

  const mapRef = useRef<MapRef | null>(null);

  // right click
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

  // map click closes contextmenu
  const handleMapClick = () => {
    if (contextMenu.visible) {
      setContextMenu({ ...contextMenu, visible: false });
    }
  };

  // Reversing to get address from coordinates
  const reverseGeocode = async (lng: number, lat: number) => {
    const url = `${mapboxGeocodingApi}/${lng},${lat}.json?access_token=${mapboxgl.accessToken}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data?.features.length > 0) {
        return data.features[0].place_name;
      } else {
        return "Unknown Location";
      }
    } catch (error) {
      console.error("Error reverse geocoding:", error);
      return "Unknown Location";
    }
  };

  // Handle setting orig or dest from context menu
  const handleMenuItemClick = async (action: "origin" | "destination") => {
    const { lngLat } = contextMenu;
    const address = await reverseGeocode(lngLat.lng, lngLat.lat);

    if (action === "origin") {
      if (currentRoute) {
        // Update current origin
        setCurrentRoute((prev) => ({
          ...prev!,
          origin: {
            coordinates: [lngLat.lng, lngLat.lat],
            address,
          },
        }));
      } else {
        // new route
        setCurrentRoute({
          origin: {
            coordinates: [lngLat.lng, lngLat.lat],
            address,
          },
          destination: null,
          geometry: null,
        });
      }
      setLastSettedRoute("origin");
    } else if (action === "destination") {
      if (currentRoute && currentRoute.origin) {
        // Update current destination if origin exists
        setCurrentRoute((prev) => ({
          ...prev!,
          destination: {
            coordinates: [lngLat.lng, lngLat.lat],
            address,
          },
        }));
      } else if (routes.length > 0) {
        // Update the latest route's destination
        const updatedRoutes = [...routes];
        const latestRouteIndex = updatedRoutes.length - 1;
        updatedRoutes[latestRouteIndex].destination.coordinates = [
          lngLat.lng,
          lngLat.lat,
        ];
        updatedRoutes[latestRouteIndex].destination.address = address;

        // Recalculate the route
        const originCoords = updatedRoutes[latestRouteIndex].origin.coordinates;
        const destinationCoords =
          updatedRoutes[latestRouteIndex].destination.coordinates;

        fetchAndUpdateRoute(originCoords, destinationCoords, latestRouteIndex);
      }
      setLastSettedRoute("destination");
    }

    setContextMenu({ ...contextMenu, visible: false });
  };

  // Fetch route when origin or destination changes
  useEffect(() => {
    const fetchRoute = async () => {
      if (currentRoute && currentRoute.origin && currentRoute.destination) {
        const originCoords = currentRoute.origin.coordinates;
        const destinationCoords = currentRoute.destination.coordinates;

        const url = `${mapboxDirectionsApi}/${originCoords[0]},${originCoords[1]};${destinationCoords[0]},${destinationCoords[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`;

        try {
          const response = await fetch(url);
          const data = await response.json();

          if (data.routes && data.routes.length > 0) {
            const geometry = data.routes[0].geometry;

            setCurrentRoute((prev) => ({
              ...prev!,
              geometry,
            }));
          }
        } catch (error) {
          console.error("Error fetching route:", error);
        }
      }
    };

    fetchRoute();
  }, [
    currentRoute?.origin?.coordinates,
    currentRoute?.destination?.coordinates,
  ]);

  // Handle dragging
  const handleCurrentMarkerDragEnd = async (
    event: MarkerDragEvent,
    type: "origin" | "destination"
  ) => {
    const lngLat = [event.lngLat.lng, event.lngLat.lat] as [number, number];
    const address = await reverseGeocode(lngLat[0], lngLat[1]);
    if (currentRoute) {
      if (type === "origin") {
        setCurrentRoute((prev) => ({
          ...prev!,
          origin: {
            coordinates: lngLat,
            address,
          },
        }));
      } else if (type === "destination") {
        setCurrentRoute((prev) => ({
          ...prev!,
          destination: {
            coordinates: lngLat,
            address,
          },
        }));
      }
    }
  };

  // dragging of route markers
  const handleRouteMarkerDragEnd = async (
    event: MarkerDragEvent,
    index: number,
    type: "origin" | "destination"
  ) => {
    const lngLat = [event.lngLat.lng, event.lngLat.lat] as [number, number];
    const address = await reverseGeocode(lngLat[0], lngLat[1]);

    // Update the routes origin or destination
    const updatedRoutes = [...routes];
    if (type === "origin") {
      updatedRoutes[index].origin.coordinates = lngLat;
      updatedRoutes[index].origin.address = address;
    } else if (type === "destination") {
      updatedRoutes[index].destination.coordinates = lngLat;
      updatedRoutes[index].destination.address = address;
    }

    // Recalculate the route
    const originCoords = updatedRoutes[index].origin.coordinates;
    const destinationCoords = updatedRoutes[index].destination.coordinates;

    fetchAndUpdateRoute(originCoords, destinationCoords, index);
  };

  // Fetch and update route
  const fetchAndUpdateRoute = async (
    originCoords: [number, number],
    destinationCoords: [number, number],
    routeIndex: number
  ) => {
    const url = `${mapboxDirectionsApi}/${originCoords[0]},${originCoords[1]};${destinationCoords[0]},${destinationCoords[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const geometry = data.routes[0].geometry;

        setRoutes((prevRoutes) => {
          const updatedRoutes = [...prevRoutes];
          updatedRoutes[routeIndex].geometry = geometry;
          return updatedRoutes;
        });
      }
    } catch (error) {
      console.error("Error fetching updated route:", error);
    }
  };

  // Remove a saved route
  const removeRoute = (index: number) => {
    const updatedRoutes = [...routes];
    updatedRoutes.splice(index, 1);
    setRoutes(updatedRoutes);
  };

  return (
    <div style={{ height: "100vh", display: "flex" }}>
      {/* Left side */}
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
                      ...prev!,
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
                      ...prev!,
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
                  currentRoute &&
                  currentRoute.origin &&
                  currentRoute.destination &&
                  currentRoute.geometry
                ) {
                  setRoutes([
                    ...routes,
                    {
                      id: routeCounter,
                      origin: currentRoute.origin,
                      destination: currentRoute.destination,
                      geometry: currentRoute.geometry,
                    },
                  ]);
                  setCurrentRoute(null);
                  setLastSettedRoute(null);
                  setRouteCounter(routeCounter + 1);
                }
              }}
              disabled={
                !(
                  currentRoute &&
                  currentRoute.origin &&
                  currentRoute.destination &&
                  currentRoute.geometry
                )
              }
            >
              Save Location
            </button>
          </div>
        )}

        {/* Saved routes */}
        {routes.map((route, index) => (
          <div key={index} style={{ marginBottom: "20px" }}>
            <h3>Route {route.id}</h3>
            <div>
              <label>Origin:</label>
              <AddressEntry
                value={route.origin.address}
                onSelect={(address, coords) => {
                  const updatedRoutes = [...routes];
                  updatedRoutes[index].origin.coordinates = coords;
                  updatedRoutes[index].origin.address = address;
                  setRoutes(updatedRoutes);

                  const originCoords = coords;
                  const destinationCoords =
                    updatedRoutes[index].destination.coordinates;

                  fetchAndUpdateRoute(originCoords, destinationCoords, index);
                }}
              />
            </div>
            <div>
              <label>Destination:</label>
              <AddressEntry
                value={route.destination.address}
                onSelect={(address, coords) => {
                  const updatedRoutes = [...routes];
                  updatedRoutes[index].destination.coordinates = coords;
                  updatedRoutes[index].destination.address = address;
                  setRoutes(updatedRoutes);

                  const originCoords = updatedRoutes[index].origin.coordinates;
                  const destinationCoords = coords;

                  fetchAndUpdateRoute(originCoords, destinationCoords, index);
                }}
              />
            </div>
            <button onClick={() => removeRoute(index)}>Remove Location</button>
          </div>
        ))}
      </div>

      <div style={{ flexGrow: 1, position: "relative" }}>
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: 153.021072,
            latitude: -27.470125,
            zoom: 12,
          }}
          mapStyle="mapbox://styles/mapbox/streets-v11"
          onContextMenu={handleContextMenu}
          onClick={handleMapClick}
          style={{ width: "100%", height: "100%" }}
          mapboxAccessToken={mapboxgl.accessToken}
        >
          {/* Current origin */}
          {currentRoute && currentRoute.origin && (
            <Marker
              longitude={currentRoute.origin.coordinates[0]}
              latitude={currentRoute.origin.coordinates[1]}
              draggable
              onDragEnd={(e) => handleCurrentMarkerDragEnd(e, "origin")}
            >
              <CustomMarker type="origin" />
            </Marker>
          )}

          {/* Current dest */}
          {currentRoute && currentRoute.destination && (
            <Marker
              longitude={currentRoute.destination.coordinates[0]}
              latitude={currentRoute.destination.coordinates[1]}
              draggable
              onDragEnd={(e) => handleCurrentMarkerDragEnd(e, "destination")}
            >
              <CustomMarker type="destination" />
            </Marker>
          )}

          {/* Current Route Line */}
          {currentRoute && currentRoute.geometry && (
            <Source
              id="current-route"
              type="geojson"
              data={{
                type: "Feature",
                geometry: currentRoute.geometry,
              }}
            >
              <Layer
                id="current-route-line"
                type="line"
                paint={{
                  "line-color": "#3887be",
                  "line-width": 6,
                }}
              />
            </Source>
          )}

          {/* Show saved routes */}
          {routes.map((route, index) => (
            <React.Fragment key={index}>
              <Source
                id={`route-${index}`}
                type="geojson"
                data={{
                  type: "Feature",
                  geometry: route.geometry,
                }}
              >
                <Layer
                  id={`route-line-${index}`}
                  type="line"
                  paint={{
                    "line-color": "#3887be",
                    "line-width": 6,
                  }}
                />
              </Source>

              {/* Origin - destination */}
              <Marker
                longitude={route.origin.coordinates[0]}
                latitude={route.origin.coordinates[1]}
                draggable
                onDragEnd={(e) => handleRouteMarkerDragEnd(e, index, "origin")}
              >
                <CustomMarker type="origin" id={route.id} />
              </Marker>

              <Marker
                longitude={route.destination.coordinates[0]}
                latitude={route.destination.coordinates[1]}
                draggable
                onDragEnd={(e) =>
                  handleRouteMarkerDragEnd(e, index, "destination")
                }
              >
                <CustomMarker type="destination" id={route.id} />
              </Marker>
            </React.Fragment>
          ))}
        </Map>

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
