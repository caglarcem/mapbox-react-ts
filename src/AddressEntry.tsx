import mapboxgl from "mapbox-gl";
import React, { useEffect, useState } from "react";

const mapboxGeocodingApi = "https://api.mapbox.com/geocoding/v5/mapbox.places";

interface AddressInputProps {
  value: string;
  onSelect: (address: string, coords: [number, number]) => void;
  placeholder?: string;
}

const AddressEntry: React.FC<AddressInputProps> = ({
  value,
  onSelect,
  placeholder,
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<
    Array<{ place_name: string; center: [number, number] }>
  >([]);
  const [timerId, setTimerId] = useState<number | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    if (timerId) {
      clearTimeout(timerId);
    }

    setTimerId(
      window.setTimeout(async () => {
        if (newValue.length > 2) {
          const url = `${mapboxGeocodingApi}/${encodeURIComponent(
            newValue
          )}.json?access_token=${
            mapboxgl.accessToken
          }&autocomplete=true&limit=5`;
          const response = await fetch(url);
          const data = await response.json();
          if (data.features) {
            setSuggestions(data.features);
          } else {
            setSuggestions([]);
          }
        } else {
          setSuggestions([]);
        }
      }, 300)
    );
  };

  const handleSelect = (place_name: string, center: [number, number]) => {
    setInputValue(place_name);
    setSuggestions([]);
    onSelect(place_name, center);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && suggestions.length > 0) {
      e.preventDefault();
      const firstSuggestion = suggestions[0];
      handleSelect(firstSuggestion.place_name, firstSuggestion.center);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={inputValue}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        style={{ width: "100%", marginBottom: "10px" }}
      />
      {suggestions.length > 0 && (
        <ul
          style={{
            listStyleType: "none",
            padding: 0,
            margin: 0,
            position: "absolute",
            backgroundColor: "white",
            border: "1px solid #ccc",
            width: "100%",
            maxHeight: "150px",
            overflowY: "auto",
            zIndex: 1000,
          }}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              onClick={() =>
                handleSelect(suggestion.place_name, suggestion.center)
              }
              style={{
                padding: "8px",
                cursor: "pointer",
              }}
            >
              {suggestion.place_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AddressEntry;
