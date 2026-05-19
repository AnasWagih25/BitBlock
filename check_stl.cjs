const https = require('https');
const fs = require('fs');
https.get('https://raw.githubusercontent.com/tanakamasayuki/Arduino_TensorFlowLite_ESP32/master/src/third_party/flatbuffers/stl_emulation.h', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const lines = data.split('\n');
    lines.forEach((l, i) => {
      if (l.includes('count_')) {
        console.log(`${i+1}: ${l}`);
      }
    });
  });
});
