import * as Blockly from "blockly";

const getFamilyPrefix = (type: string) => {
  if (type.startsWith('led_')) return 'led';
  if (type.startsWith('neopixel_')) return 'neopixel';
  if (type.startsWith('rgb_led_')) return 'rgb_led';
  if (type.startsWith('gpio_')) return 'gpio';
  if (type.startsWith('servo_')) return 'servo';
  if (type.startsWith('dht')) return 'dht';
  if (type.startsWith('hcsr04_')) return 'hcsr04';
  if (type.startsWith('l298n_')) return 'l298n';
  if (type.startsWith('a4988_')) return 'a4988';
  if (type.startsWith('ds18b20_')) return 'ds18b20';
  if (type.startsWith('rfid_')) return 'rfid';
  if (type.startsWith('hx711_')) return 'hx711';
  if (type.startsWith('tds_')) return 'tds';
  if (type.startsWith('oled_')) return 'oled';
  if (type.startsWith('lcd_')) return 'lcd';
  if (type.startsWith('matrix8x8_')) return 'matrix8x8';
  if (type.startsWith('tm1637_')) return 'tm1637';
  if (type.startsWith('relay_')) return 'relay';
  if (type.startsWith('solenoid_')) return 'solenoid';
  if (type.startsWith('vibration_')) return 'vibration';
  if (type.startsWith('water_pump_')) return 'water_pump';
  if (type.startsWith('gps_')) return 'gps';
  if (type.startsWith('mpu6050_')) return 'mpu6050';
  if (type.startsWith('mpu9250_')) return 'mpu9250';
  if (type.startsWith('vl53l0x_')) return 'vl53l0x';
  if (type.startsWith('bmp280_')) return 'bmp280';
  if (type.startsWith('mq')) return 'mq';
  if (type.startsWith('lora_')) return 'lora';
  if (type.startsWith('rs485_')) return 'rs485';
  if (type.startsWith('gsm_')) return 'gsm';
  if (type.startsWith('npk_')) return 'npk';
  if (type.startsWith('dfplayer_')) return 'dfplayer';
  if (type.startsWith('stepper_')) return 'stepper';
  if (type.startsWith('sd_')) return 'sd';
  if (type.startsWith('mqtt_')) return 'mqtt';
  if (type.startsWith('ble_')) return 'ble';
  if (type.startsWith('bt_')) return 'bt';
  return type; // Fallback to the specific block type if no generic family exists
};

export function validateWorkspace(workspace: Blockly.WorkspaceSvg): { errors: string[], warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pinRegistry = new Map<string, { blockId: string, blockType: string }>();

  // Use getAllBlocks(false) to get all blocks in a consistent order without forcing rendering
  const allBlocks = workspace.getAllBlocks(false);

  for (const block of allBlocks) {
    if (!block.isEnabled()) continue;

    // 1. Check INPUT_VALUE connections
    for (const input of block.inputList) {
      if ((input.type as any) === (Blockly.INPUT_VALUE as any)) {
        // Some inputs are optional, but if it has a 'required' flag (custom property) or is essential for most hardware blocks:
        // By default, if an input value is expected but has no connection, we should warn/error.
        // For hardware blocks, missing PIN inputs are fatal.
        if (!input.connection?.targetBlock()) {
          // Heuristic: If it's a hardware block and missing an input, it's an error.
          if (input.name === "PIN" || input.name === "TEXT" || input.name === "VALUE" || input.name === "MS" || input.name === "SS" || input.name === "RST" || input.name === "RX" || input.name === "TX") {
              const friendlyName = block.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
              errors.push(`The "${friendlyName}" block is missing a required connection for ${input.name}. Please connect a block to it.`);
          }
        }
      }
    }

    // 2. Check Fields (Dropdowns, Numbers, Texts)
    for (const field of block.inputList.flatMap(i => i.fieldRow)) {
      if (field instanceof Blockly.FieldNumber) {
        const val = field.getValue();
        if (val === '' || val === null || isNaN(Number(val))) {
           const friendlyName = block.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
           errors.push(`The "${friendlyName}" block has an empty number field. Please fill it in.`);
        }
      } else if (field instanceof Blockly.FieldDropdown) {
        const val = field.getValue();
        if (val === '' || val === null) {
           const friendlyName = block.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
           errors.push(`The "${friendlyName}" block has an unselected option. Please select an option from the dropdown.`);
        }
      }
    }

    // 3. Pin Registry Conflict Check
    // Attempt to extract pin from common pin fields
    let pinStr: string | null = null;
    
    // Check if the block has a PIN input and an attached math_number block
    for (const input of block.inputList) {
       if (input.name.includes("PIN") || input.name === "CS" || input.name === "SS" || input.name === "RX" || input.name === "TX" || input.name === "EN" || input.name === "IN1" || input.name === "IN2" || input.name === "STEP" || input.name === "DIR") {
           const target = input.connection?.targetBlock();
           if (target && target.type === "math_number") {
               pinStr = target.getFieldValue("NUM")?.toString();
           }
       }
    }

    // If no pin from input block, check if there's a PIN dropdown/field directly on the block
    if (!pinStr) {
        pinStr = block.getFieldValue("PIN")?.toString() || null;
    }

    if (pinStr && pinStr !== '' && pinStr !== '-1') {
      if (pinRegistry.has(pinStr)) {
        const existing = pinRegistry.get(pinStr)!;
        
        const existingFamily = getFamilyPrefix(existing.blockType);
        const newFamily = getFamilyPrefix(block.type);

        // Same family = same component = not a conflict
        if (existingFamily === newFamily) {
            continue; // Safely ignore, these are parts of the same component
        }

        // Ignore if it's the exact same block instance being evaluated again somehow
        if (existing.blockId !== block.id) {
           const friendlyName = block.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
           const friendlyExistingName = existing.blockType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
           errors.push(`Pin Conflict: Pin ${pinStr} is assigned to both the "${friendlyExistingName}" block and the "${friendlyName}" block. Each physical pin can only be connected to one component at a time.`);
        }
      } else {
        pinRegistry.set(pinStr, { blockId: block.id, blockType: block.type });
      }
    }
  }

  return { errors, warnings };
}
