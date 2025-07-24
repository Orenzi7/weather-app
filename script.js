const API_KEY = "695061045a0f47a3bca163031252307";
const BASE_URL = "https://api.weatherapi.com/v1/forecast.json";
const weatherApp = document.getElementById("weatherApp");

// 🌆 Background themes
const backgrounds = {
  sunny: {
    image: 'url("https://images.unsplash.com/photo-1504253163759-c23fccaebb51?auto=format&fit=crop&w=1200&q=80")',
    textColor: "#000000",
  },
  clear: {
    image: 'url("https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?auto=format&fit=crop&w=1200&q=80")',
    textColor: "#000000",
  },
  cloudy: {
    image: 'url("https://images.unsplash.com/photo-1503437313881-503a91226419?auto=format&fit=crop&w=1200&q=80")',
    textColor: "#ffffff",
  },
  "partly cloudy": {
    image: 'url("https://images.unsplash.com/photo-1601132359864-d2c4cfb4c42c?auto=format&fit=crop&w=1200&q=80")',
    textColor: "#ffffff",
  },
  rainy: {
    image: 'url("https://images.unsplash.com/photo-1527766833261-b09c3163a791?auto=format&fit=crop&w=1200&q=80")',
    textColor: "#ffffff",
  },
  snow: {
    image: 'url("https://images.unsplash.com/photo-1483181957632-8bda9740b6f8?auto=format&fit=crop&w=1200&q=80")',
    textColor: "#000000",
  },
};

// 🌐 Weather icon mapping (Weather Icons CDN)
const iconMap = {
  sunny: "wi-day-sunny",
  clear: "wi-night-clear",
  cloudy: "wi-cloudy",
  "partly cloudy": "wi-day-cloudy",
  rainy: "wi-rain",
  snow: "wi-snow",
};

// 🌀 Show/Hide loader
function showLoader() {
  document.getElementById("loading").classList.remove("hidden");
}
function hideLoader() {
  document.getElementById("loading").classList.add("hidden");
}

// ⏱ Live clock updater
function updateTime() {
  const now = new Date();
  document.getElementById("day").innerText = now.toLocaleDateString("en-US", {
    weekday: "long",
  });
  document.getElementById("time").innerText = now.toLocaleTimeString();
}
updateTime();
setInterval(updateTime, 1000);

// 🔊 Sound based on weather
function playWeatherSound(condition) {
  const audio = new Audio();
  if (condition.includes("rain")) {
    audio.src = "sounds/rain.mp3";
  } else if (condition.includes("thunder")) {
    audio.src = "sounds/thunder.mp3";
  } else if (condition.includes("snow")) {
    audio.src = "sounds/snow.mp3";
  } else {
    return;
  }
  audio.loop = true;
  audio.volume = 0.5;
  audio.play();
}

// 🔄 Icon switcher
function updateWeatherIcon(condition) {
  const icon = document.getElementById("weather-icon");
  icon.className = "wi text-white text-6xl";
  for (const key in iconMap) {
    if (condition.includes(key)) {
      icon.classList.add(iconMap[key]);
      break;
    }
  }
}

// 🌤 Fetch weather
async function fetchWeather(location) {
  showLoader();
  try {
    const res = await fetch(`${BASE_URL}?key=${API_KEY}&q=${location}&days=4`);
    const data = await res.json();

    if (data && data.current) {
      updateUI(data);
    } else {
      alert("Weather data not found. Try another location.");
    }
  } catch (err) {
    console.error("Fetch error:", err);
    alert("Failed to fetch weather. Check your internet or city name.");
  } finally {
    hideLoader();
  }
}

// 🧠 Update UI
function updateUI(data) {
  const condition = data.current.condition.text.toLowerCase();

  document.getElementById("temperature").textContent = `${data.current.temp_c}°C`;
  document.getElementById("condition").innerText = data.current.condition.text;
  document.getElementById("location").textContent = `${data.location.name}, ${data.location.region}`;

  updateBackground(condition);
  updateWeatherIcon(condition);
  playWeatherSound(condition);

  const forecast = data.forecast.forecastday;
  for (let i = 1; i <= 4; i++) {
    const day = forecast[i - 1];
    document.getElementById(`forecast-temp${i}`).textContent = `${day.day.avgtemp_c}°C`;
    document.getElementById(`forecast-condition${i}`).textContent = day.day.condition.text;

    const date = new Date(day.date);
    document.getElementById(`forecast-day${i}`).textContent = date.toLocaleDateString("en-US", {
      weekday: "long",
    });
  }
}

// 🎨 Background theme switcher
function updateBackground(condition) {
  weatherApp.style.backgroundImage = "";
  weatherApp.style.backgroundColor = "#0f0c29";
  weatherApp.style.color = "#ffffff";

  for (const key in backgrounds) {
    if (condition.includes(key)) {
      const bg = backgrounds[key];
      weatherApp.style.backgroundImage = bg.image;
      weatherApp.style.backgroundSize = "cover";
      weatherApp.style.backgroundPosition = "center";
      weatherApp.style.backgroundRepeat = "no-repeat";
      weatherApp.style.color = bg.textColor || "#ffffff";
      break;
    }
  }
}

// 🔍 Search handler
const searchForm = document.getElementById("search-form");
if (searchForm) {
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("search-input");
    const location = input.value.trim();
    if (location) {
      fetchWeather(location);
      input.value = "";
    }
  });
}

// 🚀 Load default
fetchWeather("Lagos");

// ✨ AOS Init
AOS.init({
  duration: 1000,
  easing: "ease-out",
  once: true,
});
