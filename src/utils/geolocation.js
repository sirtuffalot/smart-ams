export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// Default radius is 500m to account for laptop WiFi geolocation inaccuracy.
// The lecturer's laptop has no GPS chip so its location can be off by 300–500m.
// We also subtract the student's device-reported accuracy from the raw distance
// so students aren't penalised for their hardware limitations.
export const checkLocation = (targetLat, targetLng, maxDistanceMeters = 500) => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject("Geolocation is not supported by your browser");
            return;
        }

        navigator.geolocation.getCurrentPosition((position) => {
            const { latitude, longitude, accuracy } = position.coords;
            const distance = calculateDistance(latitude, longitude, targetLat, targetLng);

            // Subtract device accuracy so a student 50m away with a ±60m GPS
            // reading isn't incorrectly rejected.
            const effectiveDistance = Math.max(0, distance - (accuracy || 0));

            resolve({
                isWithinRange: effectiveDistance <= maxDistanceMeters,
                distance: distance,
                effectiveDistance: effectiveDistance,
                accuracy: accuracy,
                coords: { latitude, longitude }
            });
        }, (error) => {
            reject(error.message);
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    });
};
