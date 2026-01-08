# Complete Ollama Stack Setup Guide

This guide walks through setting up a **fully private, local AI stack** for your AI-Assistant using Ollama, Whisper, and Piper.

---

## 📋 Prerequisites

### Hardware Requirements
- **Raspberry Pi:** Zero 2W (minimum) or Pi 5 (recommended for local model hosting)
- **Desktop/Laptop:** Any modern computer (Windows/Mac/Linux) to run Ollama server
- **Network:** Both devices on the same local network

### Software Requirements on Raspberry Pi
- Raspberry Pi OS (Bookworm recommended)
- Python 3.9+
- Node.js 20+ (installed via `install_dependencies.sh`)
- Audio drivers installed (from Whisplay HAT repository)

---

## 🖥️ Part 1: Desktop Computer Setup (Ollama Server)

### Step 1: Install Ollama

**Windows/Mac:**
1. Download from https://ollama.com
2. Run the installer
3. Verify installation:
   ```bash
   ollama --version
   ```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Step 2: Pull Base Models

**Essential models:**
```bash
# Conversation model (1.5GB - fast with reasoning)
ollama pull deepseek-r1:1.5b

# Vision model for image understanding (1.4GB)
ollama pull qwen3-vl:2b
```

**The base setup is ready!** Ollama runs automatically on `http://localhost:11434`

---

## 🍓 Part 2: Raspberry Pi Setup

### Step 1: Install Whisplay Dependencies

If you haven't already:
```bash
cd ~/ai-assistant
bash install_dependencies.sh
source ~/.bashrc
```

### Step 2: Install Whisper (ASR)

```bash
# Install Python package
pip install -U openai-whisper --break-system-packages

# Install ffmpeg dependency
sudo apt-get install -y ffmpeg

# Test installation
whisper --help
```

**Note:** First run will download the model (~75MB for tiny model). Subsequent runs reuse the cached model.

### Step 3: Install Piper (TTS)

```bash
# Create piper directory
mkdir -p ~/piper
cd ~/piper

# Download Piper binary for ARM64 (check your architecture first)
uname -m  # Should show aarch64 for Pi Zero W2

# Download Piper (use aarch64 for 64-bit Pi OS)
wget https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_aarch64.tar.gz
tar -xzf piper_aarch64.tar.gz

# The archive extracts to a nested piper directory
cd piper
chmod +x piper

# Download voice model (Amy - US English female)
mkdir -p voices
cd voices
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json

# Test Piper
cd ~/piper/piper
echo "Hello world" | ./piper --model voices/en_US-amy-medium.onnx --output_file test.wav
aplay test.wav
```

### Step 4: Configure Environment Variables

Edit `.env` file in your ai-assistant directory:

```bash
cd ~/ai-assistant
nano .env
```

**Basic configuration:**
```env
# Core Settings
ASR_SERVER=whisper
LLM_SERVER=ollama
TTS_SERVER=piper
VISION_SERVER=ollama

# Ollama Configuration (replace with your computer's IP)
OLLAMA_ENDPOINT=http://192.168.1.100:11434
OLLAMA_MODEL=deepseek-r1:1.5b
OLLAMA_VISION_MODEL=qwen3-vl:2b
OLLAMA_ENABLE_TOOLS=true

# Whisper Configuration
WHISPER_MODEL_SIZE=tiny
WHISPER_LANGUAGE=English

# Piper Configuration (note the nested piper/piper directory structure)
PIPER_BINARY_PATH=/home/pi/piper/piper/piper
PIPER_MODEL_PATH=/home/pi/piper/piper/voices/en_US-amy-medium.onnx

# Optional: Enable thinking display
ENABLE_THINKING=true

# Optional: Enable camera for image capture
# ENABLE_CAMERA=true
```

**Find your computer's IP address:**
- **Windows:** `ipconfig` (look for IPv4 Address)
- **Mac/Linux:** `ifconfig` or `ip addr show`

### Step 5: Build and Run

```bash
cd ~/ai-assistant
bash build.sh
bash run_chatbot.sh
```

**Test the setup:**
1. Press and hold the button
2. Say "Hello, who are you?"
3. Release button
4. Wait for response

---

## 🎛️ Configuration Options & Upgrades

### Option 1: Larger LLM Models (Better Quality)

**Trade-off:** Higher quality conversations vs. slower response times and more VRAM

| Model | Size | RAM Needed | Quality | Speed | Tool Support | Thinking |
|-------|------|------------|---------|-------|--------------|----------|
| **deepseek-r1:1.5b** | 1.5GB | 2GB | ⭐⭐⭐ | ⚡⚡⚡ | ✅ | ✅ |
| **qwen3:3b** | 2.0GB | 3GB | ⭐⭐⭐ | ⚡⚡⚡ | ✅ | ✅ |
| **gemma3:4b** | 3.3GB | 4GB | ⭐⭐⭐ | ⚡⚡ | ✅ | ❌ |
| **deepseek-r1:7b** | 4.7GB | 6GB | ⭐⭐⭐⭐ | ⚡⚡ | ✅ | ✅ |
| **qwen3:8b** | 5.0GB | 6GB | ⭐⭐⭐⭐ | ⚡⚡ | ✅ | ✅ |
| **gemma3:12b** | 8.1GB | 10GB | ⭐⭐⭐⭐ | ⚡ | ✅ | ❌ |
| **phi4** | 8.5GB | 10GB | ⭐⭐⭐⭐⭐ | ⚡⚡ | ✅ | ✅ |
| **qwen2.5:14b** | 9.0GB | 12GB | ⭐⭐⭐⭐⭐ | ⚡ | ✅ | ❌ |

**To upgrade:**
```bash
# On your desktop computer
ollama pull qwen3:3b
# Or for excellent quality with strong reasoning:
ollama pull phi4

# Update .env on Raspberry Pi
OLLAMA_MODEL=qwen3:3b
# Or:
OLLAMA_MODEL=phi4
```

**Benefits:**
- Better context understanding
- More natural conversation flow
- Better instruction following
- More accurate tool/function calling

**Recommendation:** If you have 8GB+ RAM on your desktop, try `qwen3:8b` or `gemma3:12b` for excellent quality with latest improvements.

---

### Option 2: Better Whisper Models (Better ASR)

**Trade-off:** Accuracy vs. initialization time

| Model Size | File Size | VRAM | Init Time | Quality |
|------------|-----------|------|-----------|---------|
| **tiny** | 75MB | ~1GB | ~10s | ⭐⭐ |
| **base** | 142MB | ~1GB | ~12s | ⭐⭐⭐ |
| **small** | 466MB | ~2GB | ~20s | ⭐⭐⭐⭐ |
| **medium** | 1.5GB | ~5GB | ~40s | ⭐⭐⭐⭐⭐ |

**To upgrade:**
```env
WHISPER_MODEL_SIZE=base
```

**Benefits:**
- Better accuracy with accents
- Better handling of background noise
- More accurate technical term recognition
- Improved multilingual performance

**Recommendation:** Use `base` for 20% better accuracy with only 2s slower init.

---

### Option 3: Alternative Piper Voices

**Different languages, genders, and accents available.**

**Popular voices:**
```bash
cd ~/piper/voices

# US English - Male (Joe)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx.json

# British English - Female (Alba)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alba/medium/en_GB-alba-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alba/medium/en_GB-alba-medium.onnx.json
```

**Browse all voices:** https://rhasspy.github.io/piper-samples/

**Update `.env`:**
```env
PIPER_MODEL_PATH=/home/pi/piper/voices/en_US-joe-medium.onnx
```

**Benefits:**
- Match voice to assistant personality
- Multiple language support
- Better naturalness with high-quality models

---

### Option 4: Vision Model Upgrades

**For better image understanding:**

| Model | Size | Quality | Speed | Best For |
|-------|------|---------|-------|----------|
| **qwen3-vl:2b** | 1.4GB | ⭐⭐⭐ | ⚡⚡⚡ | General images |
| **qwen3-vl:4b** | 2.5GB | ⭐⭐⭐⭐ | ⚡⚡ | Better accuracy |
| **llava:7b** | 4.7GB | ⭐⭐⭐⭐ | ⚡ | Detailed analysis |
| **llava:13b** | 8.0GB | ⭐⭐⭐⭐⭐ | 🐌 | Professional use |

**To upgrade:**
```bash
ollama pull llava:7b
```

**Update `.env`:**
```env
OLLAMA_VISION_MODEL=llava:7b
```

**Benefits:**
- Better object detection
- More detailed scene descriptions
- Better text recognition (OCR)
- Improved reasoning about images

---

### Option 5: Enable Camera Mode

**Capture images with double-click and analyze them:**

```env
ENABLE_CAMERA=true
```

**Requirements:**
- Pi Camera module connected
- `picamera2` installed (included in Raspberry Pi OS)

**Benefits:**
- Take photos by double-clicking button
- Ask "What do you see?" to analyze captured images
- Visual memory in conversations

**Example usage:**
1. Double-click button → Camera preview appears
2. Press button to capture
3. Ask "Describe what you see in detail"

---

### Option 6: Custom System Prompt

**Personalize your assistant's personality:**

```env
SYSTEM_PROMPT="You are Ada, a brilliant and witty AI assistant with a British accent. You love science, making jokes, and helping with technical problems. Keep responses under 150 words and always stay cheerful."
```

**Benefits:**
- Customized personality
- Specific domain expertise
- Tone and style control
- Response length management

---

### Option 7: Faster Whisper Alternative (faster-whisper)

**Trade-off:** Same accuracy, faster processing

```bash
pip install faster-whisper --break-system-packages
```

**Edit `src/cloud-api/local/whisper-asr.ts` to use `faster-whisper` CLI instead of `whisper`.**

**Benefits:**
- 2-4x faster processing
- Lower memory usage
- Same model compatibility

**Note:** Requires code modification (not currently implemented in the project).

---

## � High-Performance Setup (For Powerful GPUs: 32GB+ VRAM)

**If you have a high-end GPU with 32GB+ VRAM** (e.g., Ryzen AI Max with 96GB, NVIDIA RTX 4090, A100), you can run **professional-grade models** that rival or exceed cloud services like GPT-4.

### Premium LLM Models (Best Quality)

With substantial GPU memory, upgrade to these top-tier models:

| Model | Size | GPU VRAM | Quality | Speed | Best Feature |
|-------|------|----------|---------|-------|--------------|
| **qwen3:14b** | 9.0GB | ~12GB | ⭐⭐⭐⭐ | ⚡⚡ | Excellent reasoning |
| **qwen3:32b** | 19GB | ~22GB | ⭐⭐⭐⭐⭐ | ⚡⚡ | Best all-around |
| **llama4:scout** | 67GB | ~72GB | ⭐⭐⭐⭐⭐ | ⚡ | Latest Meta model |
| **llama3.3:70b** | 43GB | ~48GB | ⭐⭐⭐⭐⭐ | ⚡ | Proven quality |
| **deepseek-r1:70b** | 43GB | ~48GB | ⭐⭐⭐⭐⭐ | ⚡ | Best reasoning + thinking |
| **deepseek-v3:671b** | 404GB | ~450GB | ⭐⭐⭐⭐⭐ | 🐌 | Absolute best (MoE) |

### Premium Vision Models

| Model | Size | GPU VRAM | Quality | Best For |
|-------|------|----------|---------|----------|
| **llava:34b** | 20GB | ~24GB | ⭐⭐⭐⭐⭐ | Professional image analysis |
| **llava-llama3:70b** | 43GB | ~48GB | ⭐⭐⭐⭐⭐ | Best vision understanding |

### Installation (96GB GPU Example)

```bash
# On your high-performance computer
# Option 1: Balanced 32B model (leaves headroom)
ollama pull qwen3:32b                # 19GB - Latest generation

# Option 2: Maximum quality 70B model
ollama pull deepseek-r1:70b          # 43GB - Best reasoning with thinking
# OR
ollama pull llama3.3:70b             # 43GB - Proven general conversation
# OR
ollama pull llama4:scout             # 67GB - Latest Meta model (109B params)

# Premium vision model
ollama pull llava:34b                # 20GB - Professional image analysis

# With 96GB, you can run multiple models simultaneously:
# Example: qwen3:32b (19GB) + llava:34b (20GB) = 39GB used, 57GB free
```

### High-Performance Configuration

**Edit `.env` on Raspberry Pi:**

```env
# Core Settings
ASR_SERVER=whisper
LLM_SERVER=ollama
TTS_SERVER=piper
VISION_SERVER=ollama

# Ollama Configuration - High-Performance Setup
OLLAMA_ENDPOINT=http://YOUR_COMPUTER_IP:11434
OLLAMA_MODEL=qwen3:32b                # or deepseek-r1:70b or llama4:scout or llama3.3:70b
OLLAMA_VISION_MODEL=llava:34b
OLLAMA_ENABLE_TOOLS=true

# Upgrade to better Whisper model (you have the compute power)
WHISPER_MODEL_SIZE=medium             # or 'large' for best accuracy
WHISPER_LANGUAGE=English

# Piper Configuration
PIPER_BINARY_PATH=/home/pi/piper/piper
PIPER_MODEL_PATH=/home/pi/piper/voices/en_US-amy-high.onnx

# Enable all premium features
ENABLE_THINKING=true
ENABLE_CAMERA=true
CHAT_HISTORY_RESET_TIME=1800          # 30 minutes (longer context)
```

### Expected Performance (70B Model on High-End GPU)

| Component | Time | Quality |
|-----------|------|---------|
| **LLM Response (first token)** | 1-2s | ⭐⭐⭐⭐⭐ |
| **LLM Streaming** | 20-40 tokens/sec | ⭐⭐⭐⭐⭐ |
| **ASR (medium model)** | ~20s init, <3s process | ⭐⭐⭐⭐⭐ |
| **Vision Analysis** | 3-5s | ⭐⭐⭐⭐⭐ |
| **Total Latency** | ~25-30s | Near-GPT-4 quality |

### Multi-Model Strategy (96GB+ VRAM)

Run multiple models for different use cases:

```bash
# Strategy: Fast model + Smart model + Vision model
ollama pull deepseek-r1:7b           # 4.7GB - Quick responses
ollama pull qwen3:32b                # 19GB - Complex reasoning
ollama pull llava:34b                # 20GB - Vision analysis

# Total: ~44GB (leaving 52GB free for inference)
```

**Switch models dynamically in code** or run separate Ollama instances on different ports.

### Ultimate Quality Configuration

**For maximum quality (assumes 96GB GPU + unlimited budget for cloud TTS):**

```env
# Maximum quality setup
ASR_SERVER=whisper
WHISPER_MODEL_SIZE=large             # Best accuracy (1.5GB model)

LLM_SERVER=ollama
OLLAMA_ENDPOINT=http://YOUR_IP:11434
OLLAMA_MODEL=deepseek-r1:70b         # Best reasoning (or llama3.3:70b)
OLLAMA_ENABLE_TOOLS=true

TTS_SERVER=openai                    # Cloud TTS for natural voice
OPENAI_API_KEY=your_key              # Only TTS uses cloud, LLM stays private

VISION_SERVER=ollama
OLLAMA_VISION_MODEL=llava:34b

ENABLE_THINKING=true
ENABLE_CAMERA=true
CHAT_HISTORY_RESET_TIME=1800

SYSTEM_PROMPT="You are an exceptionally knowledgeable AI assistant. Provide detailed, accurate, and nuanced responses while staying concise and engaging. Use your advanced reasoning capabilities to give comprehensive answers."
```

### Why This Beats Cloud Services

✅ **Privacy:** All reasoning and conversation stays on your computer  
✅ **Cost:** No per-token API charges (free after hardware cost)  
✅ **Speed:** Local inference faster than API round-trips  
✅ **No rate limits:** Process unlimited requests  
✅ **Customization:** Full control over model parameters  
✅ **Offline capability:** Works without internet  
✅ **Quality:** 70B models rival GPT-4 for most tasks  

**Only limitation:** No image generation (requires cloud or Stable Diffusion setup)

### Testing Your High-Performance Setup

```bash
# Test Ollama connection and model
curl http://YOUR_COMPUTER_IP:11434/api/generate -d '{
  "model": "qwen2.5:32b",
  "prompt": "Explain quantum entanglement in simple terms, then provide a technical explanation.",
  "stream": false
}'

# Monitor GPU usage (Windows PowerShell)
nvidia-smi  # For NVIDIA GPUs
# or check AMD GPU monitoring tool for Ryzen AI

# Check model is loaded
curl http://YOUR_COMPUTER_IP:11434/api/ps
```

### Benchmark Comparison

| Setup | Quality | Speed | Privacy | Cost/month |
|-------|---------|-------|---------|------------|
| **Cloud (GPT-4)** | ⭐⭐⭐⭐⭐ | ⚡⚡ | ❌ | $100+ |
| **70B Local** | ⭐⭐⭐⭐⭐ | ⚡⚡ | ✅ | $0 |
| **32B Local** | ⭐⭐⭐⭐ | ⚡⚡⚡ | ✅ | $0 |
| **7B Local** | ⭐⭐⭐ | ⚡⚡⚡ | ✅ | $0 |

### New Models to Consider (January 2026)

**Latest Releases You Should Try:**

| Model | Size | VRAM | Special Feature | Why Consider |
|-------|------|------|-----------------|--------------|
| **llama4:scout** | 67GB | ~72GB | Latest Meta (109B) | Cutting-edge, just released |
| **gpt-oss:120b** | ~70GB | ~75GB | OpenAI open-source | Reasoning + safeguards |
| **qwen3-next:80b** | ~48GB | ~54GB | Newest Qwen variant | Better efficiency |
| **phi4** | 9.1GB | ~12GB | Microsoft's latest | Excellent small model |
| **phi4-mini** | 2.5GB | ~4GB | Tiny but powerful | 3.8B params, tool support |
| **magistral:24b** | ~15GB | ~18GB | Reasoning specialist | Built for thinking tasks |
| **nemotron-3-nano:30b** | ~18GB | ~21GB | NVIDIA optimized | Agentic workflows |
| **deepseek-v3.2** | 404GB | Won't fit | Latest DeepSeek MoE | If you get 512GB+ GPU |

**Best Additions for Your 96GB Setup:**

```bash
# Cutting-edge Meta model (just released)
ollama pull llama4:scout              # 67GB - Multimodal, latest

# OpenAI's open reasoning model
ollama pull gpt-oss:120b              # ~70GB - Reasoning focused

# Latest Qwen variant (more efficient)
ollama pull qwen3-next:80b            # ~48GB - Better performance

# Reasoning specialist (pairs well with main model)
ollama pull magistral:24b             # ~15GB - Thinking mode

# Best small model for quick tasks
ollama pull phi4                      # 9GB - Microsoft's best small model
```

**Recommended Multi-Model Setup for 96GB:**

```bash
# Strategy 1: Latest + Fast backup
ollama pull llama4:scout              # 67GB - Main (latest Meta)
ollama pull phi4                      # 9GB - Quick queries
ollama pull llava:34b                 # 20GB - Vision
# Total: ~96GB (perfectly optimized!)

# Strategy 2: Reasoning powerhouse
ollama pull qwen3-next:80b            # 48GB - Main reasoning
ollama pull magistral:24b             # 15GB - Thinking specialist
ollama pull phi4                      # 9GB - Fast tasks
# Total: ~72GB (24GB free for processing)

# Strategy 3: OpenAI alternative
ollama pull gpt-oss:120b              # 70GB - OpenAI quality
ollama pull phi4-mini                 # 2.5GB - Ultra-fast
ollama pull qwen3-vl:4b               # 2.5GB - Vision
# Total: ~75GB (21GB free)
```

**Performance Notes:**

- **Llama4:scout** - Just released, multimodal (text + images), 109B params
- **GPT-OSS:120b** - OpenAI's first open reasoning model, comparable to GPT-4
- **Phi4** - Microsoft's breakthrough at 14B params, beats much larger models
- **Magistral:24b** - Specifically trained for reasoning chains (like o1-preview)
- **Qwen3-Next** - Improved efficiency and speed over Qwen3

**What's Different About These Models:**

1. **Llama4** has native multimodal support (vision built-in, not separate model)
2. **GPT-OSS** includes OpenAI's safety reasoning (explains why it refuses prompts)
3. **Phi4** has better math/coding than some 70B models despite being 14B
4. **Magistral** shows explicit reasoning steps (good for education/debugging)
5. **Qwen3-Next** has dynamic reasoning depth (adjusts complexity automatically)

### Optimization Tips for Large Models

1. **Use quantized models** if you need more headroom:
   ```bash
   ollama pull qwen2.5:32b-q4_K_M    # 4-bit quantized, ~10GB
   ```

2. **Enable GPU layers** (automatic in Ollama, but verify):
   ```bash
   # Check GPU is being used
   ollama show qwen2.5:32b --verbose
   ```

3. **Adjust context window** for longer conversations:
   ```bash
   # In Ollama modelfile, increase num_ctx
   # Default is 2048, can go to 8192 or higher
   ```

4. **Consider SSD caching** if models don't fit in VRAM:
   - Models swap to system RAM, still faster than API calls

### Recommended Models by Task

| Task | Best Model | Size | Reasoning |
|------|-----------|------|-----------|
| **General conversation** | qwen3:32b | 19GB | Latest generation, excellent |
| **Reasoning/Math** | deepseek-r1:70b | 43GB | Shows thinking process |
| **Coding/Technical** | qwen3:32b | 19GB | Excellent code & reasoning |
| **Fast responses** | qwen3:8b | 5GB | Great quality, very quick |
| **Latest/Experimental** | llama4:scout | 67GB | Cutting-edge Meta model |
| **Vision tasks** | llava:34b | 20GB | Professional image analysis |

---

## �🔍 Troubleshooting

### Display Socket Error (ECONNREFUSED 0.0.0.0:12345)

**What it means:** Chatbot can't connect to the PiSugar Whisplay HAT display service.

**Impact:** Display won't show status. **Voice functionality still works!**

**To fix:**
```bash
# Install Whisplay HAT drivers (includes display socket service)
cd ~
git clone https://github.com/PiSugar/whisplay.git
cd whisplay/Driver
sudo bash install_wm8960_drive.sh
sudo reboot
```

**Note:** This installs both the WM8960 audio drivers and the display socket service that the chatbot UI connects to.

---

### Pi Can't Connect to Ollama

**Check connectivity:**
```bash
# From Raspberry Pi
curl http://192.168.1.100:11434/api/version
```

**If it fails:**
1. Verify computer IP address: `ipconfig` (Windows) or `ip addr` (Linux)
2. Check firewall allows port 11434 (see Part 1, Step 3)
3. Verify OLLAMA_HOST environment variable is set to `0.0.0.0:11434`
4. Restart Ollama service or reboot your PC
5. Ensure Ollama is running: `ollama serve`

**Windows Firewall Fix:**
```powershell
# Run PowerShell as Administrator
New-NetFirewallRule -DisplayName "Ollama API" -Direction Inbound -LocalPort 11434 -Protocol TCP -Action Allow
```

---

### Piper Download 404 Error

**If `piper_arm64.tar.gz` gives 404:**
```bash
# Check your architecture first
uname -m  # Should show aarch64 for Pi Zero W2

# Use the correct file name
wget https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_aarch64.tar.gz
# OR for armv7l systems:
wget https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_armv7l.tar.gz
```

**Note:** The archive extracts to a nested `piper/piper` directory structure. Your paths should be:
- Binary: `/home/pi/piper/piper/piper`
- Voice: `/home/pi/piper/piper/voices/en_US-amy-medium.onnx`

---

### Piper Permission Denied

**If you can't cd into piper directory:**
```bash
chmod +x piper
cd piper
chmod +x piper  # For the executable inside
```

---

### Whisper Takes Too Long

**Solutions:**
1. Use smaller model: `WHISPER_MODEL_SIZE=tiny`
2. Consider Vosk instead:
   ```env
   ASR_SERVER=vosk
   VOSK_MODEL_PATH=/path/to/vosk-model-small-en-us-0.15
   ```

---

### Piper Voice Sounds Robotic

**Solutions:**
1. Try high-quality voice: Download `-high.onnx` models
2. Use different voice: Try `jenny` or `amy` models
3. Consider cloud TTS for better quality:
   ```env
   TTS_SERVER=openai
   OPENAI_API_KEY=your_key
   ```

---

### Out of Memory Errors

**On Desktop:**
1. Use smaller LLM: `deepseek-r1:1.5b` or `qwen2.5:3b`
2. Close other applications
3. Upgrade RAM

**On Pi:**
1. Use smaller Whisper model: `tiny` or `base`
2. Disable thinking: `ENABLE_THINKING=false`
3. Increase swap space

---

## 🚀 Performance Optimization

### For Best Response Times

```env
# Fast but lower quality
ASR_SERVER=vosk
WHISPER_MODEL_SIZE=tiny
OLLAMA_MODEL=deepseek-r1:1.5b
ENABLE_THINKING=false
```

### For Best Quality

```env
# Slower but excellent quality
WHISPER_MODEL_SIZE=base
OLLAMA_MODEL=qwen3:8b
OLLAMA_VISION_MODEL=llava:7b
ENABLE_THINKING=true
```

### Balanced Setup (Recommended)

```env
# Good balance
WHISPER_MODEL_SIZE=base
OLLAMA_MODEL=qwen3:3b
OLLAMA_VISION_MODEL=qwen3-vl:2b
ENABLE_THINKING=true
```

---

## 📊 Expected Performance

| Configuration | ASR Time | LLM Response | TTS Time | Total Latency |
|---------------|----------|--------------|----------|---------------|
| **Fast** | ~10s | ~2-3s | ~1s | ~13-14s |
| **Balanced** | ~12s | ~4-6s | ~1s | ~17-19s |
| **Quality** | ~20s | ~10-15s | ~1s | ~31-36s |

**Note:** ASR time is one-time initialization per recording. Subsequent processing is faster.

---

## 🎯 Recommended Configurations by Use Case

### For Kids (Fast & Simple)
```env
ASR_SERVER=whisper
WHISPER_MODEL_SIZE=tiny
LLM_SERVER=ollama
OLLAMA_MODEL=qwen3:3b
TTS_SERVER=piper
PIPER_MODEL_PATH=/home/pi/piper/voices/en_US-amy-medium.onnx
SYSTEM_PROMPT="You are a friendly teacher who loves helping kids learn. Use simple words and be encouraging. Keep answers very short."
```

### For Makers/Developers (Tools & Vision)
```env
ASR_SERVER=whisper
WHISPER_MODEL_SIZE=base
LLM_SERVER=ollama
OLLAMA_MODEL=qwen3:8b
OLLAMA_ENABLE_TOOLS=true
TTS_SERVER=piper
VISION_SERVER=ollama
OLLAMA_VISION_MODEL=llava:7b
ENABLE_CAMERA=true
```

### For Privacy Enthusiasts (100% Local)
```env
ASR_SERVER=vosk
LLM_SERVER=ollama
OLLAMA_MODEL=deepseek-r1:7b
TTS_SERVER=piper
VISION_SERVER=ollama
ENABLE_THINKING=true
```

---

## 📚 Additional Resources

- **Ollama Models:** https://ollama.com/library
- **Piper Voices:** https://rhasspy.github.io/piper-samples/
- **Whisper Documentation:** https://github.com/openai/whisper
- **Original Project Repository:** https://github.com/PiSugar/whisplay-ai-chatbot

---

## 🔐 Privacy Benefits

With this setup:
- ✅ **No data leaves your network**
- ✅ **No API keys required** (after initial setup)
- ✅ **No internet dependency** (works offline)
- ✅ **No usage tracking**
- ✅ **Complete conversation privacy**
- ✅ **No monthly costs**

**The only network traffic is between your Raspberry Pi and your local computer.**

---

## 🎉 Next Steps

After basic setup works:
1. Experiment with different models
2. Customize system prompt
3. Add custom tools in `src/config/custom-tools/`
4. Enable camera mode
5. Try multilingual models

**Happy hacking! 🚀**
