FROM node:20-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates xz-utils git \
  && rm -rf /var/lib/apt/lists/*

# Install arduino-cli
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh \
  && mv bin/arduino-cli /usr/local/bin/arduino-cli \
  && arduino-cli config init

# Install board cores used by BitBlock
RUN arduino-cli core update-index \
  --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json \
  --additional-urls https://arduino.esp8266.com/stable/package_esp8266com_index.json \
  && arduino-cli core install arduino:avr \
  && arduino-cli core install arduino:renesas_uno \
  && arduino-cli core install esp32:esp32 \
    --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json \
    --additional-urls https://arduino.esp8266.com/stable/package_esp8266com_index.json \
  && arduino-cli core install esp8266:esp8266 \
    --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json \
    --additional-urls https://arduino.esp8266.com/stable/package_esp8266com_index.json

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server.js ./

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
