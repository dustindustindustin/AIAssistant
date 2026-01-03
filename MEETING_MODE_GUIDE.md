# Meeting Recording Mode Guide

This guide explains how to use the new **Meeting Recording Mode** feature to record long meetings while keeping the quick question functionality.

---

## 🎯 Overview

The Whisplay AI Chatbot now supports **dual recording modes**:

1. **Quick Question Mode** (original) - Press & hold button for short queries
2. **Meeting Recording Mode** (new) - Triple-click to start/stop long continuous recordings

---

## 🔧 Setup

### 1. Enable Meeting Mode

Edit your `.env` file:

```env
# Enable meeting recording feature
ENABLE_MEETING_MODE=true

# Optional: Set maximum meeting duration (default: 4 hours)
MEETING_MAX_DURATION=14400  # in seconds

# Optional: Custom directory for meeting recordings
MEETING_DIR=/home/pi/whisplay-ai-chatbot/data/meetings
```

### 2. Rebuild the Project

```bash
cd ~/whisplay-ai-chatbot
bash build.sh
bash run_chatbot.sh
```

### 3. Install Desktop Transcription Tool

On your desktop computer:

```bash
# Install faster-whisper for GPU-accelerated transcription
pip install faster-whisper

# For NVIDIA GPUs
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# For AMD ROCm
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm5.7
```

---

## 📱 How to Use

### Button Controls

| Action | Function |
|--------|----------|
| **Single press (hold)** | Quick question (original behavior) |
| **Double-click** | Camera mode (if enabled) |
| **Triple-click** | Toggle meeting recording mode |

### Starting a Meeting Recording

1. **Triple-click** the button
2. Device shows:
   - Purple/Magenta LED 💜
   - Display: "📝 Meeting recording..."
   - Text: "Triple-click to stop"
3. Meeting records continuously (no button hold needed)
4. Use device normally - you can still ask quick questions!

### Asking Questions During a Meeting

While a meeting is recording:
- **Press & hold** button for quick question
- Device pauses meeting recording
- Processes your question
- Automatically resumes meeting recording after answer

### Stopping a Meeting Recording

1. **Triple-click** button again
2. Device shows:
   - Green LED ✅
   - Duration and filename
   - Instructions for transcription

---

## 💾 File Management

### Meeting Files Location

```
data/
  meetings/
    meeting_20260103_143022.wav
    meeting_20260103_150815.wav
  recordings/
    user-1704297600000.wav  # Quick questions (auto-deleted)
```

### Transfer to Desktop

**Manual transfer:**
```bash
# From Raspberry Pi
scp data/meetings/meeting_*.wav user@desktop:/path/to/meetings/

# Or use USB drive
cp data/meetings/meeting_*.wav /mnt/usb/
```

**Automatic transfer (optional):**

Add to `.env`:
```env
AUTO_TRANSFER_MEETINGS=true
DESKTOP_TRANSFER_PATH=user@192.168.1.100:/path/to/meetings
```

---

## 🖥️ Desktop Transcription

### Basic Usage

```bash
# Transcribe with default settings (large-v3 model)
python transcribe_meeting.py meeting_20260103_143022.wav

# Choose different model
python transcribe_meeting.py meeting_20260103_143022.wav --model medium

# Generate SRT subtitles
python transcribe_meeting.py meeting_20260103_143022.wav --format srt

# Generate all formats (txt, srt, json)
python transcribe_meeting.py meeting_20260103_143022.wav --format all

# Use CPU instead of GPU
python transcribe_meeting.py meeting_20260103_143022.wav --device cpu
```

### Output Files

```
meetings/
  meeting_20260103_143022.wav
  meeting_20260103_143022_transcript.txt   # Plain text with timestamps
  meeting_20260103_143022_transcript.srt   # Subtitle format
  meeting_20260103_143022_transcript.json  # Structured data
```

### Example Transcript Output

```
Meeting Transcription
File: meeting_20260103_143022.wav
Duration: 01:23:45
Language: en
================================================================================

[00:00:03] Welcome everyone to today's meeting.
[00:00:08] Let's start with the quarterly results.
[00:02:15] Our revenue increased by 25% this quarter.
...
```

---

## ⚙️ Performance

### Recording Quality

| Aspect | Setting |
|--------|---------|
| **Sample rate** | 16kHz |
| **Channels** | Mono |
| **Format** | WAV or MP3 |
| **Max duration** | 4 hours (configurable) |

### Transcription Speed (Desktop)

With Ryzen AI Max (96GB GPU):

| Model | 1-hour Meeting | Quality |
|-------|---------------|---------|
| **medium** | ~5 minutes | ⭐⭐⭐⭐ |
| **large-v2** | ~8 minutes | ⭐⭐⭐⭐⭐ |
| **large-v3** | ~10 minutes | ⭐⭐⭐⭐⭐ |

---

## 🎨 Visual Indicators

### LED Colors

| Color | Meaning |
|-------|---------|
| 🔵 Dark Blue | Idle |
| 🟢 Green | Listening (quick question) |
| 💜 Purple/Magenta | Meeting recording |
| 🟡 Yellow | Processing audio |
| 🟠 Orange | LLM thinking |
| 🔵 Blue | Speaking answer |
| ✅ Green | Meeting saved |

### Display Messages

```
Idle:          😴 "Long Press the button to say something,
                   double click to launch camera,
                   triple click for meeting mode"

Meeting:       📝 "Meeting recording...
                   Triple-click to stop"

Saved:         ✅ "Meeting saved!
                   Duration: 45m 32s
                   meeting_20260103_143022.wav"
```

---

## 🔧 Advanced Options

### Custom Meeting Directory

```env
# Save meetings to external drive
MEETING_DIR=/mnt/usb/meetings

# Or network share
MEETING_DIR=/mnt/nas/team_meetings
```

### Auto-Transfer with SCP

```env
AUTO_TRANSFER_MEETINGS=true
DESKTOP_TRANSFER_PATH=user@192.168.1.100:/home/user/meetings
```

Make sure SSH keys are set up for passwordless transfer:
```bash
# On Raspberry Pi
ssh-keygen -t rsa
ssh-copy-id user@192.168.1.100
```

### Adjust Maximum Duration

```env
# 8 hours maximum
MEETING_MAX_DURATION=28800

# 2 hours maximum
MEETING_MAX_DURATION=7200
```

---

## 🐛 Troubleshooting

### Meeting Won't Start

**Problem:** Triple-click doesn't activate meeting mode

**Solutions:**
1. Check `.env` has `ENABLE_MEETING_MODE=true`
2. Rebuild: `bash build.sh`
3. Restart service: `bash run_chatbot.sh`

### No Audio in Recording

**Problem:** Meeting file is empty or silent

**Solutions:**
1. Test microphone: `arecord -l`
2. Check audio levels: `alsamixer`
3. Verify sox is installed: `which sox`

### Transcription Too Slow

**Problem:** Takes too long to transcribe on desktop

**Solutions:**
1. Use smaller model: `--model medium` or `--model base`
2. Check GPU is being used (CUDA/ROCm installed)
3. Fall back to CPU: `--device cpu`

### Files Not Transferring

**Problem:** Auto-transfer doesn't work

**Solutions:**
1. Test SSH connection: `ssh user@desktop`
2. Set up SSH keys (see Advanced Options)
3. Check DESKTOP_TRANSFER_PATH is correct
4. Use manual transfer instead

---

## 💡 Tips & Best Practices

### For Best Audio Quality

1. **Position microphone** centrally in room
2. **Minimize background noise** (close windows, mute phones)
3. **Test before important meetings** - do a 30-second trial
4. **Monitor battery level** - meeting mode uses more power

### For Better Transcriptions

1. **Use large-v3 model** for best accuracy (if you have GPU)
2. **Enable VAD filtering** (automatic in script) to remove silence
3. **Review and edit** transcripts - AI isn't perfect
4. **Keep recordings** as backup - transcripts may need correction

### Workflow Recommendations

1. **Start meeting recording** - Triple-click at meeting start
2. **Take notes** - Use quick questions to capture action items
3. **Stop recording** - Triple-click at meeting end
4. **Transfer immediately** - While meeting is fresh
5. **Transcribe overnight** - Let desktop process while you sleep
6. **Review next day** - Check transcript and extract notes

---

## 📊 Comparison: Quick vs Meeting Mode

| Feature | Quick Question | Meeting Mode |
|---------|---------------|--------------|
| **Activation** | Press & hold | Triple-click |
| **Duration** | < 30 seconds | Up to 4 hours |
| **Processing** | Pi (Whisper tiny) | Desktop (Whisper large) |
| **File kept** | Temporary | Permanent |
| **Response** | Immediate | Post-meeting |
| **Quality** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Use case** | Queries | Transcription |

---

## 🚀 Future Enhancements

Potential features being considered:

- [ ] Speaker diarization (who said what)
- [ ] Real-time transcription preview
- [ ] Meeting summary with LLM
- [ ] Voice bookmarks during meeting
- [ ] Auto-pause on silence detection
- [ ] Integration with calendar apps

---

## 📝 Example Workflow

### Typical Meeting Session

```
09:00 - Triple-click → Start meeting recording
        Purple LED, "📝 Meeting recording..."

09:15 - Quick question: "What was Q3 revenue?"
        Press & hold → Ask → Get answer
        Meeting continues recording

10:30 - Triple-click → Stop meeting recording
        Green LED, "✅ Meeting saved! Duration: 90m"

10:31 - Transfer file to desktop
        scp meeting_20260103_090000.wav user@desktop:~/meetings/

11:00 - On desktop: Transcribe
        python transcribe_meeting.py meeting_20260103_090000.wav

11:10 - Review transcript
        meeting_20260103_090000_transcript.txt created
        Read, edit, extract action items
```

---

## 🆘 Support

If you encounter issues:

1. Check logs: `tail -f chatbot.log`
2. Test components individually (see Troubleshooting)
3. Review this guide
4. Open an issue on GitHub

---

**Happy meeting recording! 🎙️**
