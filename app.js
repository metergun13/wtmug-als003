
const cityInput = document.getElementById("city-input");
const searchForm = document.getElementById("search-form");
const geoBtn = document.getElementById("geo-btn");
const themeBtn = document.getElementById("theme-btn");

const weatherDisplay = document.getElementById("weather-display");
const errorMsg = document.getElementById("error-msg");
const offlineBanner = document.getElementById("offline-banner");
const loadingMsg = document.getElementById("loading-msg");

// Service Worker kaydı
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service Worker kayıt hatası:", error);
    });
  });
}

// İnternet bağlantısı kontrolü
function updateOnlineStatus() {
  offlineBanner.classList.toggle("hidden", navigator.onLine);
}

window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

// Tema ayarları
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  themeBtn.setAttribute(
    "aria-label",
    theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"
  );

  try {
    localStorage.setItem("weather-theme", theme);
  } catch (error) {
    console.warn("Tema tercihi kaydedilemedi.");
  }
}

let savedTheme = "light";

try {
  savedTheme = localStorage.getItem("weather-theme") || "light";
} catch (error) {
  console.warn("Tema tercihi okunamadı.");
}

setTheme(savedTheme === "dark" ? "dark" : "light");

themeBtn.addEventListener("click", () => {
  const currentTheme =
    document.documentElement.getAttribute("data-theme");

  setTheme(currentTheme === "dark" ? "light" : "dark");
});

// Şehir arama
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const cityName = cityInput.value.trim();

  if (!cityName) {
    showError("Lütfen bir şehir adı girin.");
    return;
  }

  fetchCityCoordinates(cityName);
});

// Konum kullanma
geoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showError("Tarayıcınız konum özelliğini desteklemiyor.");
    return;
  }

  loadingMsg.classList.remove("hidden");
  hideError();

  navigator.geolocation.getCurrentPosition(
    (position) => {
      fetchWeatherData(
        position.coords.latitude,
        position.coords.longitude,
        "Konumunuz"
      );
    },
    (error) => {
      loadingMsg.classList.add("hidden");

      if (error.code === error.PERMISSION_DENIED) {
        showError("Konum izni verilmedi. Tarayıcı ayarlarını kontrol edin.");
      } else if (error.code === error.TIMEOUT) {
        showError("Konum isteği zaman aşımına uğradı. Tekrar deneyin.");
      } else {
        showError("Konum bilgisi alınamadı.");
      }
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000
    }
  );
});

// Şehir adını koordinata çevirme
async function fetchCityCoordinates(cityName) {
  hideError();
  loadingMsg.classList.remove("hidden");

  try {
    const url =
      "https://geocoding-api.open-meteo.com/v1/search?" +
      new URLSearchParams({
        name: cityName,
        count: "1",
        language: "tr",
        format: "json"
      });

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Şehir arama servisine ulaşılamadı.");
    }

    const data = await response.json();

    if (data.error) {
      throw new Error("Şehir araması başarısız oldu.");
    }

    if (!data.results || data.results.length === 0) {
      showError(
        `"${cityName}" adında bir şehir bulunamadı.`
      );
      return;
    }

    const city = data.results[0];

    const locationTitle = [
      city.name,
      city.admin1,
      city.country
    ].filter(Boolean).filter((value, index, array) => {
      return array.indexOf(value) === index;
    }).join(", ");

    await fetchWeatherData(
      city.latitude,
      city.longitude,
      locationTitle
    );
  } catch (error) {
    showError(
      navigator.onLine
        ? "Şehir bilgisi alınamadı. Lütfen tekrar deneyin."
        : "İnternet bağlantısı yok. Şehir aramak için bağlantı gerekir."
    );
  } finally {
    loadingMsg.classList.add("hidden");
  }
}

// Hava durumu verilerini çekme
async function fetchWeatherData(lat, lon, locationTitle) {
  hideError();
  loadingMsg.classList.remove("hidden");

  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "wind_speed_10m",
        "weather_code"
      ].join(","),
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min"
      ].join(","),
      timezone: "auto",
      forecast_days: "5"
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`
    );

    if (!response.ok) {
      throw new Error("Hava durumu servisine ulaşılamadı.");
    }

    const data = await response.json();

    if (
      data.error ||
      !data.current ||
      !data.daily ||
      !Array.isArray(data.daily.time)
    ) {
      throw new Error("Hava durumu verileri geçersiz.");
    }

    renderWeather(data, locationTitle);
  } catch (error) {
    showError(
      navigator.onLine
        ? "Hava durumu alınamadı. Biraz sonra tekrar deneyin."
        : "İnternet yok. Güncel hava durumu için bağlantı gerekir."
    );
  } finally {
    loadingMsg.classList.add("hidden");
  }
}

// Hava durumu verilerini ekrana yazdırma
function renderWeather(data, locationTitle) {
  const current = data.current;

  document.getElementById("location-name").textContent =
    locationTitle;

  document.getElementById("current-temp").textContent =
    Math.round(current.temperature_2m);

  document.getElementById("current-humidity").textContent =
    current.relative_humidity_2m;

  document.getElementById("current-wind").textContent =
    current.wind_speed_10m;

  document.getElementById("weather-condition").textContent =
    getWeatherDescription(current.weather_code);

  const updateDate = new Date();

  document.getElementById("last-updated").textContent =
    updateDate.toLocaleDateString("tr-TR") +
    " " +
    updateDate.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit"
    });

  const forecastContainer =
    document.getElementById("forecast-container");

  forecastContainer.replaceChildren();

  const daily = data.daily;
  const count = Math.min(
    5,
    daily.time.length,
    daily.weather_code.length,
    daily.temperature_2m_max.length,
    daily.temperature_2m_min.length
  );

  for (let i = 0; i < count; i++) {
    const [year, month, day] = daily.time[i]
      .split("-")
      .map(Number);

    // Tarihi yerel saat diliminden etkilenmeyecek şekilde oluştur.
    const date = new Date(year, month - 1, day);

    const dayName = date.toLocaleDateString("tr-TR", {
      weekday: "long"
    });

    const condition = getWeatherDescription(
      daily.weather_code[i]
    );

    const maxTemp = Math.round(
      daily.temperature_2m_max[i]
    );

    const minTemp = Math.round(
      daily.temperature_2m_min[i]
    );

    const card = document.createElement("div");
    card.className = "forecast-card";

    const descriptionBox = document.createElement("div");

    const dayElement = document.createElement("strong");
    dayElement.textContent = dayName;

    const conditionElement = document.createElement("div");
    conditionElement.className = "forecast-description";
    conditionElement.textContent = condition;

    descriptionBox.append(dayElement, conditionElement);

    const temperatureBox = document.createElement("div");
    temperatureBox.className = "forecast-temperatures";

    const maxElement = document.createElement("span");
    maxElement.className = "forecast-max";
    maxElement.textContent = `${maxTemp}°C`;

    const separator = document.createTextNode(" / ");

    const minElement = document.createElement("span");
    minElement.className = "forecast-min";
    minElement.textContent = `${minTemp}°C`;

    temperatureBox.append(maxElement, separator, minElement);
    card.append(descriptionBox, temperatureBox);

    forecastContainer.appendChild(card);
  }

  hideError();
  weatherDisplay.classList.remove("hidden");
}

// WMO hava durumu kodları
function getWeatherDescription(code) {
  const descriptions = {
    0: "Açık",
    1: "Çoğunlukla açık",
    2: "Parçalı bulutlu",
    3: "Kapalı",
    45: "Sisli",
    48: "Kırağılı sis",
    51: "Hafif çisenti",
    53: "Orta şiddette çisenti",
    55: "Yoğun çisenti",
    56: "Hafif donan çisenti",
    57: "Yoğun donan çisenti",
    61: "Hafif yağmur",
    63: "Orta şiddette yağmur",
    65: "Şiddetli yağmur",
    66: "Hafif donan yağmur",
    67: "Şiddetli donan yağmur",
    71: "Hafif kar",
    73: "Orta şiddette kar",
    75: "Yoğun kar",
    77: "Kar taneleri",
    80: "Hafif sağanak",
    81: "Orta şiddette sağanak",
    82: "Şiddetli sağanak",
    85: "Hafif kar sağanağı",
    86: "Yoğun kar sağanağı",
    95: "Gök gürültülü fırtına",
    96: "Dolu ihtimalli fırtına",
    99: "Şiddetli dolulu fırtına"
  };

  return descriptions[code] || "Bilinmeyen hava durumu";
}

// Hata mesajları
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove("hidden");
}

function hideError() {
  errorMsg.textContent = "";
  errorMsg.classList.add("hidden");
}
