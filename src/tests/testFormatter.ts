import { ArduinoCompiler } from "../compiler/assembler";

const compiler = new ArduinoCompiler();
compiler.init("esp32-wroom");

// Simulate what generators do
compiler.addInclude('#include <Servo.h>', 'servo');
compiler.addInclude('#include <DHT.h>', 'dht');
compiler.addGlobal('Servo myServo;', 'servo_obj');
compiler.addGlobal('DHT dht(4, DHT11);', 'dht_obj');
compiler.addSetup('myServo.attach(9);', 'servo_attach');
compiler.addSetup('dht.begin();', 'dht_begin');

const loopCode = `float temp = dht.readTemperature();
if (temp > 30) {
myServo.write(180);
} else {
myServo.write(0);
}
for (int i = 180; i >= 0; i += -1) {
myServo.write(i);
delay(15);
}
`;

const result = compiler.assemble(loopCode);
console.log("=== FORMATTED OUTPUT ===");
console.log(result);
console.log("=== END ===");
