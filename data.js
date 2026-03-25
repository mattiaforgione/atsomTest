const stavData = {
    stops: [...stavStops, ...metroTreniStops],
    lines: [
        linea_1,
        linea_Z551,
        linea_Z552,
        linea_Z553,
        linea_Z559,
        linea_Z560,
        linea_Z557,
        linea_Z554,
        linea_Z555,
        linea_S9,
        linea_S19,
        linea_327,
    ]
};

// Normalizzazione dati ATM per compatibilità con app.js
stavData.lines.forEach(line => {
    if (line.operatore === "ATM") {
        for (let day in line.dayTypes) {
            const groups = line.dayTypes[day];
            if (!Array.isArray(groups) || groups.length === 0) continue;
            
            // Se il primo stop ha un array 'times', procediamo all'unpacking
            if (groups[0].stops && groups[0].stops[0] && Array.isArray(groups[0].stops[0].times)) {
                const newTrips = [];
                groups.forEach(group => {
                    const numTrips = Math.max(...group.stops.map(s => s.times.length));
                    for (let i = 0; i < numTrips; i++) {
                        newTrips.push({
                            tripId: `${line.id}_${group.destination}_${i}`,
                            destination: group.destination,
                            stops: group.stops.map(s => ({
                                stopId: s.stopId,
                                time: s.times[i]
                            })).filter(s => s.time),
                            legend: group.legend || {}
                        });
                    }
                });
                line.dayTypes[day] = newTrips;
            }
        }
    }
});
