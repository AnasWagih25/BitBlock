import { defineSensorBlocks, getSensorCategory } from "./Sensors";
import { defineDisplayBlocks, getDisplayCategory } from "./Display";
import { defineMotorBlocks, getMotorCategory } from "./Motors";
import { defineCommunicationBlocks, getCommunicationCategory } from "./Communication";
import { defineCameraStorageTimeBlocks, getCameraStorageTimeCategory } from "./CameraStorageTime";

export function defineAllLibraryBlocks(Blockly: any) {
  defineSensorBlocks(Blockly);
  defineDisplayBlocks(Blockly);
  defineMotorBlocks(Blockly);
  defineCommunicationBlocks(Blockly);
  defineCameraStorageTimeBlocks(Blockly);
}

export function getAllLibraryCategories() {
  return [
    getSensorCategory(),
    getDisplayCategory(),
    getMotorCategory(),
    getCommunicationCategory(),
    getCameraStorageTimeCategory(),
  ];
}
