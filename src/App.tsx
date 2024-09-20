import axios from "axios";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Map, {
  Layer,
  MapLayerMouseEvent,
  MapRef,
  Marker,
  MarkerDragEvent,
  Source,
} from "react-map-gl";

mapboxgl.accessToken = "my_access_token"; // This can be found in COV project

interface Route {
  geometry: {
    coordinates: number[][];
    type: string;
  };
  distance: number;
  duration: number;
}

const App: React.FC = () => {
  const mapRef = useRef<MapRef | null>(null);
  const [points, setPoints] = useState<number[][]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);

  // fetch additional routes
  const generateViaPoints = (
    start: number[],
    end: number[],
    count: number
  ): number[][] => {
    const viaPoints: number[][] = [];
    const offset = 0.005;

    for (let i = 0; i < count; i++) {
      const randomAngle = Math.random() * 2 * Math.PI;
      const deltaLng = offset * Math.cos(randomAngle) * (i + 1);
      const deltaLat = offset * Math.sin(randomAngle) * (i + 1);

      const via = [
        (start[0] + end[0]) / 2 + deltaLng,
        (start[1] + end[1]) / 2 + deltaLat,
      ];

      viaPoints.push(via);
    }

    return viaPoints;
  };

  const fetchRoute = async (
    start: number[],
    end: number[],
    via?: number[]
  ): Promise<Route | null> => {
    try {
      let coordinates = [start, end];
      if (via) {
        coordinates = [start, via, end];
      }
      const coordinateString = coordinates
        .map((coord) => `${coord[0]},${coord[1]}`)
        .join(";");

      const response = await axios.get(
        `https://api.mapbox.com/directions/v5/mapbox/cycling/${coordinateString}`,
        {
          params: {
            access_token: mapboxgl.accessToken,
            overview: "full",
            geometries: "geojson",
            alternatives: false,
            steps: false,
          },
        }
      );

      const newRoute: Route = response.data.routes[0];

      return newRoute;
    } catch (error) {
      console.error("Error fetching route with via point:", error);
      return null;
    }
  };

  // Get routes (main + alternatives)
  const getRoutes = async (start: number[], end: number[]) => {
    try {
      const mainResponse = await axios.get(
        `https://api.mapbox.com/directions/v5/mapbox/cycling/${start[0]},${start[1]};${end[0]},${end[1]}`,
        {
          params: {
            access_token: mapboxgl.accessToken,
            overview: "full",
            geometries: "geojson",
            alternatives: true,
            steps: false,
          },
        }
      );

      let data: Route[] = mainResponse.data.routes;

      // make sure main route is shortest
      data.sort((a: Route, b: Route) => a.distance - b.distance);

      console.log("Fetched Routes from Alternatives:", data);

      const maxRouteCount = 2; // 1 main + 2 alternatives
      if (data.length < maxRouteCount) {
        const additionalRoutesNeeded = maxRouteCount - data.length;
        const viaPoints = generateViaPoints(start, end, additionalRoutesNeeded);

        for (const via of viaPoints) {
          const additionalRoute = await fetchRoute(start, end, via);
          if (additionalRoute) {
            // uniqueness checking the route
            const isUnique = data.every(
              (route) =>
                route.geometry.coordinates.toString() !==
                additionalRoute.geometry.coordinates.toString()
            );
            if (isUnique) {
              data.push(additionalRoute);
              console.log("Added Additional Route:", additionalRoute);
              if (data.length >= maxRouteCount) break;
            }
          }
        }
      }

      // limit to max count
      data = data.slice(0, maxRouteCount);

      console.log("Final Routes:", data);

      setRoutes(data); // Set all
      setSelectedRouteIndex(0); // Default to the first
    } catch (error) {
      console.error("Error fetching routes:", error);
      alert("Unable to fetch routes. Please try again.");
    }
  };

  // Delet closest point if already two points
  const replaceClosestPoint = (newPoint: number[]) => {
    if (points.length < 2) {
      setPoints([...points, newPoint]);
    } else {
      const distances = points.map((p) =>
        Math.hypot(p[0] - newPoint[0], p[1] - newPoint[1])
      );
      const closestIndex = distances.indexOf(Math.min(...distances));
      const updatedPoints = [...points];
      updatedPoints[closestIndex] = newPoint;
      setPoints(updatedPoints);
    }
  };

  const handleMapClick = (e: MapLayerMouseEvent) => {
    // Check if clicked on a route
    if (e.features && e.features.length > 0) {
      const clickedFeature = e.features[0];
      const routeIndex = clickedFeature?.properties?.routeIndex;
      if (routeIndex !== undefined && routeIndex !== selectedRouteIndex) {
        setSelectedRouteIndex(routeIndex);
        return;
      }
    }
    // adding points otherwise
    const coords: number[] = [e.lngLat.lng, e.lngLat.lat];
    replaceClosestPoint(coords);
  };

  const handleMarkerDragEnd = (event: MarkerDragEvent, index: number) => {
    const newPoints = [...points];
    newPoints[index] = [event.lngLat.lng, event.lngLat.lat];
    setPoints(newPoints);
  };

  // // Route dragging
  // const handleMouseDown = useCallback((e: MapLayerMouseEvent) => {
  //   if (e.features && e.features.length > 0) {
  //     // Check if the clicked is part of the route layer
  //     const layerId = e.features[0]?.layer?.id;
  //     if (layerId === "route-layer") {
  //       e.preventDefault();
  //       setIsDraggingRoute(true);
  //       const map = mapRef.current?.getMap();
  //       if (map) {
  //         map.getCanvas().style.cursor = "grabbing";
  //         map.dragPan.disable(); // Disable map panning
  //       }
  //     }
  //   }
  // }, []);

  // const handleMouseMove = useCallback(
  //   (e: MapLayerMouseEvent) => {
  //     if (isDraggingRoute) {
  //       const coords = [e.lngLat.lng, e.lngLat.lat];
  //       setViaPoint(coords);
  //     }
  //   },
  //   [isDraggingRoute]
  // );

  // const handleMouseUp = useCallback(
  //   (e: MapLayerMouseEvent) => {
  //     if (isDraggingRoute) {
  //       setIsDraggingRoute(false);
  //       const map = mapRef.current?.getMap();
  //       if (map) {
  //         map.getCanvas().style.cursor = "";
  //         map.dragPan.enable(); // Re-enable map panning
  //       }
  //     }
  //   },
  //   [isDraggingRoute]
  // );

  // Update the routes on change points
  useEffect(() => {
    if (points.length === 2) {
      getRoutes(points[0], points[1]);
    }
  }, [points]);

  // get layer IDs
  const alternativeRouteLayerIds = routes
    .map((_, index) =>
      index !== selectedRouteIndex ? `alternative-route-layer-${index}` : null
    )
    .filter((id): id is string => id !== null);

  const interactiveLayerIds = ["route-layer", ...alternativeRouteLayerIds];

  return (
    <div style={{ height: "100vh" }}>
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 153.021072,
          latitude: -27.470125,
          zoom: 12,
        }}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        style={{ width: "100%", height: "100%" }}
        onClick={handleMapClick}
        // onMouseDown={handleMouseDown}
        // onMouseMove={handleMouseMove}
        // onMouseUp={handleMouseUp}
        mapboxAccessToken={mapboxgl.accessToken}
        interactiveLayerIds={interactiveLayerIds}
        // cursor={isDraggingRoute ? "grabbing" : ""}
        cursor={""}
      >
        {/* Markers for points */}
        {points.map((point, index) => (
          <Marker
            key={index}
            longitude={point[0]}
            latitude={point[1]}
            draggable={true}
            onDragEnd={(e) => handleMarkerDragEnd(e, index)}
          >
            <div
              style={{
                backgroundColor: "red",
                borderRadius: "50%",
                width: "16px",
                height: "16px",
                cursor: "pointer",
                border: "2px solid white",
              }}
              aria-label={`Point ${index + 1}`}
              role="button"
            />
          </Marker>
        ))}

        {/* Alternative route layers */}
        {routes.length > 1 &&
          routes.map((routeData, index) => {
            // Skip selected
            if (index === selectedRouteIndex) return null;

            return (
              <Source
                key={`alternative-route-${index}`}
                id={`alternative-route-source-${index}`}
                type="geojson"
                data={{
                  type: "Feature",
                  properties: {
                    routeIndex: index,
                  },
                  geometry: routeData.geometry,
                }}
              >
                <Layer
                  id={`alternative-route-layer-${index}`}
                  type="line"
                  paint={{
                    "line-color": "#FF7F50",
                    "line-width": 6,
                    "line-opacity": 0.8,
                  }}
                />
              </Source>
            );
          })}

        {/* Main route layer */}
        {routes.length > 0 && (
          <Source
            id="route-source"
            type="geojson"
            data={{
              type: "Feature",
              properties: {
                routeIndex: selectedRouteIndex,
              },
              geometry: routes[selectedRouteIndex].geometry,
            }}
          >
            <Layer
              id="route-layer"
              type="line"
              paint={{
                "line-color": "#3887be",
                "line-width": 8,
                "line-opacity": 0.9,
              }}
            />
          </Source>
        )}
      </Map>
    </div>
  );
};

export default App;

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<App />);
