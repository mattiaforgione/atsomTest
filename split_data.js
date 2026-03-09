const fs = require('fs');

try {
    let code = fs.readFileSync('data.js', 'utf8');

    // Add module export to safely require the file
    code += '\nmodule.exports = stavData;\n';
    fs.writeFileSync('temp_data_module.js', code);

    // Require the data
    const data = require('./temp_data_module.js');

    // 1. Create fermate.js
    const stopsCode = `const stavStops = ${JSON.stringify(data.stops, null, 4)};\n`;
    fs.writeFileSync('fermate.js', stopsCode);
    console.log("Created fermate.js");

    // 2. Create linea files
    let lineNames = [];
    data.lines.forEach(line => {
        const varName = `linea_${line.id}`;
        lineNames.push(varName);
        const lineCode = `const ${varName} = ${JSON.stringify(line, null, 4)};\n`;
        fs.writeFileSync(`${varName}.js`, lineCode);
        console.log(`Created ${varName}.js`);
    });

    // 3. Create new data.js content
    const newDataJs = `const stavData = {
    stops: stavStops,
    lines: [${lineNames.join(', ')}]
};
`;
    fs.writeFileSync('data.js', newDataJs);
    console.log("Overwrote data.js with aggregated structure.");

    // Cleanup
    fs.unlinkSync('temp_data_module.js');
    console.log("Data splitting completed successfully.");

} catch (e) {
    console.error("Error splitting data:", e);
    process.exit(1);
}
