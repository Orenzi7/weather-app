// WARNING: API key should be moved to backend for security
const API_KEY = "695061045a0f47a3bca163031252307";
const BASE_URL = "https://api.weatherapi.com/v1/forecast.json";
const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const loader = document.getElementById("loading");

// Cache configuration
const CACHE_KEY = 'weather_cache';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Cache DOM elements
const elements = {
  temperature: document.getElementById("temperature"),
  condition: document.getElementById("condition"),
  location: document.getElementById("location"),
  weatherIcon: document.getElementById("weather-icon"),
  time: document.getElementById("time"),
  day: document.getElementById("day"),
  windArrow: document.getElementById("wind-arrow"),
  windSpeed: document.getElementById("wind-speed"),
  humidity: document.getElementById("humidity"),
  feelsLike: document.getElementById("feels-like"),
  uvIndex: document.getElementById("uv-index"),
  visibility: document.getElementById("visibility"),
  aqi: document.getElementById("aqi"),
  weatherAlerts: document.getElementById("weather-alerts"),
  unitToggle: document.getElementById("unit-toggle")
};

// State management
const state = {
  currentLocation: null,
  lastSearched: null,
  units: localStorage.getItem('weatherUnits') || 'metric', // 'metric' or 'imperial'
  isOffline: false
};

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
});

async function initializeApp() {
  // Check online status
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Start time updates
  updateTime();
  setInterval(updateTime, 1000);
  
  // Show skeleton loaders
  showSkeletonLoaders();
  
  // Get user location
  try {
    const position = await getCurrentPosition();
    const { latitude, longitude } = position.coords;
    state.currentLocation = { lat: latitude, lon: longitude };
    await fetchWeatherWithRetry(`${latitude},${longitude}`);
  } catch (error) {
    console.warn("Geolocation failed:", error);
    // Try to load from cache first
    const cachedData = getCachedWeather("Lagos");
    if (cachedData) {
      updateWeather(cachedData);
      showNotification("Showing cached data", "info");
    } else {
      await fetchWeatherWithRetry("Lagos");
    }
  }
  
  // Set up event listeners
  setupEventListeners();
  
  // Check for saved location
  const savedLocation = localStorage.getItem('lastLocation');
  if (savedLocation && !state.currentLocation) {
    fetchWeatherWithRetry(savedLocation);
  }
}

function setupEventListeners() {
  // Form submission
  form.addEventListener("submit", handleSearch);
  
  // Unit toggle
  if (elements.unitToggle) {
    elements.unitToggle.addEventListener("click", toggleUnits);
  }
  
  // Input autocomplete (debounced)
  let debounceTimer;
  input.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (e.target.value.length > 2) {
        showSearchSuggestions(e.target.value);
      }
    }, 300);
  });
  
  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
    }
    // Toggle units with 'u' key
    if (e.key === "u" && document.activeElement !== input) {
      toggleUnits();
    }
  });
  
  // Click outside to close suggestions
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-container")) {
      hideSearchSuggestions();
    }
  });
}

function updateOnlineStatus() {
  state.isOffline = !navigator.onLine;
  if (state.isOffline) {
    showNotification("You are offline. Showing cached data.", "warning");
  }
}

function showSkeletonLoaders() {
  Object.values(elements).forEach(el => {
    if (el && !['unitToggle', 'weatherAlerts'].includes(el.id)) {
      el.classList.add('skeleton-loader');
    }
  });
}

function hideSkeletonLoaders() {
  Object.values(elements).forEach(el => {
    if (el) el.classList.remove('skeleton-loader');
  });
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 10000,
      enableHighAccuracy: true
    });
  });
}

async function handleSearch(e) {
  e.preventDefault();
  const city = input.value.trim();
  
  if (!city) {
    showNotification("Please enter a city name", "error");
    return;
  }
  
  state.lastSearched = city;
  localStorage.setItem('lastLocation', city);
  
  await fetchWeatherWithRetry(city);
  input.value = "";
  input.blur();
  hideSearchSuggestions();
}

function updateTime() {
  const now = new Date();
  const timeOptions = { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  };
  
  if (elements.time) {
    elements.time.textContent = now.toLocaleTimeString([], timeOptions);
  }
  
  if (elements.day) {
    const dayOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    elements.day.textContent = now.toLocaleDateString(undefined, dayOptions);
  }
}

function showLoader(show = true) {
  if (loader) {
    loader.classList.toggle("hidden", !show);
    loader.setAttribute("aria-hidden", !show);
  }
}

// Cache functions
function getCachedWeather(location) {
  const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  const cached = cache[location];
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedWeather(location, data) {
  const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  cache[location] = {
    data,
    timestamp: Date.now()
  };
  
  // Limit cache size
  const cacheKeys = Object.keys(cache);
  if (cacheKeys.length > 10) {
    // Remove oldest entries
    const sorted = cacheKeys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
    sorted.slice(0, sorted.length - 10).forEach(key => delete cache[key]);
  }
  
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

// Retry logic
async function fetchWeatherWithRetry(location, retries = 3) {
  // Check cache first
  if (state.isOffline) {
    const cached = getCachedWeather(location);
    if (cached) {
      updateWeather(cached);
      showNotification("Showing cached data (offline)", "info");
      return;
    }
  }
  
  for (let i = 0; i < retries; i++) {
    try {
      await fetchWeather(location);
      return;
    } catch (error) {
      if (i === retries - 1) {
        // Last retry failed, try cache
        const cached = getCachedWeather(location);
        if (cached) {
          updateWeather(cached);
          showNotification("Using cached data due to connection issues", "warning");
        } else {
          throw error;
        }
      } else {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  }
}

async function fetchWeather(location) {
  showLoader(true);
  
  try {
    const response = await fetch(
      `${BASE_URL}?key=${API_KEY}&q=${location}&days=5&aqi=yes&alerts=yes`
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      
      switch(response.status) {
        case 400:
          throw new Error(errorData?.error?.message || "Invalid request. Please check your input.");
        case 404:
          throw new Error("City not found. Please check the spelling.");
        case 401:
          throw new Error("API authentication failed. Please contact support.");
        case 429:
          throw new Error("Too many requests. Please try again later.");
        default:
          throw new Error(`Error: ${response.status} - ${response.statusText}`);
      }
    }
    
    const data = await response.json();
    
    // Cache the successful response
    setCachedWeather(location, data);
    
    updateWeather(data);
    
    // Save successful search
    if (location !== `${state.currentLocation?.lat},${state.currentLocation?.lon}`) {
      addToSearchHistory(location);
    }
    
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      showNotification("Network error. Please check your connection.", "error");
    } else {
      showNotification(error.message || "Failed to fetch weather data", "error");
    }
    console.error("Weather fetch error:", error);
    throw error;
  } finally {
    showLoader(false);
  }
}

function updateWeather(data) {
  const { current, location, forecast } = data;
  
  // Hide skeleton loaders
  hideSkeletonLoaders();
  
  // Animate updates
  animateWeatherUpdate(() => {
    // Current Weather
    updateCurrentWeather(current, location);
    
    // Forecast
    updateForecast(forecast.forecastday);
    
    // Additional details
    updateWeatherDetails(current);
    
    // Air quality if available
    if (current.air_quality) {
      updateAirQuality(current.air_quality);
    }
    
    // Weather alerts if any
    if (data.alerts && data.alerts.alert.length > 0) {
      displayWeatherAlerts(data.alerts.alert);
    } else if (elements.weatherAlerts) {
      elements.weatherAlerts.innerHTML = '';
    }
  });
  
  // Remove shimmer effect
  document.querySelectorAll(".shimmer").forEach(el => {
    el.classList.remove("shimmer");
  });
}

function updateCurrentWeather(current, location) {
  const temp = state.units === 'metric' ? current.temp_c : current.temp_f;
  const unit = state.units === 'metric' ? '°C' : '°F';
  
  if (elements.temperature) {
    elements.temperature.textContent = `${Math.round(temp)}${unit}`;
  }
  
  if (elements.condition) {
    elements.condition.textContent = current.condition.text;
  }
  
  if (elements.location) {
    elements.location.textContent = `${location.name}, ${location.country}`;
    // Add local time
    const localTime = new Date(location.localtime);
    elements.location.title = `Local time: ${localTime.toLocaleTimeString()}`;
  }
  
  if (elements.weatherIcon) {
    const iconClass = getWeatherIcon(current.condition.code, current.is_day);
    elements.weatherIcon.className = `wi ${iconClass} text-6xl weather-icon-animated`;
  }
  
  // Update wind compass
  updateWindCompass(current.wind_degree, current.wind_kph, current.wind_dir);
}

function updateForecast(forecastDays) {
  // Skip today (index 0) and show next 4 days
  for (let i = 1; i <= 4; i++) {
    const dayData = forecastDays[i];
    if (!dayData) continue;
    
    const dayElement = document.getElementById(`forecast-day${i}`);
    const tempElement = document.getElementById(`forecast-temp${i}`);
    const conditionElement = document.getElementById(`forecast-condition${i}`);
    const iconElement = document.getElementById(`forecast-icon${i}`);
    
    if (dayElement) {
      const date = new Date(dayData.date);
      dayElement.textContent = date.toLocaleDateString(undefined, { weekday: 'short' });
    }
    
    if (tempElement) {
      const avgTemp = state.units === 'metric' 
        ? dayData.day.avgtemp_c 
        : dayData.day.avgtemp_f;
      const unit = state.units === 'metric' ? '°C' : '°F';
      tempElement.textContent = `${Math.round(avgTemp)}${unit}`;
      
      // Add high/low temps
      const highTemp = state.units === 'metric' 
        ? dayData.day.maxtemp_c 
        : dayData.day.maxtemp_f;
      const lowTemp = state.units === 'metric' 
        ? dayData.day.mintemp_c 
        : dayData.day.mintemp_f;
      tempElement.title = `High: ${Math.round(highTemp)}° / Low: ${Math.round(lowTemp)}°`;
    }
    
    if (conditionElement) {
      conditionElement.textContent = dayData.day.condition.text;
    }
    
    if (iconElement) {
      const iconClass = getWeatherIcon(dayData.day.condition.code, 1);
      iconElement.className = `wi ${iconClass} text-2xl`;
    }
  }
}

function updateWeatherDetails(current) {
  // Humidity
  if (elements.humidity) {
    elements.humidity.textContent = `${current.humidity}%`;
  }
  
  // Feels like
  if (elements.feelsLike) {
    const feelsLike = state.units === 'metric' 
      ? current.feelslike_c 
      : current.feelslike_f;
    const unit = state.units === 'metric' ? '°C' : '°F';
    elements.feelsLike.textContent = `${Math.round(feelsLike)}${unit}`;
  }
  
  // UV Index
  if (elements.uvIndex) {
    elements.uvIndex.textContent = current.uv;
    elements.uvIndex.className = getUVIndexClass(current.uv);
    elements.uvIndex.title = getUVDescription(current.uv);
  }
  
  // Visibility
  if (elements.visibility) {
    const vis = state.units === 'metric' 
      ? `${current.vis_km} km` 
      : `${current.vis_miles} mi`;
    elements.visibility.textContent = vis;
  }
}

function updateWindCompass(degree, speed, direction) {
  if (elements.windArrow) {
    elements.windArrow.style.transform = `rotate(${degree}deg)`;
    elements.windArrow.style.transition = "transform 0.5s ease-in-out";
  }
  
  if (elements.windSpeed) {
    const windSpeed = state.units === 'metric' 
      ? `${speed} km/h` 
      : `${Math.round(speed * 0.621371)} mph`;
    elements.windSpeed.textContent = `${windSpeed} ${direction}`;
  }
}

// Air Quality functions
function updateAirQuality(airQuality) {
  if (!elements.aqi) return;
  
  const usEpaIndex = airQuality['us-epa-index'];
  const aqiValue = airQuality.pm2_5;
  
  elements.aqi.textContent = `AQI: ${usEpaIndex}`;
  elements.aqi.className = getAQIClass(usEpaIndex);
  elements.aqi.title = `PM2.5: ${aqiValue.toFixed(1)} μg/m³`;
}

function getAQIClass(aqi) {
  if (aqi <= 50) return 'aqi-good';
  if (aqi <= 100) return 'aqi-moderate';
  if (aqi <= 150) return 'aqi-unhealthy-sensitive';
  if (aqi <= 200) return 'aqi-unhealthy';
  if (aqi <= 300) return 'aqi-very-unhealthy';
  return 'aqi-hazardous';
}

// Weather Alerts
function displayWeatherAlerts(alerts) {
  if (!elements.weatherAlerts) return;
  
  elements.weatherAlerts.innerHTML = '';
  
  alerts.forEach(alert => {
    const alertElement = document.createElement('div');
    alertElement.className = 'weather-alert';
    alertElement.innerHTML = `
      <h4>${alert.headline}</h4>
      <p>${alert.desc}</p>
      <small>Effective: ${new Date(alert.effective).toLocaleString()}</small>
    `;
    elements.weatherAlerts.appendChild(alertElement);
  });
}

// UV Index functions
function getUVIndexClass(uv) {
  if (uv <= 2) return "uv-low";
  if (uv <= 5) return "uv-moderate";
  if (uv <= 7) return "uv-high";
  if (uv <= 10) return "uv-very-high";
  return "uv-extreme";
}

function getUVDescription(uv) {
  if (uv <= 2) return "Low - Minimal sun protection required";
  if (uv <= 5) return "Moderate - Take precautions";
  if (uv <= 7) return "High - Protection essential";
  if (uv <= 10) return "Very High - Extra protection needed";
  return "Extreme - Avoid sun exposure";
}

// Unit conversion
function toggleUnits() {
  state.units = state.units === 'metric' ? 'imperial' : 'metric';
  localStorage.setItem('weatherUnits', state.units);
  
  // Update button text if exists
  if (elements.unitToggle) {
    elements.unitToggle.textContent = state.units === 'metric' ? '°C' : '°F';
  }
  
  // Re-fetch current location weather to update display
  if (state.lastSearched) {
    fetchWeatherWithRetry(state.lastSearched);
  } else if (state.currentLocation) {
    fetchWeatherWithRetry(`${state.currentLocation.lat},${state.currentLocation.lon}`);
  }
}

// Animation functions
function animateWeatherUpdate(callback) {
  // Add fade-out class
  const weatherContainer = document.querySelector(".weather-container");
  if (weatherContainer) {
    weatherContainer.classList.add("updating");
    
    setTimeout(() => {
      callback();
      weatherContainer.classList.remove("updating");
    }, 300);
  } else {
    callback();
  }
}

// Notification system
function showNotification(message, type = "info") {
  // Remove existing notifications
  document.querySelectorAll('.notification').forEach(n => n.remove());
  
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Add icon based on type
  const icon = document.createElement('span');
  icon.className = 'notification-icon';
  switch(type) {
    case 'error':
      icon.textContent = '❌';
      break;
    case 'warning':
      icon.textContent = '⚠️';
      break;
    case 'success':
      icon.textContent = '✅';
      break;
    default:
      icon.textContent = 'ℹ️';
  }
  notification.prepend(icon);
  
  // Add to page
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => notification.classList.add("show"), 10);
  
  // Remove after delay
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Search history and suggestions
function addToSearchHistory(location) {
  const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
  
  // Remove if already exists
  const index = history.indexOf(location);
  if (index > -1) history.splice(index, 1);
  
  // Add to beginning
  history.unshift(location);
  
  // Keep only last 5
  if (history.length > 5) history.pop();
  
  localStorage.setItem('searchHistory', JSON.stringify(history));
}

function showSearchSuggestions(query) {
  const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
  const filtered = history.filter(item => 
    item.toLowerCase().includes(query.toLowerCase())
  );
  
  if (filtered.length === 0) return;
  
  // Create or update suggestions container
  let suggestionsContainer = document.getElementById('search-suggestions');
  if (!suggestionsContainer) {
    suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = 'search-suggestions';
    suggestionsContainer.className = 'search-suggestions';
    input.parentElement.appendChild(suggestionsContainer);
  }
  
  suggestionsContainer.innerHTML = '';
  
  filtered.forEach(suggestion => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.textContent = suggestion;
    item.addEventListener('click', () => {
      input.value = suggestion;
      handleSearch(new Event('submit'));
    });
    suggestionsContainer.appendChild(item);
  });
}

function hideSearchSuggestions() {
  const suggestionsContainer = document.getElementById('search-suggestions');
  if (suggestionsContainer) {
    suggestionsContainer.remove();
  }
}

// Enhanced weather icon mapping
function getWeatherIcon(code, isDay) {
  const iconMap = {
    1000: isDay ? "wi-day-sunny" : "wi-night-clear",
    1003: isDay ? "wi-day-cloudy" : "wi-night-alt-cloudy",
    1006: "wi-cloudy",
    1009: "wi-cloudy-windy",
    1030: "wi-fog",
    1063: isDay ? "wi-day-showers" : "wi-night-showers",
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
    1180: isDay ? "wi-day-rain" : "wi-night-rain",
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
    1273: isDay ? "wi-day-storm-showers" : "wi-night-storm-showers",
    1276: "wi-thunderstorm",
    1279: "wi-snow-thunderstorm",
    1282: "wi-snow-thunderstorm"
  };

  return iconMap[code] || "wi-na";
}

// Utility functions
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Performance monitoring
function logPerformance(operation, startTime) {
  const endTime = performance.now();
  const duration = endTime - startTime;
  console.log(`${operation} took ${duration.toFixed(2)}ms`);
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchWeather,
    updateWeather,
    getWeatherIcon,
    toggleUnits,
    getCachedWeather,
    setCachedWeather
  };
}

// Service Worker registration for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => console.log('SW registered:', registration))
      .catch(error => console.log('SW registration failed:', error));
  });
}
