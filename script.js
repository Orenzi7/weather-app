const API_KEY = "695061045a0f47a3bca163031252307";
const BASE_URL = "https://api.weatherapi.com/v1/forecast.json";
const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const loader = document.getElementById("loading");

document.addEventListener("DOMContentLoaded", () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        fetchWeather(`${latitude},${longitude}`);
      },
      () => fetchWeather("Lagos") // fallback
    );
  } else {
    fetchWeather("Lagos");
  }

  updateTime();
  setInterval(updateTime, 1000);
});

form.addEventListener("submit", e => {
  e.preventDefault();
  const city = input.value.trim();
  if (city) {
    fetchWeather(city);
    input.value = "";
  }
});

function updateTime() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day = now.toLocaleDateString(undefined, { weekday: 'long' });
  document.getElementById("time").textContent = time;
  document.getElementById("day").textContent = day;
}

function showLoader(show = true) {
  loader.classList.toggle("hidden", !show);
}

function fetchWeather(city) {
  showLoader(true);
  fetch(`${BASE_URL}?key=${API_KEY}&q=${city}&days=5&aqi=no&alerts=no`)
    .then(res => {
      if (!res.ok) throw new Error("City not found");
      return res.json();
    })
    .then(data => {
      updateWeather(data);
      showLoader(false);
    })
    .catch(err => {
      alert(err.message);
      showLoader(false);
    });
}

function updateWeather(data) {
  const current = data.current;
  const location = data.location;
  const forecast = data.forecast.forecastday;

  // Current Weather
  document.getElementById("temperature").textContent = `${current.temp_c}°C`;
  document.getElementById("condition").textContent = current.condition.text;
  document.getElementById("location").textContent = `${location.name}, ${location.country}`;
  document.getElementById("weather-icon").className = `wi ${getWeatherIcon(current.condition.code, current.is_day)} text-6xl`;

  // Forecast Days
  for (let i = 1; i <= 4; i++) {
    const dayData = forecast[i];
    if (!dayData) continue;

    document.getElementById(`forecast-day${i}`).textContent = new Date(dayData.date).toLocaleDateString(undefined, { weekday: 'short' });
    document.getElementById(`forecast-temp${i}`).textContent = `${dayData.day.avgtemp_c}°C`;
    document.getElementById(`forecast-condition${i}`).textContent = dayData.day.condition.text;
  }

  // Wind Compass Update 🌬️
  updateWindCompass(current.wind_degree, current.wind_kph);

  // Remove shimmer effect
  document.querySelectorAll(".shimmer").forEach(el => el.classList.remove("shimmer"));
}

function updateWindCompass(degree, speed) {
  const arrow = document.getElementById("wind-arrow");
  const speedText = document.getElementById("wind-speed");
  if (arrow && speedText) {
    arrow.style.transform = `rotate(${degree}deg)`;
    speedText.textContent = `${speed} km/h`;
  }
}

// Weather condition → WeatherIcons
function getWeatherIcon(code, isDay) {
  const map = {
    1000: isDay ? "wi-day-sunny" : "wi-night-clear",
    1003: isDay ? "wi-day-cloudy" : "wi-night-alt-cloudy",
    1006: "wi-cloudy",
    1009: "wi-cloudy-windy",
    1030: "wi-fog",
    1063: "wi-showers",
    1066: "wi-snow",
    1069: "wi-sleet",
    1072: "wi-sleet",
    1087: "wi-thunderstorm",
    1114: "wi-snow-wind",
    1117: "wi-snow-wind",
    1135: "wi-fog",
    1147: "wi-fog",
    1150: "wi-sprinkle",
    1153: "wi-sprinkle",
    1168: "wi-rain-mix",
    1171: "wi-rain-mix",
    1180: "wi-showers",
    1183: "wi-showers",
    1186: "wi-rain",
    1189: "wi-rain",
    1192: "wi-rain",
    1195: "wi-rain",
    1198: "wi-hail",
    1201: "wi-hail",
    1204: "wi-sleet",
    1207: "wi-sleet",
    1210: "wi-snow",
    1213: "wi-snow",
    1216: "wi-snow",
    1219: "wi-snow",
    1222: "wi-snow",
    1225: "wi-snow",
    1237: "wi-hail",
    1240: "wi-showers",
    1243: "wi-rain",
    1246: "wi-rain",
    1249: "wi-sleet",
    1252: "wi-sleet",
    1255: "wi-snow",
    1258: "wi-snow",
    1261: "wi-hail",
    1264: "wi-hail",
    1273: "wi-storm-showers",
    1276: "wi-thunderstorm",
    1279: "wi-snow-thunderstorm",
    1282: "wi-snow-thunderstorm"
  };

  return map[code] || "wi-na";
}
