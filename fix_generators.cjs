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
  
  // Add import if not present
  if (!content.includes('import { javascriptGenerator } from "blockly/javascript";')) {
    // find the first import and put it after
    content = content.replace(/(import .*;\n)/, '$1import { javascriptGenerator } from "blockly/javascript";\n');
  }

  // Replace generator assignment
  content = content.replace(/const generator = Blockly\.javascriptGenerator \|\| Blockly\.JavaScript;/g, 'const generator = javascriptGenerator as any;');
  content = content.replace(/const generator = Blockly\.JavaScript \|\| Blockly\.javascriptGenerator;/g, 'const generator = javascriptGenerator as any;');
  
  fs.writeFileSync(file, content);
  console.log('Fixed', file);
}
