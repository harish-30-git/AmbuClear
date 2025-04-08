const socket = io();

if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords; 
            socket.emit("send-location", { latitude, longitude });

            // Find the closest highlighted location within 1000 meters
            let closestLocation = null;
            let minDistance = 300; // Threshold: 1 kilometer (1000 meters)

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

            // Change the closest location's marker to green
            highlightLocations.forEach((location) => {
                if (location === closestLocation) {
                    location.marker.setIcon(
                        L.icon({
                            iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
                            iconSize: [32, 32], // Adjust size if needed
                        })
                    );
                } else {
                    // Reset other markers to the default icon
                    location.marker.setIcon(
                        L.icon({
                            iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
                            iconSize: [32, 32], // Adjust size if needed
                        })
                    );
                }
            });
        },
        (error) => {
            console.error(error);
        },
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

// Predefined highlight locations
const highlightLocations = [
    { name: "Arcot Road", latitude: 13.0418592823117, longitude: 80.17641308680929 },
    { name: "Besant Nagar", latitude: 12.9960874, longitude: 80.2676685 },
    { name: "Anna Nagar Roundabout", latitude: 13.084663299999999, longitude: 80.21796674973545 },
    { name: "Infosys", latitude: 12.8925236, longitude: 80.2275312 }
];

// Add markers for highlight locations
highlightLocations.forEach((location) => {
    const marker = L.marker([location.latitude, location.longitude]).addTo(map);
    marker.bindPopup(`<b>${location.name}</b>`).openPopup();
    location.marker = marker; // Store marker reference in the location object
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

// Function to calculate distance between two coordinates in meters
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radius of the Earth in meters
    const dLat = degToRad(lat2 - lat1);
    const dLon = degToRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(degToRad(lat1)) *
            Math.cos(degToRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
}

function degToRad(deg) {
    return deg * (Math.PI / 180);
}
