import { defineSensorBlocks, getSensorCategory } from "./Sensors";
import { defineDisplayBlocks, getDisplayCategory } from "./Display";
import { defineMotorBlocks, getMotorCategory } from "./Motors";
import { defineCommunicationBlocks, getCommunicationCategory } from "./Communication";
import { defineCameraStorageTimeBlocks, getCameraStorageTimeCategory } from "./CameraStorageTime";
import { defineAdvancedCommunicationBlocks, getAdvancedCommunicationCategory } from "./AdvancedCommunication";
import { defineNavigationBlocks, getNavigationCategory } from "./Navigation";
import { defineAudioMediaBlocks, getAudioMediaCategory } from "./AudioMedia";
import { defineAdvancedControlBlocks, getAdvancedControlCategory } from "./AdvancedControl";

export function defineAllLibraryBlocks(Blockly: any) {
  defineSensorBlocks(Blockly);
  defineDisplayBlocks(Blockly);
  defineMotorBlocks(Blockly);
  defineCommunicationBlocks(Blockly);
  defineCameraStorageTimeBlocks(Blockly);
  defineAdvancedCommunicationBlocks(Blockly);
  defineNavigationBlocks(Blockly);
  defineAudioMediaBlocks(Blockly);
  defineAdvancedControlBlocks(Blockly);
}

export function getAllLibraryCategories() {
  return [
    getSensorCategory(),
    getDisplayCategory(),
    getMotorCategory(),
    getCommunicationCategory(),
    getCameraStorageTimeCategory(),
    getAdvancedCommunicationCategory(),
    getNavigationCategory(),
    getAudioMediaCategory(),
    getAdvancedControlCategory(),
  ];
}
