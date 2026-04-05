import { compiler } from "../compiler/assembler";

export function defineDisplayBlocks(Blockly: any) {
  const generator = Blockly.JavaScript || Blockly.javascriptGenerator;

  // OLED SSD1306
  Blockly.Blocks["display_oled_print"] = {
    init() {
      this.appendValueInput("TEXT").appendField("OLED print");
      this.appendDummyInput().appendField("at X:").appendField(new Blockly.FieldNumber(0), "X")
                             .appendField("Y:").appendField(new Blockly.FieldNumber(0), "Y");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#3182CE");
    }
  };

  if (generator) {
    generator.forBlock["display_oled_print"] = function(block: any, generator: any) {
      let text = generator.valueToCode(block, 'TEXT', generator.ORDER_ATOMIC) || '""';
      const x = block.getFieldValue("X");
      const y = block.getFieldValue("Y");
      
      if (text.startsWith("'") && text.endsWith("'")) {
         text = compiler.wrapString(text.slice(1, -1));
      }

      compiler.addInclude(`#include <Wire.h>`);
      compiler.addInclude(`#include <Adafruit_GFX.h>`);
      compiler.addInclude(`#include <Adafruit_SSD1306.h>`);
      compiler.addGlobal(`#define SCREEN_WIDTH 128\n#define SCREEN_HEIGHT 64\nAdafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);`);
      compiler.addSetup(`if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {\n    Serial.println(F("SSD1306 allocation failed"));\n    for(;;);\n  }`);
      compiler.addSetup(`display.clearDisplay();`);
      compiler.addSetup(`display.setTextColor(WHITE);`);

      return `display.setCursor(${x}, ${y});\ndisplay.print(${text});\ndisplay.display();\n`;
    };
  }
}

export function getDisplayCategory() {
  return {
    kind: "category", name: "Displays",
    contents: [
      { kind: "block", type: "display_oled_print" },
    ]
  };
}
