const fs = require('fs');
const files = [
  'src/libraries/Navigation.ts',
  'src/libraries/AudioMedia.ts',
  'src/libraries/AdvancedControl.ts',
  'src/libraries/AdvancedCommunication.ts',
  'src/libraries/CameraStorageTime.ts'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('blockly/javascript')) {
    content = content.replace('import { getBoardConfig } from "../boards/registry";', 'import { getBoardConfig } from "../boards/registry";\nimport { javascriptGenerator } from "blockly/javascript";');
    fs.writeFileSync(file, content);
    console.log('Fixed import in', file);
  }
}
