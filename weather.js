/**
 * Weather Logic for MyATSOM
 * Fetches real-time weather from Open-Meteo API based on user location.
 */
document.addEventListener('DOMContentLoaded', () => {
    const DEFAULT_LAT = 45.4642; // Milan
    const DEFAULT_LNG = 9.1900;
    
    const weatherPill = document.querySelector('.weather-pill');
    const weatherIcon = document.querySelector('.weather-icon');
    const weatherTemp = document.querySelector('.weather-temp');

    if (!weatherPill) return;

    /**
     * Map WMO code to SVG icon
     * @param {number} code - WMO weather code
     * @param {number} isDay - 1 for day, 0 for night
     * @returns {string} - Path to SVG icon
     */
    function getIconForCode(code, isDay) {
        const iconsDir = 'icons/';
        
        // 0: Clear sky
        if (code === 0) {
            return isDay ? `${iconsDir}Sunny.svg` : `${iconsDir}ClearMoon.svg`;
        }
        
        // 1, 2: Mainly clear, partly cloudy
        if (code === 1 || code === 2) {
            return isDay ? `${iconsDir}CloudySunny.svg` : `${iconsDir}Moon.svg`;
        }
        
        // 3: Overcast, 45, 48: Fog
        if (code === 3 || code === 45 || code === 48) {
            return `${iconsDir}Cloudy.svg`;
        }
        
        // 51, 53, 55: Drizzle, 61, 63, 65: Rain, 80, 81, 82: Showers
        if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
            return `${iconsDir}Rainy.svg`;
        }
        
        // 71, 73, 75: Snow fall, 77: Snow grains, 85, 86: Snow showers
        if ([71, 73, 75, 77, 85, 86].includes(code)) {
            return `${iconsDir}Snowy.svg`;
        }
        
        // 95: Thunderstorm, 96, 99: Thunderstorm with hail
        if ([95, 96, 99].includes(code)) {
            return `${iconsDir}Thunderstorm.svg`;
        }

        return `${iconsDir}CloudySunny.svg`; // Default fallback
    }

    async function updateWeather(lat, lng) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&timezone=auto`;
            const response = await fetch(url);
            const data = await response.json();

            if (data && data.current_weather) {
                const temp = Math.round(data.current_weather.temperature);
                const code = data.current_weather.weathercode;
                const isDay = data.current_weather.is_day;

                if (weatherTemp) weatherTemp.textContent = `${temp}°`;
                if (weatherIcon) weatherIcon.src = getIconForCode(code, isDay);
                
                // Optional: add a tooltip with more info
                weatherPill.title = `Meteo attuale: ${temp}°C`;
            }
        } catch (error) {
            console.error("Errore nel recupero dei dati meteo:", error);
        }
    }

    function fetchLocationAndWeather() {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    updateWeather(position.coords.latitude, position.coords.longitude);
                },
                (error) => {
                    console.warn("Geolocalizzazione non permessa o errore. Uso fallback (Milano).", error);
                    updateWeather(DEFAULT_LAT, DEFAULT_LNG);
                },
                { timeout: 5000 }
            );
        } else {
            updateWeather(DEFAULT_LAT, DEFAULT_LNG);
        }
    }

    // Initial fetch
    fetchLocationAndWeather();

    // Refresh weather every 20 minutes
    setInterval(fetchLocationAndWeather, 20 * 60 * 1000);
});
