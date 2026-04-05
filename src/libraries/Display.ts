import { compiler } from "../compiler/assembler";

export function defineDisplayBlocks(Blockly: any) {
  const generator = Blockly.JavaScript || Blockly.javascriptGenerator;

  // -- BASE LEDs (5) --
  Blockly.Blocks["led_init"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Init LED on pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["led_on"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("LED ON pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["led_off"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("LED OFF pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["led_toggle"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("LED Toggle pin state"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["led_pwm_brightness"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("LED Set Brightness (PWM) pin"); this.appendValueInput("VAL").setCheck("Number").appendField("val(0-255)"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#3182CE"); }
  };

  // -- RGB LEDs Analog (2) --
  Blockly.Blocks["rgb_led_init"] = {
    init() { this.appendDummyInput().appendField("Init RGB Analog LED"); this.appendValueInput("R").setCheck("Number").appendField("R pin"); this.appendValueInput("G").setCheck("Number").appendField("G pin"); this.appendValueInput("B").setCheck("Number").appendField("B pin"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#805AD5"); }
  };
  Blockly.Blocks["rgb_led_set_color"] = {
    init() { this.appendDummyInput().appendField("Set RGB Color"); this.appendValueInput("R").setCheck("Number").appendField("R (0-255)"); this.appendValueInput("G").setCheck("Number").appendField("G"); this.appendValueInput("B").setCheck("Number").appendField("B"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#805AD5"); }
  };

  // -- NEOPIXELS (6) --
  Blockly.Blocks["neopixel_init"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Init NeoPixels on pin"); this.appendValueInput("COUNT").setCheck("Number").appendField("Count"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#B794F4"); }
  };
  Blockly.Blocks["neopixel_set_pixel"] = {
    init() { this.appendValueInput("IDX").setCheck("Number").appendField("NeoPixel Set Pixel"); this.appendDummyInput().appendField("to RGB("); this.appendValueInput("R").setCheck("Number"); this.appendValueInput("G").setCheck("Number").appendField(","); this.appendValueInput("B").setCheck("Number").appendField(","); this.appendDummyInput().appendField(")"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#B794F4"); }
  };
  Blockly.Blocks["neopixel_show"] = {
    init() { this.appendDummyInput().appendField("NeoPixel Show"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#B794F4"); }
  };
  Blockly.Blocks["neopixel_clear"] = {
    init() { this.appendDummyInput().appendField("NeoPixel Clear"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#B794F4"); }
  };
  Blockly.Blocks["neopixel_fill"] = {
    init() { this.appendDummyInput().appendField("NeoPixel Fill All"); this.appendDummyInput().appendField("RGB("); this.appendValueInput("R").setCheck("Number"); this.appendValueInput("G").setCheck("Number").appendField(","); this.appendValueInput("B").setCheck("Number").appendField(","); this.appendDummyInput().appendField(")"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#B794F4"); }
  };
  Blockly.Blocks["neopixel_set_brightness"] = {
    init() { this.appendValueInput("VAL").setCheck("Number").appendField("NeoPixel Set Global Brightness (0-255)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#B794F4"); }
  };

  // -- OLED SSD1306 (10) --
  Blockly.Blocks["oled_init"] = {
    init() { this.appendDummyInput().appendField("Init OLED (SSD1306, 128x64 I2C)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };
  Blockly.Blocks["oled_clear"] = {
    init() { this.appendDummyInput().appendField("OLED Clear Local Buffer"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };
  Blockly.Blocks["oled_print_text"] = {
    init() { this.appendValueInput("TEXT").setCheck("String").appendField("OLED Print Text"); this.appendValueInput("X").setCheck("Number").appendField("X"); this.appendValueInput("Y").setCheck("Number").appendField("Y"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };
  Blockly.Blocks["oled_draw_pixel"] = {
    init() { this.appendDummyInput().appendField("OLED Draw Pixel"); this.appendValueInput("X").setCheck("Number").appendField("X"); this.appendValueInput("Y").setCheck("Number").appendField("Y"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };
  Blockly.Blocks["oled_draw_rect"] = {
    init() { this.appendDummyInput().appendField("OLED Draw Rect"); this.appendValueInput("X").setCheck("Number").appendField("X"); this.appendValueInput("Y").setCheck("Number").appendField("Y"); this.appendValueInput("W").setCheck("Number").appendField("W"); this.appendValueInput("H").setCheck("Number").appendField("H"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };
  Blockly.Blocks["oled_fill_rect"] = {
    init() { this.appendDummyInput().appendField("OLED Fill Rect"); this.appendValueInput("X").setCheck("Number").appendField("X"); this.appendValueInput("Y").setCheck("Number").appendField("Y"); this.appendValueInput("W").setCheck("Number").appendField("W"); this.appendValueInput("H").setCheck("Number").appendField("H"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };
  Blockly.Blocks["oled_draw_circle"] = {
    init() { this.appendDummyInput().appendField("OLED Draw Circle"); this.appendValueInput("X").setCheck("Number").appendField("X"); this.appendValueInput("Y").setCheck("Number").appendField("Y"); this.appendValueInput("R").setCheck("Number").appendField("R"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };
  Blockly.Blocks["oled_fill_circle"] = {
    init() { this.appendDummyInput().appendField("OLED Fill Circle"); this.appendValueInput("X").setCheck("Number").appendField("X"); this.appendValueInput("Y").setCheck("Number").appendField("Y"); this.appendValueInput("R").setCheck("Number").appendField("R"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };
  Blockly.Blocks["oled_draw_line"] = {
    init() { this.appendDummyInput().appendField("OLED Draw Line"); this.appendValueInput("X0").setCheck("Number").appendField("X0"); this.appendValueInput("Y0").setCheck("Number").appendField("Y0"); this.appendValueInput("X1").setCheck("Number").appendField("X1"); this.appendValueInput("Y1").setCheck("Number").appendField("Y1"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };
  Blockly.Blocks["oled_display"] = {
    init() { this.appendDummyInput().appendField("OLED Display Buffer to Screen"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };

  // -- LCD I2C 16x2 (4) --
  Blockly.Blocks["lcd_i2c_init"] = {
    init() { this.appendDummyInput().appendField("Init LCD 16x2 (I2C 0x27)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2B6CB0"); }
  };
  Blockly.Blocks["lcd_i2c_print"] = {
    init() { this.appendValueInput("TEXT").setCheck("String").appendField("LCD Print String"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2B6CB0"); }
  };
  Blockly.Blocks["lcd_i2c_clear"] = {
    init() { this.appendDummyInput().appendField("LCD Clear"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2B6CB0"); }
  };
  Blockly.Blocks["lcd_i2c_set_cursor"] = {
    init() { this.appendValueInput("COL").setCheck("Number").appendField("LCD Set Cursor Col"); this.appendValueInput("ROW").setCheck("Number").appendField("Row"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2B6CB0"); }
  };

  // -- MATRIX MAX7219 (3) --
  Blockly.Blocks["matrix8x8_init"] = {
    init() { this.appendDummyInput().appendField("Init 8x8 LED Matrix (MAX7219)"); this.appendValueInput("DIN").setCheck("Number").appendField("DIN"); this.appendValueInput("CLK").setCheck("Number").appendField("CLK"); this.appendValueInput("CS").setCheck("Number").appendField("CS"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#1A365D"); }
  };
  Blockly.Blocks["matrix8x8_set_pixel"] = {
    init() { this.appendDummyInput().appendField("Matrix Set Pixel"); this.appendValueInput("X").setCheck("Number").appendField("X"); this.appendValueInput("Y").setCheck("Number").appendField("Y"); this.appendValueInput("STATE").setCheck("Boolean").appendField("State (ON/OFF)"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#1A365D"); }
  };
  Blockly.Blocks["matrix8x8_clear"] = {
    init() { this.appendDummyInput().appendField("Matrix Clear"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#1A365D"); }
  };

  if (generator) {
    // LEDs
    generator.forBlock["led_init"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '13';
      compiler.addSetup(`pinMode(${pin}, OUTPUT);`);
      return "";
    };
    generator.forBlock["led_on"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '13';
      return `digitalWrite(${pin}, HIGH);\n`;
    };
    generator.forBlock["led_off"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '13';
      return `digitalWrite(${pin}, LOW);\n`;
    };
    generator.forBlock["led_toggle"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '13';
      return `digitalWrite(${pin}, !digitalRead(${pin}));\n`;
    };
    generator.forBlock["led_pwm_brightness"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '9';
      const val = generator.valueToCode(block, 'VAL', generator.ORDER_ATOMIC) || '128';
      return `analogWrite(${pin}, ${val});\n`;
    };

    // RGB Analog
    generator.forBlock["rgb_led_init"] = function(block: any, generator: any) {
       const r = generator.valueToCode(block, 'R', generator.ORDER_ATOMIC) || '3';
       const g = generator.valueToCode(block, 'G', generator.ORDER_ATOMIC) || '5';
       const b = generator.valueToCode(block, 'B', generator.ORDER_ATOMIC) || '6';
       compiler.addSetup(`pinMode(${r}, OUTPUT);\npinMode(${g}, OUTPUT);\npinMode(${b}, OUTPUT);`);
       compiler.addGlobal(`int r_pin = ${r};\nint g_pin = ${g};\nint b_pin = ${b};`);
       return "";
    };
    generator.forBlock["rgb_led_set_color"] = function(block: any, generator: any) {
       const r = generator.valueToCode(block, 'R', generator.ORDER_ATOMIC) || '255';
       const g = generator.valueToCode(block, 'G', generator.ORDER_ATOMIC) || '0';
       const b = generator.valueToCode(block, 'B', generator.ORDER_ATOMIC) || '0';
       return `analogWrite(r_pin, ${r});\nanalogWrite(g_pin, ${g});\nanalogWrite(b_pin, ${b});\n`;
    };

    // NeoPixels
    generator.forBlock["neopixel_init"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '6';
      const cnt = generator.valueToCode(block, 'COUNT', generator.ORDER_ATOMIC) || '10';
      compiler.addInclude(`#include <Adafruit_NeoPixel.h>`);
      compiler.addGlobal(`Adafruit_NeoPixel strip(${cnt}, ${pin}, NEO_GRB + NEO_KHZ800);`);
      compiler.addSetup(`strip.begin();\nstrip.show();`);
      return "";
    };
    generator.forBlock["neopixel_set_pixel"] = function(block: any, generator: any) {
      const i = generator.valueToCode(block, 'IDX', generator.ORDER_ATOMIC) || '0';
      const r = generator.valueToCode(block, 'R', generator.ORDER_ATOMIC) || '0';
      const g = generator.valueToCode(block, 'G', generator.ORDER_ATOMIC) || '0';
      const b = generator.valueToCode(block, 'B', generator.ORDER_ATOMIC) || '0';
      return `strip.setPixelColor(${i}, strip.Color(${r}, ${g}, ${b}));\n`;
    };
    generator.forBlock["neopixel_show"] = function() { return `strip.show();\n`; };
    generator.forBlock["neopixel_clear"] = function() { return `strip.clear();\n`; };
    generator.forBlock["neopixel_fill"] = function(block: any, generator: any) {
      const r = generator.valueToCode(block, 'R', generator.ORDER_ATOMIC) || '255';
      const g = generator.valueToCode(block, 'G', generator.ORDER_ATOMIC) || '255';
      const b = generator.valueToCode(block, 'B', generator.ORDER_ATOMIC) || '255';
      return `strip.fill(strip.Color(${r}, ${g}, ${b}), 0, strip.numPixels());\n`;
    };
    generator.forBlock["neopixel_set_brightness"] = function(block: any, generator: any) {
      const b = generator.valueToCode(block, 'VAL', generator.ORDER_ATOMIC) || '50';
      return `strip.setBrightness(${b});\n`;
    };

    // OLED SSD1306
    generator.forBlock["oled_init"] = function() {
      compiler.addInclude(`#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>`);
      compiler.addGlobal(`Adafruit_SSD1306 display(128, 64, &Wire, -1);`);
      compiler.addSetup(`if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { Serial.println(F("OLED alloc fail")); }\ndisplay.clearDisplay();`);
      return "";
    };
    generator.forBlock["oled_clear"] = function() { return `display.clearDisplay();\n`; };
    generator.forBlock["oled_print_text"] = function(block: any, generator: any) {
      const txt = generator.valueToCode(block, 'TEXT', generator.ORDER_ATOMIC) || '""';
      const x = generator.valueToCode(block, 'X', generator.ORDER_ATOMIC) || '0';
      const y = generator.valueToCode(block, 'Y', generator.ORDER_ATOMIC) || '0';
      return `display.setCursor(${x}, ${y});\ndisplay.setTextColor(WHITE);\ndisplay.print(${txt});\n`;
    };
    generator.forBlock["oled_draw_pixel"] = function(block: any, generator: any) {
      const x = generator.valueToCode(block, 'X', generator.ORDER_ATOMIC) || '0';
      const y = generator.valueToCode(block, 'Y', generator.ORDER_ATOMIC) || '0';
      return `display.drawPixel(${x}, ${y}, WHITE);\n`;
    };
    generator.forBlock["oled_draw_rect"] = function(block: any, generator: any) {
      const x = generator.valueToCode(block, 'X', generator.ORDER_ATOMIC) || '0';
      const y = generator.valueToCode(block, 'Y', generator.ORDER_ATOMIC) || '0';
      const w = generator.valueToCode(block, 'W', generator.ORDER_ATOMIC) || '10';
      const h = generator.valueToCode(block, 'H', generator.ORDER_ATOMIC) || '10';
      return `display.drawRect(${x}, ${y}, ${w}, ${h}, WHITE);\n`;
    };
    generator.forBlock["oled_fill_rect"] = function(block: any, generator: any) {
      const x = generator.valueToCode(block, 'X', generator.ORDER_ATOMIC) || '0';
      const y = generator.valueToCode(block, 'Y', generator.ORDER_ATOMIC) || '0';
      const w = generator.valueToCode(block, 'W', generator.ORDER_ATOMIC) || '10';
      const h = generator.valueToCode(block, 'H', generator.ORDER_ATOMIC) || '10';
      return `display.fillRect(${x}, ${y}, ${w}, ${h}, WHITE);\n`;
    };
    generator.forBlock["oled_draw_circle"] = function(block: any, generator: any) {
      const x = generator.valueToCode(block, 'X', generator.ORDER_ATOMIC) || '0';
      const y = generator.valueToCode(block, 'Y', generator.ORDER_ATOMIC) || '0';
      const r = generator.valueToCode(block, 'R', generator.ORDER_ATOMIC) || '10';
      return `display.drawCircle(${x}, ${y}, ${r}, WHITE);\n`;
    };
    generator.forBlock["oled_fill_circle"] = function(block: any, generator: any) {
      const x = generator.valueToCode(block, 'X', generator.ORDER_ATOMIC) || '0';
      const y = generator.valueToCode(block, 'Y', generator.ORDER_ATOMIC) || '0';
      const r = generator.valueToCode(block, 'R', generator.ORDER_ATOMIC) || '10';
      return `display.fillCircle(${x}, ${y}, ${r}, WHITE);\n`;
    };
    generator.forBlock["oled_draw_line"] = function(block: any, generator: any) {
      const x0 = generator.valueToCode(block, 'X0', generator.ORDER_ATOMIC) || '0';
      const y0 = generator.valueToCode(block, 'Y0', generator.ORDER_ATOMIC) || '0';
      const x1 = generator.valueToCode(block, 'X1', generator.ORDER_ATOMIC) || '10';
      const y1 = generator.valueToCode(block, 'Y1', generator.ORDER_ATOMIC) || '10';
      return `display.drawLine(${x0}, ${y0}, ${x1}, ${y1}, WHITE);\n`;
    };
    generator.forBlock["oled_display"] = function() { return `display.display();\n`; };

    // LCD 16x2
    generator.forBlock["lcd_i2c_init"] = function() {
      compiler.addInclude(`#include <Wire.h>\n#include <LiquidCrystal_I2C.h>`);
      compiler.addGlobal(`LiquidCrystal_I2C lcdcast(0x27, 16, 2);`);
      compiler.addSetup(`lcdcast.init();\nlcdcast.backlight();`);
      return "";
    };
    generator.forBlock["lcd_i2c_print"] = function(block: any, generator: any) {
      const txt = generator.valueToCode(block, 'TEXT', generator.ORDER_ATOMIC) || '""';
      return `lcdcast.print(${txt});\n`;
    };
    generator.forBlock["lcd_i2c_clear"] = function() { return `lcdcast.clear();\n`; };
    generator.forBlock["lcd_i2c_set_cursor"] = function(block: any, generator: any) {
      const c = generator.valueToCode(block, 'COL', generator.ORDER_ATOMIC) || '0';
      const r = generator.valueToCode(block, 'ROW', generator.ORDER_ATOMIC) || '0';
      return `lcdcast.setCursor(${c}, ${r});\n`;
    };

    // Matrix MAX7219
    generator.forBlock["matrix8x8_init"] = function(block: any, generator: any) {
      const din = generator.valueToCode(block, 'DIN', generator.ORDER_ATOMIC) || '11';
      const clk = generator.valueToCode(block, 'CLK', generator.ORDER_ATOMIC) || '13';
      const cs = generator.valueToCode(block, 'CS', generator.ORDER_ATOMIC) || '10';
      compiler.addInclude(`#include <LedControl.h>`);
      compiler.addGlobal(`LedControl mtx = LedControl(${din}, ${clk}, ${cs}, 1);`);
      compiler.addSetup(`mtx.shutdown(0, false);\nmtx.setIntensity(0, 8);\nmtx.clearDisplay(0);`);
      return "";
    };
    generator.forBlock["matrix8x8_set_pixel"] = function(block: any, generator: any) {
      const x = generator.valueToCode(block, 'X', generator.ORDER_ATOMIC) || '0';
      const y = generator.valueToCode(block, 'Y', generator.ORDER_ATOMIC) || '0';
      const s = generator.valueToCode(block, 'STATE', generator.ORDER_ATOMIC) || 'true';
      return `mtx.setLed(0, ${x}, ${y}, ${s});\n`;
    };
    generator.forBlock["matrix8x8_clear"] = function() { return `mtx.clearDisplay(0);\n`; };
  }
}

export function getDisplayCategory() {
  return {
    kind: "category", name: "Displays & Visuals",
    contents: [
      { kind: "label", text: "LED & Basic Lights" },
      { kind: "block", type: "led_init" },
      { kind: "block", type: "led_on" },
      { kind: "block", type: "led_off" },
      { kind: "block", type: "led_toggle" },
      { kind: "block", type: "led_pwm_brightness" },
      { kind: "block", type: "rgb_led_init" },
      { kind: "block", type: "rgb_led_set_color" },
      { kind: "label", text: "NeoPixels" },
      { kind: "block", type: "neopixel_init" },
      { kind: "block", type: "neopixel_set_pixel" },
      { kind: "block", type: "neopixel_show" },
      { kind: "block", type: "neopixel_clear" },
      { kind: "block", type: "neopixel_fill" },
      { kind: "block", type: "neopixel_set_brightness" },
      { kind: "label", text: "OLED Screen" },
      { kind: "block", type: "oled_init" },
      { kind: "block", type: "oled_clear" },
      { kind: "block", type: "oled_print_text" },
      { kind: "block", type: "oled_draw_pixel" },
      { kind: "block", type: "oled_draw_rect" },
      { kind: "block", type: "oled_fill_rect" },
      { kind: "block", type: "oled_draw_circle" },
      { kind: "block", type: "oled_fill_circle" },
      { kind: "block", type: "oled_draw_line" },
      { kind: "block", type: "oled_display" },
      { kind: "label", text: "LCD 16x2 I2C" },
      { kind: "block", type: "lcd_i2c_init" },
      { kind: "block", type: "lcd_i2c_print" },
      { kind: "block", type: "lcd_i2c_clear" },
      { kind: "block", type: "lcd_i2c_set_cursor" },
      { kind: "label", text: "8x8 Matrix" },
      { kind: "block", type: "matrix8x8_init" },
      { kind: "block", type: "matrix8x8_set_pixel" },
      { kind: "block", type: "matrix8x8_clear" }
    ]
  };
}
