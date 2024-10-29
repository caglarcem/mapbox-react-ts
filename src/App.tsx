import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import React, { useEffect, useRef, useState } from "react";
import Map, {
  Layer,
  MapLayerMouseEvent,
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

  const [currentRoute, setCurrentRoute] = useState<CurrentRoute>({
    origin: null,
    destination: null,
    rerouteSnapPoint: null,
    geometry: null,
    id: 0,
  });

  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeCounter, setRouteCounter] = useState<number>(1);

  const mapRef = useRef<MapRef | null>(null);

  // Right-click context menu
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

  // Map click
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
        },
      }));
    } else if (action === "destination") {
      setCurrentRoute((prev) => ({
        ...prev,
        destination: {
          coordinates: [lngLat.lng, lngLat.lat],
          address,
        },
      }));
    }

    setContextMenu({ ...contextMenu, visible: false });
  };

  // Reverse geocode to get address from coordinates
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

  // Fetch route when origin, destination, or rerouteSnapPoint changes
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

        // Use the 'continue_straight' parameter to avoid U-turns
        const url = `${mapboxDirectionsApi}/${coordinatesString}?geometries=geojson&continue_straight=true&access_token=${mapboxgl.accessToken}`;

        try {
          const response = await fetch(url);
          const data = await response.json();

          if (data.routes && data.routes.length > 0) {
            const geometry = data.routes[0].geometry;

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
  }, [
    currentRoute.origin?.coordinates,
    currentRoute.destination?.coordinates,
    currentRoute.rerouteSnapPoint,
  ]);

  // Handle dragging the route line
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: MapLayerMouseEvent) => {
    if (
      e.features &&
      e.features.length > 0 &&
      e.features[0].layer?.id === `route-line-${currentRoute.id}`
    ) {
      e.preventDefault();
      setIsDragging(true);
      if (mapRef.current) {
        mapRef.current.getCanvas().style.cursor = "grabbing";
      }
    }
  };

  const handleMouseMove = (e: MapLayerMouseEvent) => {
    if (!isDragging) return;

    e.preventDefault();
    const lngLat = [e.lngLat.lng, e.lngLat.lat] as [number, number];

    if (currentRoute.geometry) {
      // Snap the point to the road network
      snapPointToRoad(lngLat).then((snappedPoint) => {
        setCurrentRoute((prev) => ({
          ...prev,
          rerouteSnapPoint: snappedPoint,
        }));
      });
    }
  };

  const handleMouseUp = (e: MapLayerMouseEvent) => {
    if (!isDragging) return;

    e.preventDefault();
    setIsDragging(false);
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = "";
    }

    const lngLat = [e.lngLat.lng, e.lngLat.lat] as [number, number];

    if (currentRoute.geometry) {
      // Snap the point to the road network
      snapPointToRoad(lngLat).then((snappedPoint) => {
        setCurrentRoute((prev) => ({
          ...prev,
          rerouteSnapPoint: snappedPoint,
        }));
      });
    }
  };

  // Snap point to road network using Map Matching API
  const snapPointToRoad = async (
    point: [number, number]
  ): Promise<[number, number]> => {
    const url = `https://api.mapbox.com/matching/v5/mapbox/walking/${point[0]},${point[1]}?access_token=${mapboxgl.accessToken}&geometries=geojson`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.matchings && data.matchings.length > 0) {
        const snappedPoint = data.matchings[0].geometry.coordinates[0];
        return snappedPoint as [number, number];
      }
    } catch (error) {
      console.error("Error snapping point to road:", error);
    }

    // If snapping fails, return the original point
    return point;
  };

  // Handle cursor style
  const handleMouseEnter = (e: MapLayerMouseEvent) => {
    if (
      e.features &&
      e.features.length > 0 &&
      e.features[0].layer?.id === `route-line-${currentRoute.id}`
    ) {
      if (mapRef.current) {
        mapRef.current.getCanvas().style.cursor = "grab";
      }
    }
  };

  const handleMouseLeave = (e: MapLayerMouseEvent) => {
    if (
      e.features &&
      e.features.length > 0 &&
      e.features[0].layer?.id === `route-line-${currentRoute.id}`
    ) {
      if (!isDragging && mapRef.current) {
        mapRef.current.getCanvas().style.cursor = "";
      }
    }
  };

  // Handle dragging origin or destination
  const handleCurrentMarkerDragEnd = async (
    event: MarkerDragEvent,
    type: "origin" | "destination"
  ) => {
    const lngLat = [event.lngLat.lng, event.lngLat.lat] as [number, number];
    const address = await reverseGeocode(lngLat[0], lngLat[1]);
    if (type === "origin") {
      setCurrentRoute((prev) => ({
        ...prev,
        origin: {
          coordinates: lngLat,
          address,
        },
      }));
    } else if (type === "destination") {
      setCurrentRoute((prev) => ({
        ...prev,
        destination: {
          coordinates: lngLat,
          address,
        },
      }));
    }
  };

  // Handle dragging saved route markers
  const handleSavedMarkerDragEnd = async (
    event: MarkerDragEvent,
    type: "origin" | "destination",
    routeId: number
  ) => {
    const lngLat = [event.lngLat.lng, event.lngLat.lat] as [number, number];
    const address = await reverseGeocode(lngLat[0], lngLat[1]);

    // Update the specific route in the routes array
    setRoutes((prevRoutes) =>
      prevRoutes.map((route) => {
        if (route.id === routeId) {
          const updatedRoute = { ...route };
          if (type === "origin") {
            updatedRoute.origin = {
              coordinates: lngLat,
              address,
            };
          } else if (type === "destination") {
            updatedRoute.destination = {
              coordinates: lngLat,
              address,
            };
          }
          return updatedRoute;
        }
        return route;
      })
    );
  };

  // Fetch route when saved route markers are dragged
  useEffect(() => {
    const updateSavedRoutes = async () => {
      for (const route of routes) {
        const coordinates = [
          route.origin.coordinates,
          route.destination.coordinates,
        ];

        const coordinatesString = coordinates
          .map((coord) => `${coord[0]},${coord[1]}`)
          .join(";");

        const url = `${mapboxDirectionsApi}/${coordinatesString}?geometries=geojson&access_token=${mapboxgl.accessToken}`;

        try {
          const response = await fetch(url);
          const data = await response.json();

          if (data.routes && data.routes.length > 0) {
            const geometry = data.routes[0].geometry;

            // Update the route geometry
            setRoutes((prevRoutes) =>
              prevRoutes.map((r) =>
                r.id === route.id ? { ...r, geometry } : r
              )
            );
          }
        } catch (error) {
          console.error("Error updating saved route:", error);
        }
      }
    };

    updateSavedRoutes();
  }, [routes]);

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
        <Map
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
          interactiveLayerIds={[`route-line-${currentRoute.id}`]}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseDown={handleMouseDown}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Current origin */}
          {currentRoute.origin && (
            <Marker
              longitude={currentRoute.origin.coordinates[0]}
              latitude={currentRoute.origin.coordinates[1]}
              draggable
              onDragEnd={(e) => handleCurrentMarkerDragEnd(e, "origin")}
            >
              <CustomMarker type={`O-${currentRoute.id}`} />
            </Marker>
          )}

          {/* Current destination */}
          {currentRoute.destination && (
            <Marker
              longitude={currentRoute.destination.coordinates[0]}
              latitude={currentRoute.destination.coordinates[1]}
              draggable
              onDragEnd={(e) => handleCurrentMarkerDragEnd(e, "destination")}
            >
              <CustomMarker type={`D-${currentRoute.id}`} />
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
                  "line-width": 6,
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
                draggable
                onDragEnd={(e) =>
                  handleSavedMarkerDragEnd(e, "origin", route.id)
                }
              >
                <CustomMarker type={`O-${route.id}`} />
              </Marker>

              {/* Destination Marker */}
              <Marker
                longitude={route.destination.coordinates[0]}
                latitude={route.destination.coordinates[1]}
                draggable
                onDragEnd={(e) =>
                  handleSavedMarkerDragEnd(e, "destination", route.id)
                }
              >
                <CustomMarker type={`D-${route.id}`} />
              </Marker>
            </React.Fragment>
          ))}
        </Map>

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
