FROM node:20-slim

# Install arduino-cli + python3 (required by ESP32 build tools: esptool.py, gen_esp32part.py)
RUN apt-get update && apt-get install -y curl python3 python3-serial && \
    curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=/usr/local/bin sh && \
    rm -rf /var/lib/apt/lists/*

# Pre-install board cores (this makes the image larger but compile requests fast)
RUN arduino-cli core update-index && \
    arduino-cli core install arduino:avr && \
    arduino-cli core install esp32:esp32 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json && \
    arduino-cli core install esp8266:esp8266 --additional-urls https://arduino.esp8266.com/stable/package_esp8266com_index.json

# Install common libraries (Wire/SPI are built-in, skip them)
RUN arduino-cli lib install "TensorFlowLite_ESP32" "WiFi" "Servo" "Adafruit NeoPixel" "DHT sensor library" "Adafruit Unified Sensor" "LiquidCrystal I2C" "ArduinoJson" || true

# Patch TensorFlowLite_ESP32 for GCC 10+ compilation error
RUN sed -i 's/const size_type count_;/size_type count_;/g' /root/Arduino/libraries/TensorFlowLite_ESP32/src/third_party/flatbuffers/stl_emulation.h || true

# Remove deprecated bundled LCD/bus drivers that break on ESP32 Core v3+
RUN rm -rf /root/Arduino/libraries/TensorFlowLite_ESP32/src/screen /root/Arduino/libraries/TensorFlowLite_ESP32/src/bus || true

# Fix C++17 placement new accessibility error by making operator delete public
RUN sed -i 's/void operator delete(void\* p) {}/public: void operator delete(void\* p) {}/g' /root/Arduino/libraries/TensorFlowLite_ESP32/src/tensorflow/lite/micro/compatibility.h || true

WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY server.js ./

EXPOSE 8080
CMD ["node", "server.js"]
