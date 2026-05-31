<div align="center">
  <img src="public/demo/image.png" alt="BitBlock System Overview" width="100%" />
</div>

<div align="center">
  <h1>BitBlock: A Browser-Native Framework for Embedded Machine Learning and Microcontroller Compilation</h1>
  <p><strong>An open-source platform integrating visual programming, real-time data acquisition, and hardware-accelerated TinyML directly within the browser.</strong></p>
  <a href="https://bitblock.lol">bitblock.lol</a>
</div>

<hr/>

## Abstract

BitBlock presents a fully open-source, browser-native framework designed to facilitate visual programming and hardware-accelerated Embedded Machine Learning (TinyML) on resource-constrained microcontrollers. By bridging the gap between low-level C++ firmware development and high-level, interactive model design, the system democratizes access to embedded engineering. 

Leveraging WebSerial, WebUSB, and cloud-distributed build systems, BitBlock enables the authoring of control logic, capture of live sensor telemetry, training of neural networks, and flashing of compiled firmware binaries directly onto ESP32, AVR, and Cortex-M devices, entirely circumventing the need for localized toolchain installations.

---

## 1. System Architecture: The Embedded Machine Learning Pipeline

The pipeline architecture integrates raw sensor data acquisition, digital signal processing (DSP), neural network training, model quantization, and native C++ deployment into a cohesive, browser-mediated workflow.

<div align="center">
  <img src="public/demo/ai_lab.png" alt="BitBlock ML Telemetry Dashboard" width="100%" />
</div>

### 1.1. High-Speed Data Ingestion via WebSerial and DMA
BitBlock captures real-time telemetry from embedded sensors utilizing high-baud WebSerial APIs (up to 115,200 baud). The underlying firmware is abstracted via custom hardware-specific headers that employ Direct Memory Access (DMA) on the microcontroller. This approach pushes multidimensional arrays (e.g., IMU data) or raw I2S audio streams without blocking the primary CPU execution thread. The browser-side application parses incoming JSON or Binary buffers in real-time, rendering continuous FFT waveforms and 3D spatial telemetry.

```mermaid
graph LR
    A["Hardware Sensors (IMU/Audio)"] -->|DMA Buffers| B["MCU UART"]
    B -->|115200 Baud| C["WebSerial API"]
    C -->|Stream Parsing| D["Browser State / IndexedDB"]
    D -->|React Canvas| E["Real-Time Plotting"]
```

### 1.2. Digital Signal Processing (DSP) & Feature Extraction
Prior to neural network ingestion, BitBlock implements high-efficiency, on-device signal processing to reduce data dimensionality.
- **Time-Series Analysis:** For inertial measurement unit (IMU) data, spectral analysis windows the continuous stream into overlapping segments. It computes spectral power, Root Mean Square (RMS), and signal skewness, thereby distilling multi-axis, high-frequency noise into robust, low-dimensional feature vectors.
- **Audio Processing (MFCCs & Spectrograms):** For continuous audio streams, Mel-Frequency Cepstral Coefficients (MFCC) algorithms transform raw PCM audio matrices into 2D visual spectrograms. This drastically reduces the dimensionality of the input layer while isolating human-audible frequency bands for efficient convolutional processing.

### 1.3. Cloud-Distributed Neural Network Training
Following dataset curation and labeling, the pipeline leverages a cloud-distributed training cluster. BitBlock utilizes serverless workers via Firebase/GCP to execute dynamic TensorFlow training topologies asynchronously.
- **Topology Generation:** The system automatically synthesizes optimal input tensor shapes based on the preceding DSP extraction parameters.
- **Convolutional Architectures:** Time-series arrays utilize `Conv1D` layers with dropout mechanisms for robust anomaly detection and gesture classification. Audio classification tasks deploy deeper `Conv2D` architectures operating on the generated MFCC spectrograms.
- **Hyperparameter Optimization:** Learning rates, batch sizing, and epoch counts are heuristically constrained to adhere to the rigid memory limits of the target hardware architecture (e.g., the strict SRAM constraints of the ESP32 versus ATmega328P).

```mermaid
sequenceDiagram
    participant Frontend
    participant Firebase
    participant MLWorker as ML Worker (TensorFlow)
    
    Frontend->>Firebase: Upload Signed JSON Dataset
    Frontend->>Firebase: Create Training Job Request
    Firebase->>MLWorker: Trigger Cloud Function
    MLWorker->>MLWorker: Extract DSP Features
    MLWorker->>MLWorker: Train Neural Network (Epochs)
    MLWorker->>MLWorker: Post-Training INT8 Quantization
    MLWorker->>Firebase: Upload Compiled C++ Tensor headers
    Firebase-->>Frontend: Stream Completion Status
```

### 1.4. Post-Training INT8 Quantization and TFLite Conversion

Models natively trained utilizing high-precision `float32` weights frequently exceed the rigorous Static RAM (SRAM) and Flash memory constraints of standard microcontrollers, which often provide fewer than 320KB of available heap. To enable execution on such constrained architectures, the BitBlock pipeline implements a rigorous post-training Full Integer Quantization (INT8) protocol via the TensorFlow Lite (TFLite) Micro Converter.

The quantization process systematically maps real-valued floating-point tensors into an 8-bit integer domain using an affine transformation schema:

$$r = S(q - Z)$$

where:
- **$r$** represents the original real-valued `float32` activation or weight.
- **$S$** (Scale) is a `float32` resolution factor denoting the step size between quantized values.
- **$q$** is the quantized `INT8` representation ($q \in [-128, 127]$).
- **$Z$** (Zero-point) is an `INT8` value mapping the real value $0.0$ exactly to an integer, ensuring zero-padding layers incur no quantization error.

To accurately determine $S$ and $Z$, the pipeline utilizes a **Representative Dataset**—a statistically significant subset of the original training data—during the graph freezing phase. By running inference over this calibration dataset, the converter records the dynamic min/max activation ranges of all hidden layers. 

Weights are typically quantized per-axis (per-channel for convolutional filters) using symmetric quantization ($Z = 0$), optimizing dot-product operations in the Arithmetic Logic Unit (ALU). Conversely, layer activations employ asymmetric per-tensor quantization to accommodate non-zero-centered activation functions (e.g., ReLU). 

The resultant `.tflite` FlatBuffer model achieves an approximately 75% reduction in both Flash footprint and inference latency, maintaining >95% empirical accuracy compared to the baseline `float32` topology.

### 1.5. Seamless Native Deployment and Memory Arena Optimization

The quantized FlatBuffer `.tflite` artifact is structurally serialized into a C-style byte array header (`const unsigned char model[]`). By linking this static array with the `tflite::MicroInterpreter`, BitBlock entirely eliminates dynamic memory allocation (heap fragmentation) during runtime.

Instead of utilizing standard `malloc` calls, the pipeline dynamically pre-allocates a static **Tensor Arena** buffer in the MCU's `.bss` or `.data` sections. The size of this arena is heuristically computed during the cloud compilation phase, explicitly tuned to exactly fit the sum of the largest layer activations and intermediate buffers.

Upon user deployment, BitBlock dynamically injects the tensor array into the workspace compiler's Abstract Syntax Tree (AST). The cloud compiler (leveraging GCC for AVR or ESP-IDF for Espressif architectures) statically links the TensorFlow Lite Micro library. The resulting compiled ELF/BIN artifacts are securely streamed to the client browser and flashed to specific memory offsets on the hardware via the WebSerial protocol utilizing `esptool.js` and `stk500` drivers.

---

## 2. Visual Compilation Architecture

BitBlock abstracts traditional textual programming environments through an AST-driven block-based logic topology, differing fundamentally from interpreted runtime environments (e.g., MicroPython).

1. **AST Generation:** The visual workspace represents application logic as a rigorously structured XML tree.
2. **C++ Transpilation:** Custom code generators recursively traverse the logical blocks, enforcing strict type inferences and validating variable scope. These generators emit bare-metal, highly optimized C++ firmware code.
3. **Artifact Compilation:** The emitted source code is transmitted to cloud-based build servers. These builders interface the code with extensive Hardware Abstraction Layers (HALs) and execute `make / CMake` pipelines to yield binary artifacts tailored to the specific register maps of the target microcontroller (e.g., ESP32-C3, Arduino UNO).
4. **Flash Execution:** The client browser orchestrates reset sequences (via RTS/DTR line toggling) to initialize the microcontroller's bootloader mode, subsequently writing the binary payloads into flash memory serially.

---

## 3. Installation and Experimental Setup

### Prerequisites
- Node.js (v18+)
- Firebase CLI
- A WebSerial-compatible browser environment (e.g., Chromium-based browsers)

### Local Environment Initialization

1. **Repository Cloning:**
```bash
git clone https://github.com/your-username/bitblock.git
cd bitblock
```

2. **Dependency Installation:**
```bash
npm install
```

3. **Environment Configuration:**
Duplicate `.env.example` to `.env` and provision the requisite Firebase configuration variables.

4. **Development Server Execution:**
```bash
npm run dev
```
Access the local instance via `http://localhost:5173`. 
*Note: To ensure WebSerial API functionality on `localhost`, verify that the browser permissions permit local serial port access.*

---

## 4. Open Source and Contributions
BitBlock is distributed as an entirely open-source platform, aimed at accelerating research and democratizing access to embedded engineering and hardware AI. Contributions from the research and open-source communities are highly encouraged to expand hardware support and refine the machine learning pipeline.
