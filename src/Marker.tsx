import React from "react";

interface CustomMarkerProps {
  type: "origin" | "destination";
}

const CustomMarker: React.FC<CustomMarkerProps> = ({ type }) => {
  let color = "blue";
  if (type === "origin") color = "green";
  else if (type === "destination") color = "red";

  return (
    <div
      style={{
        backgroundColor: color,
        borderRadius: "50%",
        width: "20px",
        height: "20px",
        border: "2px solid white",
      }}
    ></div>
  );
};

export default CustomMarker;
