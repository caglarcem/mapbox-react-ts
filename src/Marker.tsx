import React from "react";

interface MarkerProps {
  type: "origin" | "destination";
  id?: number;
}

const Marker: React.FC<MarkerProps> = ({ type, id }) => {
  const letter = type === "origin" ? "S" : "D";
  const color = "#B30000";
  const label = id ? `${letter}${id}` : letter;

  return (
    <div
      style={{
        position: "relative",
        width: "30px",
        height: "45px",
        backgroundColor: "transparent",
        cursor: "pointer",
      }}
    >
      <svg viewBox="0 0 30 45" style={{ width: "100%", height: "100%" }}>
        <path
          d="M15 0C8.92487 0 4 4.92487 4 11C4 19.25 15 29 15 29C15 29 26 19.25 26 11C26 4.92487 21.0751 0 15 0Z"
          fill={color}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: "5px",
          left: "0",
          width: "100%",
          textAlign: "center",
          color: "white",
          fontWeight: "bold",
          fontSize: "12px",
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default Marker;
