const socket = io();

let userId = localStorage.getItem("user_id");
if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("user_id", userId);
}

let queue = JSON.parse(localStorage.getItem("queue")) || [];
console.log(queue);
if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            socket.emit("send-location", { latitude, longitude });

            let closestLocation = null;
            let minDistance = 50000;

            highlightLocations.forEach((location) => {
                const distance = getDistanceFromLatLonInMeters(
                    latitude,
                    longitude,
                    location.latitude,
                    location.longitude
                );
                if (distance <= minDistance) {
                    closestLocation = location;
                    minDistance = distance;
                }
            });

            highlightLocations.forEach((location) => {
                if (location === closestLocation) {
                    const status = "start";
                    location.marker.setIcon(
                        L.icon({
                            iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
                            iconSize: [32, 32],
                        })
                    );
                    if (!queue.includes(location.name)) {
                        sendLocationToPython(location.name, location.latitude, location.longitude, status, location.esp32_id);
                        queue.push(location.name);
                        localStorage.setItem("queue", JSON.stringify(queue));
                    }
                } else {
                    const status = "stop";
                    location.marker.setIcon(
                        L.icon({
                            iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
                            iconSize: [32, 32],
                        })
                    );
                    if (queue.includes(location.name)) {
                        sendLocationToPython(location.name, location.latitude, location.longitude, status, location.esp32_id);
                        queue = queue.filter((item) => item !== location.name);
                        localStorage.setItem("queue", JSON.stringify(queue));
                    }
                }
            });
        },
        (error) => console.error(error),
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
        }
    );
}

const map = L.map("map").setView([13.053275150000001, 80.28328873013857], 16);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "OpenStreetMap",
}).addTo(map);

const highlightLocations = [
    { name: "Arcot Road", latitude: 13.0418592823117, longitude: 80.17641308680929, esp32_id: "esp32_001" },
    { name: "Besant Nagar", latitude: 12.9960874, longitude: 80.2676685, esp32_id: "esp32_002" },
    { name: "Anna Nagar Roundabout", latitude: 13.0846633, longitude: 80.2179667, esp32_id: "esp32_003" },
    { name: "Infosys", latitude: 12.8925236, longitude: 80.2275312, esp32_id: "esp32_004" },
];

highlightLocations.forEach((location) => {
    const marker = L.marker([location.latitude, location.longitude]).addTo(map);
    marker.bindPopup(`<b>${location.name}</b>`).openPopup();
    location.marker = marker;
});

const markers = {};
socket.on("receive-location", (data) => {
    const { id, latitude, longitude } = data;
    map.setView([latitude, longitude]);
    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);
    } else {
        markers[id] = L.marker([latitude, longitude]).addTo(map);
    }
});

socket.on("user-disconnected", (id) => {
    if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
    }
});

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = degToRad(lat2 - lat1);
    const dLon = degToRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(degToRad(lat1)) *
        Math.cos(degToRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function degToRad(deg) {
    return deg * (Math.PI / 180);
}

function sendLocationToPython(name, latitude, longitude, status, esp32_id) {
    fetch("https://ambuclear-server-2.onrender.com/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: userId,
            esp32_id,
            name,
            latitude,
            longitude,
            status
        })
    })
    .then((res) => res.json())
    .then((data) => console.log("Location sent:", data))
    .catch((err) => console.error("Send error:", err));
}

async function fetchQueue() {
    try {
        const response = await fetch(`https://ambuclear-server-2.onrender.com/queue?user_id=${userId}`);
        const data = await response.json();
        if (data.status === "success") {
            queue = data.queue;
            localStorage.setItem("queue", JSON.stringify(queue));
        }
    } catch (error) {
        console.error("Queue fetch error:", error);
    }
}
setInterval(fetchQueue, 1 * 60 * 1000);
fetchQueue();
