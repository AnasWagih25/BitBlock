import { compiler } from "../compiler/assembler";
import { getBoardConfig } from "../boards/registry";

export function defineAudioMediaBlocks(Blockly: any) {
  const generator = Blockly.javascriptGenerator || Blockly.JavaScript;

  // ─── DFPlayer Mini (MP3) ──────────────────────────────────────────────────
  Blockly.Blocks["dfplayer_init"] = {
    init: function () {
      this.appendDummyInput().appendField("DFPlayer Init (MP3)");
      this.appendDummyInput().appendField("RX").appendField(new Blockly.FieldTextInput("16"), "RX").appendField("TX").appendField(new Blockly.FieldTextInput("17"), "TX");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#ED8936");
    },
  };
  if (generator) {
    generator.forBlock["dfplayer_init"] = function (block: any) {
      const rx = block.getFieldValue("RX");
      const tx = block.getFieldValue("TX");
      // @ts-ignore
      const bd = getBoardConfig(compiler.boardId);
      compiler.addInclude("#include <DFRobotDFPlayerMini.h>");
      if (bd.platform === "esp32") {
        compiler.addGlobal(`HardwareSerial mySoftwareSerial(1);\nDFRobotDFPlayerMini myDFPlayer;`);
        compiler.addSetup(`mySoftwareSerial.begin(9600, SERIAL_8N1, ${rx}, ${tx});`);
      } else {
        compiler.addInclude("#include <SoftwareSerial.h>");
        compiler.addGlobal(`SoftwareSerial mySoftwareSerial(${rx}, ${tx});\nDFRobotDFPlayerMini myDFPlayer;`);
        compiler.addSetup(`mySoftwareSerial.begin(9600);`);
      }
      compiler.addSetup(`if (!myDFPlayer.begin(mySoftwareSerial)) { Serial.println("DFPlayer error"); }`);
      compiler.addSetup(`myDFPlayer.volume(15);`);
      return "";
    };
  }

  Blockly.Blocks["dfplayer_play"] = {
    init: function () {
      this.appendValueInput("TRACK").setCheck("Number").appendField("DFPlayer Play Track #");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#ED8936");
    },
  };
  if (generator) {
    generator.forBlock["dfplayer_play"] = function (block: any) {
      const track = generator.valueToCode(block, "TRACK", 0) || "1";
      return `myDFPlayer.play(${track});\n`;
    };
  }

  Blockly.Blocks["dfplayer_volume"] = {
    init: function () {
      this.appendValueInput("VOL").setCheck("Number").appendField("DFPlayer Set Volume (0-30)");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#ED8936");
    },
  };
  if (generator) {
    generator.forBlock["dfplayer_volume"] = function (block: any) {
      const vol = generator.valueToCode(block, "VOL", 0) || "15";
      return `myDFPlayer.volume(${vol});\n`;
    };
  }

  Blockly.Blocks["dfplayer_next"] = {
    init: function () {
      this.appendDummyInput().appendField("DFPlayer Play Next");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#ED8936");
    },
  };
  if (generator) {
    generator.forBlock["dfplayer_next"] = function () {
      return `myDFPlayer.next();\n`;
    };
  }

  Blockly.Blocks["dfplayer_pause"] = {
    init: function () {
      this.appendDummyInput().appendField("DFPlayer Pause");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#ED8936");
    },
  };
  if (generator) {
    generator.forBlock["dfplayer_pause"] = function () {
      return `myDFPlayer.pause();\n`;
    };
  }

  // ─── I2S Microphone (INMP441) ─────────────────────────────────────────────
  Blockly.Blocks["i2s_mic_init"] = {
    init: function () {
      this.appendDummyInput().appendField("I2S Mic Init (INMP441)");
      this.appendDummyInput().appendField("WS").appendField(new Blockly.FieldTextInput("15"), "WS");
      this.appendDummyInput().appendField("SD").appendField(new Blockly.FieldTextInput("13"), "SD");
      this.appendDummyInput().appendField("SCK").appendField(new Blockly.FieldTextInput("2"), "SCK");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#DD6B20");
    },
  };
  if (generator) {
    generator.forBlock["i2s_mic_init"] = function (block: any) {
      const ws = block.getFieldValue("WS");
      const sd = block.getFieldValue("SD");
      const sck = block.getFieldValue("SCK");
      // @ts-ignore
      const bd = getBoardConfig(compiler.boardId);
      if (bd.platform !== "esp32") {
        return `Serial.println("I2S mic blocks are supported on ESP32 only");\n`;
      }
      compiler.addInclude("#include <driver/i2s.h>");
      compiler.addGlobal(`const i2s_port_t I2S_PORT = I2S_NUM_0;`);
      compiler.addSetup(`i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = 16000,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 4,
        .dma_buf_len = 1024,
        .use_apll = false,
        .tx_desc_auto_clear = false,
        .fixed_mclk = 0
      };
      i2s_pin_config_t pin_config = {
        .bck_io_num = ${sck},
        .ws_io_num = ${ws},
        .data_out_num = I2S_PIN_NO_CHANGE,
        .data_in_num = ${sd}
      };
      i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
      i2s_set_pin(I2S_PORT, &pin_config);`);
      compiler.addGlobal(`
int32_t readI2SSample() {
  int32_t sample = 0;
  size_t bytesRead = 0;
  esp_err_t res = i2s_read(I2S_PORT, &sample, sizeof(int32_t), &bytesRead, portMAX_DELAY);
  if (res == ESP_OK && bytesRead == sizeof(int32_t)) return (sample >> 14);
  return 0;
}`);
      return "";
    };
  }

  Blockly.Blocks["i2s_mic_read"] = {
    init: function () {
      this.appendDummyInput().appendField("I2S Mic Read Sample");
      this.setOutput(true, "Number");
      this.setColour("#DD6B20");
    },
  };
  if (generator) {
    generator.forBlock["i2s_mic_read"] = function () {
      return ["readI2SSample()", 0];
    };
  }

  // ─── Tone Advanced ────────────────────────────────────────────────────────
  Blockly.Blocks["tone_async"] = {
    init: function () {
      this.appendValueInput("PIN").setCheck("Number").appendField("Tone Async Pin");
      this.appendValueInput("FREQ").setCheck("Number").appendField("Frequency (Hz)");
      this.appendValueInput("DURATION").setCheck("Number").appendField("Duration (ms)");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#ED8936");
    },
  };
  if (generator) {
    generator.forBlock["tone_async"] = function (block: any) {
      const pin = generator.valueToCode(block, "PIN", 0) || "0";
      const freq = generator.valueToCode(block, "FREQ", 0) || "440";
      const duration = generator.valueToCode(block, "DURATION", 0) || "1000";
      return `tone(${pin}, ${freq}, ${duration});\n`;
    };
  }
}

export function getAudioMediaCategory() {
  return {
    kind: "category",
    name: "Audio & Media",
    contents: [
      { kind: "label", text: "DFPlayer Mini (MP3)" },
      { kind: "block", type: "dfplayer_init" },
      { kind: "block", type: "dfplayer_play" },
      { kind: "block", type: "dfplayer_volume" },
      { kind: "block", type: "dfplayer_next" },
      { kind: "block", type: "dfplayer_pause" },
      { kind: "label", text: "I2S Microphones" },
      { kind: "block", type: "i2s_mic_init" },
      { kind: "block", type: "i2s_mic_read" },
      { kind: "label", text: "Tone & Buzzers" },
      { kind: "block", type: "tone_async" },
    ],
  };
}
