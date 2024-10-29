import React from "react";

interface CustomMarkerProps {
  type: string;
}

const CustomMarker: React.FC<CustomMarkerProps> = ({ type }) => {
  let color = "blue";
  if (type.startsWith("S")) color = "green";
  else if (type.startsWith("E")) color = "maroon";

  return (
    <div
      style={{
        backgroundColor: color,
        borderRadius: "50%",
        width: "24px",
        height: "24px",
        border: "2px solid white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: "bold",
      }}
    >
      {type}
    </div>
  );
};

export default CustomMarker;
