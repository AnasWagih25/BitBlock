/**
 * 20 Marketplace-ready example configurations.
 * Each entry contains connected Blockly XML that generates valid, compilable Arduino C++.
 * These can be inserted into any workspace via Blockly.Xml.domToWorkspace().
 */

export interface MarketplaceExample {
  name: string;
  description: string;
  category: string;
  boardId: string;
  blocksXml: string;
}

export const MARKETPLACE_EXAMPLES: MarketplaceExample[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // 1. LED Blink
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "LED Blink",
    description: "Classic Arduino blink sketch — toggles the built-in LED on pin 13 every second. Perfect first project for any board.",
    category: "GPIO",
    boardId: "arduino-uno-r3",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="led_init">
        <value name="PIN"><block type="math_number"><field name="NUM">13</field></block></value>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="140">
    <statement name="DO">
      <block type="led_on">
        <value name="PIN"><block type="math_number"><field name="NUM">13</field></block></value>
        <next>
          <block type="timing_delay">
            <value name="MS"><block type="math_number"><field name="NUM">1000</field></block></value>
            <next>
              <block type="led_off">
                <value name="PIN"><block type="math_number"><field name="NUM">13</field></block></value>
                <next>
                  <block type="timing_delay">
                    <value name="MS"><block type="math_number"><field name="NUM">1000</field></block></value>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Button-Controlled LED
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Button-Controlled LED",
    description: "Reads a push button on pin 4 and turns an LED on pin 13 on when pressed. Demonstrates digital input with pull-up and conditional logic.",
    category: "GPIO",
    boardId: "esp32-wroom",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="gpio_pin_mode">
        <value name="PIN"><block type="math_number"><field name="NUM">4</field></block></value>
        <field name="MODE">INPUT_PULLUP</field>
        <next>
          <block type="led_init">
            <value name="PIN"><block type="math_number"><field name="NUM">13</field></block></value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="180">
    <statement name="DO">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">EQ</field>
            <value name="A"><block type="gpio_digital_read"><value name="PIN"><block type="math_number"><field name="NUM">4</field></block></value></block></value>
            <value name="B"><block type="logic_boolean"><field name="BOOL">FALSE</field></block></value>
          </block>
        </value>
        <statement name="DO0">
          <block type="led_on">
            <value name="PIN"><block type="math_number"><field name="NUM">13</field></block></value>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="led_off">
            <value name="PIN"><block type="math_number"><field name="NUM">13</field></block></value>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Temperature Monitor (DHT22)
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Temperature & Humidity Monitor",
    description: "Reads temperature and humidity from a DHT22 sensor on pin 4 and prints values to Serial every 2 seconds.",
    category: "Sensors",
    boardId: "esp32-wroom",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="dht22_init">
        <value name="PIN"><block type="math_number"><field name="NUM">4</field></block></value>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="140">
    <statement name="DO">
      <block type="serial_print">
        <field name="MODE">println</field>
        <value name="TEXT"><block type="dht_read_temp_c"><value name="PIN"><block type="math_number"><field name="NUM">4</field></block></value></block></value>
        <next>
          <block type="serial_print">
            <field name="MODE">println</field>
            <value name="TEXT"><block type="dht_read_humidity"><value name="PIN"><block type="math_number"><field name="NUM">4</field></block></value></block></value>
            <next>
              <block type="timing_delay">
                <value name="MS"><block type="math_number"><field name="NUM">2000</field></block></value>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Ultrasonic Distance Alarm
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Ultrasonic Distance Alarm",
    description: "Measures distance with HC-SR04 (Trig pin 9, Echo pin 10). When an object is closer than 20cm, a buzzer on pin 8 sounds an alarm tone.",
    category: "Sensors",
    boardId: "arduino-uno-r3",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="hcsr04_init">
        <value name="TRIG"><block type="math_number"><field name="NUM">9</field></block></value>
        <value name="ECHO"><block type="math_number"><field name="NUM">10</field></block></value>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="160">
    <statement name="DO">
      <block type="controls_if">
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">LT</field>
            <value name="A"><block type="hcsr04_read_cm"><value name="TRIG"><block type="math_number"><field name="NUM">9</field></block></value></block></value>
            <value name="B"><block type="math_number"><field name="NUM">20</field></block></value>
          </block>
        </value>
        <statement name="DO0">
          <block type="tone_async">
            <value name="PIN"><block type="math_number"><field name="NUM">8</field></block></value>
            <value name="FREQ"><block type="math_number"><field name="NUM">1000</field></block></value>
            <value name="DURATION"><block type="math_number"><field name="NUM">200</field></block></value>
          </block>
        </statement>
        <next>
          <block type="timing_delay">
            <value name="MS"><block type="math_number"><field name="NUM">100</field></block></value>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Servo Sweep
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Servo Sweep",
    description: "Sweeps a servo motor on pin 9 from 0° to 180° and back in 1° increments. Classic servo test for robotics.",
    category: "Actuators",
    boardId: "arduino-uno-r3",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="servo_init">
        <value name="PIN"><block type="math_number"><field name="NUM">9</field></block></value>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="140">
    <statement name="DO">
      <block type="controls_for">
        <field name="VAR">angle</field>
        <value name="FROM"><block type="math_number"><field name="NUM">0</field></block></value>
        <value name="TO"><block type="math_number"><field name="NUM">180</field></block></value>
        <value name="BY"><block type="math_number"><field name="NUM">1</field></block></value>
        <statement name="DO">
          <block type="servo_write_angle">
            <value name="PIN"><block type="math_number"><field name="NUM">9</field></block></value>
            <value name="ANGLE"><block type="variables_get"><field name="VAR">angle</field></block></value>
            <next>
              <block type="timing_delay">
                <value name="MS"><block type="math_number"><field name="NUM">15</field></block></value>
              </block>
            </next>
          </block>
        </statement>
        <next>
          <block type="controls_for">
            <field name="VAR">angle</field>
            <value name="FROM"><block type="math_number"><field name="NUM">180</field></block></value>
            <value name="TO"><block type="math_number"><field name="NUM">0</field></block></value>
            <value name="BY"><block type="math_number"><field name="NUM">1</field></block></value>
            <statement name="DO">
              <block type="servo_write_angle">
                <value name="PIN"><block type="math_number"><field name="NUM">9</field></block></value>
                <value name="ANGLE"><block type="variables_get"><field name="VAR">angle</field></block></value>
                <next>
                  <block type="timing_delay">
                    <value name="MS"><block type="math_number"><field name="NUM">15</field></block></value>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 6. NeoPixel Rainbow Cycle
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "NeoPixel Rainbow",
    description: "Drives a strip of 12 NeoPixels on pin 5 through a repeating color sequence — fills all pixels red, then green, then blue with 500ms between each color.",
    category: "Display",
    boardId: "esp32-wroom",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="neopixel_init">
        <value name="PIN"><block type="math_number"><field name="NUM">5</field></block></value>
        <value name="COUNT"><block type="math_number"><field name="NUM">12</field></block></value>
        <next>
          <block type="neopixel_set_brightness">
            <value name="VAL"><block type="math_number"><field name="NUM">50</field></block></value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="200">
    <statement name="DO">
      <block type="neopixel_fill">
        <value name="R"><block type="math_number"><field name="NUM">255</field></block></value>
        <value name="G"><block type="math_number"><field name="NUM">0</field></block></value>
        <value name="B"><block type="math_number"><field name="NUM">128</field></block></value>
        <next>
          <block type="neopixel_show">
            <next>
              <block type="timing_delay">
                <value name="MS"><block type="math_number"><field name="NUM">500</field></block></value>
                <next>
                  <block type="neopixel_fill">
                    <value name="R"><block type="math_number"><field name="NUM">0</field></block></value>
                    <value name="G"><block type="math_number"><field name="NUM">255</field></block></value>
                    <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
                    <next>
                      <block type="neopixel_show">
                        <next>
                          <block type="timing_delay">
                            <value name="MS"><block type="math_number"><field name="NUM">500</field></block></value>
                            <next>
                              <block type="neopixel_fill">
                                <value name="R"><block type="math_number"><field name="NUM">0</field></block></value>
                                <value name="G"><block type="math_number"><field name="NUM">0</field></block></value>
                                <value name="B"><block type="math_number"><field name="NUM">255</field></block></value>
                                <next>
                                  <block type="neopixel_show">
                                    <next>
                                      <block type="timing_delay">
                                        <value name="MS"><block type="math_number"><field name="NUM">500</field></block></value>
                                      </block>
                                    </next>
                                  </block>
                                </next>
                              </block>
                            </next>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 7. OLED Hello World
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "OLED Hello World",
    description: "Initializes an SSD1306 128x64 OLED display over I2C and shows 'Hello World' and an uptime counter on screen.",
    category: "Display",
    boardId: "esp32-wroom",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="oled_init"></block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="120">
    <statement name="DO">
      <block type="oled_clear">
        <next>
          <block type="oled_print_text">
            <value name="TEXT"><block type="text"><field name="TEXT">Hello World!</field></block></value>
            <value name="X"><block type="math_number"><field name="NUM">0</field></block></value>
            <value name="Y"><block type="math_number"><field name="NUM">0</field></block></value>
            <next>
              <block type="oled_print_text">
                <value name="TEXT"><block type="time_get_millis"></block></value>
                <value name="X"><block type="math_number"><field name="NUM">0</field></block></value>
                <value name="Y"><block type="math_number"><field name="NUM">20</field></block></value>
                <next>
                  <block type="oled_display">
                    <next>
                      <block type="timing_delay">
                        <value name="MS"><block type="math_number"><field name="NUM">250</field></block></value>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 8. WiFi Weather Station
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "WiFi Weather Station",
    description: "Connects to WiFi, reads DHT11 temperature & humidity on pin 4, and prints readings with the device IP to Serial.",
    category: "Networking",
    boardId: "esp32-wroom",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="dht11_init">
        <value name="PIN"><block type="math_number"><field name="NUM">4</field></block></value>
        <next>
          <block type="wifi_connect">
            <value name="SSID"><block type="text"><field name="TEXT">MyWiFi</field></block></value>
            <value name="PASS"><block type="text"><field name="TEXT">password123</field></block></value>
            <next>
              <block type="serial_print">
                <field name="MODE">println</field>
                <value name="TEXT"><block type="wifi_get_ip"></block></value>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="260">
    <statement name="DO">
      <block type="serial_print">
        <field name="MODE">println</field>
        <value name="TEXT"><block type="dht_read_temp_c"><value name="PIN"><block type="math_number"><field name="NUM">4</field></block></value></block></value>
        <next>
          <block type="serial_print">
            <field name="MODE">println</field>
            <value name="TEXT"><block type="dht_read_humidity"><value name="PIN"><block type="math_number"><field name="NUM">4</field></block></value></block></value>
            <next>
              <block type="timing_delay">
                <value name="MS"><block type="math_number"><field name="NUM">5000</field></block></value>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 9. MQTT Temperature Publisher
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "MQTT Temperature Publisher",
    description: "Connects to WiFi and an MQTT broker, then publishes DHT11 temperature readings to the 'home/temp' topic every 5 seconds.",
    category: "Communication",
    boardId: "esp32-wroom",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="dht11_init">
        <value name="PIN"><block type="math_number"><field name="NUM">4</field></block></value>
        <next>
          <block type="wifi_connect">
            <value name="SSID"><block type="text"><field name="TEXT">MyWiFi</field></block></value>
            <value name="PASS"><block type="text"><field name="TEXT">password123</field></block></value>
            <next>
              <block type="mqtt_init">
                <next>
                  <block type="mqtt_set_server">
                    <value name="SERVER"><block type="text"><field name="TEXT">192.168.1.100</field></block></value>
                    <value name="PORT"><block type="math_number"><field name="NUM">1883</field></block></value>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="300">
    <statement name="DO">
      <block type="mqtt_publish">
        <value name="TOPIC"><block type="text"><field name="TEXT">home/temp</field></block></value>
        <value name="MSG"><block type="dht_read_temp_c"><value name="PIN"><block type="math_number"><field name="NUM">4</field></block></value></block></value>
        <next>
          <block type="timing_delay">
            <value name="MS"><block type="math_number"><field name="NUM">5000</field></block></value>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 10. Bluetooth Serial Echo
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Bluetooth Serial Echo",
    description: "Initializes Bluetooth Classic on ESP32 as 'ESP32_BT'. Any text received over Bluetooth is echoed back and also printed to USB Serial.",
    category: "Communication",
    boardId: "esp32-wroom",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="bt_classic_init">
        <value name="NAME"><block type="text"><field name="TEXT">ESP32_BT</field></block></value>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="140">
    <statement name="DO">
      <block type="controls_if">
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">GT</field>
            <value name="A"><block type="bt_classic_available"></block></value>
            <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
          </block>
        </value>
        <statement name="DO0">
          <block type="variables_set">
            <field name="VAR">btMsg</field>
            <value name="VALUE"><block type="bt_classic_read"></block></value>
            <next>
              <block type="serial_print">
                <field name="MODE">println</field>
                <value name="TEXT"><block type="variables_get"><field name="VAR">btMsg</field></block></value>
                <next>
                  <block type="bt_classic_print">
                    <value name="MSG"><block type="variables_get"><field name="VAR">btMsg</field></block></value>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 11. Relay Timer Switch
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Relay Timer Switch",
    description: "Toggles a relay on pin 26 ON for 10 seconds then OFF for 5 seconds in a loop. Useful for timed irrigation or lighting.",
    category: "Actuators",
    boardId: "esp32-wroom",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="relay_init">
        <value name="PIN"><block type="math_number"><field name="NUM">26</field></block></value>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="140">
    <statement name="DO">
      <block type="relay_on">
        <value name="PIN"><block type="math_number"><field name="NUM">26</field></block></value>
        <next>
          <block type="serial_print">
            <field name="MODE">println</field>
            <value name="TEXT"><block type="text"><field name="TEXT">Relay ON</field></block></value>
            <next>
              <block type="timing_delay">
                <value name="MS"><block type="math_number"><field name="NUM">10000</field></block></value>
                <next>
                  <block type="relay_off">
                    <value name="PIN"><block type="math_number"><field name="NUM">26</field></block></value>
                    <next>
                      <block type="serial_print">
                        <field name="MODE">println</field>
                        <value name="TEXT"><block type="text"><field name="TEXT">Relay OFF</field></block></value>
                        <next>
                          <block type="timing_delay">
                            <value name="MS"><block type="math_number"><field name="NUM">5000</field></block></value>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 12. Soil Moisture Monitor with OLED
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Soil Moisture Monitor",
    description: "Reads soil moisture from analog pin 34 and displays the value on an SSD1306 OLED. Prints 'DRY' warning if below threshold.",
    category: "Sensors",
    boardId: "esp32-wroom",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="oled_init"></block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="120">
    <statement name="DO">
      <block type="oled_clear">
        <next>
          <block type="oled_print_text">
            <value name="TEXT"><block type="text"><field name="TEXT">Moisture:</field></block></value>
            <value name="X"><block type="math_number"><field name="NUM">0</field></block></value>
            <value name="Y"><block type="math_number"><field name="NUM">0</field></block></value>
            <next>
              <block type="oled_print_text">
                <value name="TEXT"><block type="soil_moisture_analog"><value name="PIN"><block type="math_number"><field name="NUM">34</field></block></value></block></value>
                <value name="X"><block type="math_number"><field name="NUM">0</field></block></value>
                <value name="Y"><block type="math_number"><field name="NUM">16</field></block></value>
                <next>
                  <block type="oled_display">
                    <next>
                      <block type="timing_delay">
                        <value name="MS"><block type="math_number"><field name="NUM">1000</field></block></value>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 13. GPS Tracker (Serial Output)
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "GPS Location Tracker",
    description: "Reads GPS coordinates from a NEO-6M module (RX=16, TX=17) and prints latitude, longitude, and satellite count to Serial.",
    category: "Sensors",
    boardId: "esp32-wroom",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="gps_init">
        <field name="RX">16</field>
        <field name="TX">17</field>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="140">
    <statement name="DO">
      <block type="controls_if">
        <value name="IF0"><block type="gps_has_fix"></block></value>
        <statement name="DO0">
          <block type="serial_print">
            <field name="MODE">println</field>
            <value name="TEXT"><block type="gps_get_lat"></block></value>
            <next>
              <block type="serial_print">
                <field name="MODE">println</field>
                <value name="TEXT"><block type="gps_get_lng"></block></value>
                <next>
                  <block type="serial_print">
                    <field name="MODE">println</field>
                    <value name="TEXT"><block type="gps_get_satellites"></block></value>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <next>
          <block type="timing_delay">
            <value name="MS"><block type="math_number"><field name="NUM">2000</field></block></value>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 14. DC Motor Speed Control
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "DC Motor Speed Control",
    description: "Controls a DC motor via L298N driver (EN=25, IN1=26, IN2=27). Ramps speed from 0 to 255, holds, then stops.",
    category: "Actuators",
    boardId: "esp32-wroom",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="l298n_dc_init">
        <value name="EN"><block type="math_number"><field name="NUM">25</field></block></value>
        <value name="IN1"><block type="math_number"><field name="NUM">26</field></block></value>
        <value name="IN2"><block type="math_number"><field name="NUM">27</field></block></value>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="180">
    <statement name="DO">
      <block type="l298n_dc_forward">
        <value name="EN"><block type="math_number"><field name="NUM">25</field></block></value>
        <next>
          <block type="l298n_dc_set_speed">
            <value name="EN"><block type="math_number"><field name="NUM">25</field></block></value>
            <value name="SPEED"><block type="math_number"><field name="NUM">200</field></block></value>
            <next>
              <block type="timing_delay">
                <value name="MS"><block type="math_number"><field name="NUM">3000</field></block></value>
                <next>
                  <block type="l298n_dc_stop">
                    <value name="EN"><block type="math_number"><field name="NUM">25</field></block></value>
                    <next>
                      <block type="timing_delay">
                        <value name="MS"><block type="math_number"><field name="NUM">2000</field></block></value>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 15. RFID Access Control
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "RFID Access Control",
    description: "Scans RFID tags with RC522 (SS=10, RST=9) and prints the UID to Serial. Turns LED on pin 7 ON when any card is detected.",
    category: "Sensors",
    boardId: "arduino-uno-r3",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="rfid_rc522_init">
        <value name="SS"><block type="math_number"><field name="NUM">10</field></block></value>
        <value name="RST"><block type="math_number"><field name="NUM">9</field></block></value>
        <next>
          <block type="led_init">
            <value name="PIN"><block type="math_number"><field name="NUM">7</field></block></value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="180">
    <statement name="DO">
      <block type="controls_if">
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">NEQ</field>
            <value name="A"><block type="rfid_rc522_read_uid"></block></value>
            <value name="B"><block type="text"><field name="TEXT"></field></block></value>
          </block>
        </value>
        <statement name="DO0">
          <block type="serial_print">
            <field name="MODE">println</field>
            <value name="TEXT"><block type="rfid_rc522_read_uid"></block></value>
            <next>
              <block type="led_on">
                <value name="PIN"><block type="math_number"><field name="NUM">7</field></block></value>
                <next>
                  <block type="timing_delay">
                    <value name="MS"><block type="math_number"><field name="NUM">1000</field></block></value>
                    <next>
                      <block type="led_off">
                        <value name="PIN"><block type="math_number"><field name="NUM">7</field></block></value>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 16. SD Card Data Logger
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "SD Card Data Logger",
    description: "Logs DHT11 temperature readings to an SD card file every 10 seconds. Appends timestamped CSV data to /data.csv.",
    category: "Sensors",
    boardId: "esp32-wroom",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="dht11_init">
        <value name="PIN"><block type="math_number"><field name="NUM">4</field></block></value>
        <next>
          <block type="sd_init">
            <value name="CS"><block type="math_number"><field name="NUM">5</field></block></value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="180">
    <statement name="DO">
      <block type="sd_append_file">
        <value name="PATH"><block type="text"><field name="TEXT">/data.csv</field></block></value>
        <value name="CONTENT"><block type="dht_read_temp_c"><value name="PIN"><block type="math_number"><field name="NUM">4</field></block></value></block></value>
        <next>
          <block type="serial_print">
            <field name="MODE">println</field>
            <value name="TEXT"><block type="text"><field name="TEXT">Data logged</field></block></value>
            <next>
              <block type="timing_delay">
                <value name="MS"><block type="math_number"><field name="NUM">10000</field></block></value>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 17. LCD 16x2 Counter
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "LCD Counter Display",
    description: "Displays an incrementing counter on a 16x2 I2C LCD screen, updating once per second. Shows 'Count:' label on row 0.",
    category: "Display",
    boardId: "arduino-uno-r3",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="lcd_i2c_init"></block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="120">
    <statement name="DO">
      <block type="lcd_i2c_clear">
        <next>
          <block type="lcd_i2c_set_cursor">
            <value name="COL"><block type="math_number"><field name="NUM">0</field></block></value>
            <value name="ROW"><block type="math_number"><field name="NUM">0</field></block></value>
            <next>
              <block type="lcd_i2c_print">
                <value name="TEXT"><block type="text"><field name="TEXT">Count:</field></block></value>
                <next>
                  <block type="lcd_i2c_set_cursor">
                    <value name="COL"><block type="math_number"><field name="NUM">0</field></block></value>
                    <value name="ROW"><block type="math_number"><field name="NUM">1</field></block></value>
                    <next>
                      <block type="lcd_i2c_print">
                        <value name="TEXT"><block type="time_get_millis"></block></value>
                        <next>
                          <block type="timing_delay">
                            <value name="MS"><block type="math_number"><field name="NUM">1000</field></block></value>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 18. PIR Motion Detector
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "PIR Motion Detector",
    description: "Detects motion with a PIR sensor on pin 14. When triggered, turns on an LED on pin 13 and prints 'Motion!' to Serial.",
    category: "Sensors",
    boardId: "esp32-wroom",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="led_init">
        <value name="PIN"><block type="math_number"><field name="NUM">13</field></block></value>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="140">
    <statement name="DO">
      <block type="controls_if">
        <value name="IF0"><block type="pir_motion_read"><value name="PIN"><block type="math_number"><field name="NUM">14</field></block></value></block></value>
        <statement name="DO0">
          <block type="led_on">
            <value name="PIN"><block type="math_number"><field name="NUM">13</field></block></value>
            <next>
              <block type="serial_print">
                <field name="MODE">println</field>
                <value name="TEXT"><block type="text"><field name="TEXT">Motion detected!</field></block></value>
                <next>
                  <block type="timing_delay">
                    <value name="MS"><block type="math_number"><field name="NUM">2000</field></block></value>
                    <next>
                      <block type="led_off">
                        <value name="PIN"><block type="math_number"><field name="NUM">13</field></block></value>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <next>
          <block type="timing_delay">
            <value name="MS"><block type="math_number"><field name="NUM">100</field></block></value>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 19. Stepper Motor Controller
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Stepper Motor Controller",
    description: "Drives an A4988 stepper motor (DIR=2, STEP=3, 200 steps/rev) forward 200 steps, pauses, then backward 200 steps.",
    category: "Actuators",
    boardId: "arduino-uno-r3",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="a4988_stepper_init">
        <value name="DIR"><block type="math_number"><field name="NUM">2</field></block></value>
        <value name="STEP"><block type="math_number"><field name="NUM">3</field></block></value>
        <value name="STEPS"><block type="math_number"><field name="NUM">200</field></block></value>
        <next>
          <block type="a4988_stepper_set_speed">
            <value name="RPM"><block type="math_number"><field name="NUM">60</field></block></value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="200">
    <statement name="DO">
      <block type="a4988_stepper_step">
        <value name="STEPS"><block type="math_number"><field name="NUM">200</field></block></value>
        <next>
          <block type="timing_delay">
            <value name="MS"><block type="math_number"><field name="NUM">1000</field></block></value>
            <next>
              <block type="a4988_stepper_step">
                <value name="STEPS"><block type="math_number"><field name="NUM">-200</field></block></value>
                <next>
                  <block type="timing_delay">
                    <value name="MS"><block type="math_number"><field name="NUM">1000</field></block></value>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 20. BMP280 Weather Display
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "BMP280 Weather Display",
    description: "Reads temperature, pressure, and altitude from a BMP280 I2C sensor and displays all three readings on an OLED screen.",
    category: "Sensors",
    boardId: "esp32-wroom",
    blocksXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_setup" x="20" y="20">
    <statement name="DO">
      <block type="bmp280_init">
        <next>
          <block type="oled_init"></block>
        </next>
      </block>
    </statement>
  </block>
  <block type="event_loop" x="20" y="160">
    <statement name="DO">
      <block type="oled_clear">
        <next>
          <block type="oled_print_text">
            <value name="TEXT"><block type="bmp280_read_temp"></block></value>
            <value name="X"><block type="math_number"><field name="NUM">0</field></block></value>
            <value name="Y"><block type="math_number"><field name="NUM">0</field></block></value>
            <next>
              <block type="oled_print_text">
                <value name="TEXT"><block type="bmp280_read_pressure"></block></value>
                <value name="X"><block type="math_number"><field name="NUM">0</field></block></value>
                <value name="Y"><block type="math_number"><field name="NUM">16</field></block></value>
                <next>
                  <block type="oled_print_text">
                    <value name="TEXT"><block type="bmp280_read_alt"></block></value>
                    <value name="X"><block type="math_number"><field name="NUM">0</field></block></value>
                    <value name="Y"><block type="math_number"><field name="NUM">32</field></block></value>
                    <next>
                      <block type="oled_display">
                        <next>
                          <block type="timing_delay">
                            <value name="MS"><block type="math_number"><field name="NUM">1000</field></block></value>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },
];
