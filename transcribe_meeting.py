#!/usr/bin/env python3
"""
Meeting Transcription Script
Uses faster-whisper with GPU acceleration to transcribe long meeting recordings.

Requirements:
    pip install faster-whisper

Usage:
    python transcribe_meeting.py meeting_20260103_143022.wav
    python transcribe_meeting.py meeting_20260103_143022.wav --model large-v3
    python transcribe_meeting.py meeting_20260103_143022.wav --diarize
"""

import sys
import argparse
from pathlib import Path
from faster_whisper import WhisperModel
import json

def format_timestamp(seconds):
    """Convert seconds to HH:MM:SS format"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"

def transcribe_meeting(
    audio_path,
    model_size="large-v3",
    device="cuda",
    compute_type="float16",
    output_format="txt",
    language="en",
    diarize=False
):
    """
    Transcribe a meeting recording with Whisper
    
    Args:
        audio_path: Path to audio file
        model_size: Whisper model size (tiny, base, small, medium, large-v2, large-v3)
        device: cuda or cpu
        compute_type: float16 or int8
        output_format: txt, srt, json
        language: Language code (en, es, fr, etc.)
        diarize: Enable speaker diarization (requires pyannote.audio)
    """
    
    audio_path = Path(audio_path)
    if not audio_path.exists():
        print(f"Error: File not found: {audio_path}")
        return
    
    print(f"Loading Whisper model: {model_size} on {device}...")
    try:
        model = WhisperModel(model_size, device=device, compute_type=compute_type)
    except Exception as e:
        print(f"Error loading model with {device}, falling back to CPU...")
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
    
    print(f"Transcribing: {audio_path.name}")
    print("This may take several minutes for long recordings...")
    
    # Transcribe with VAD filtering to remove silence
    segments, info = model.transcribe(
        str(audio_path),
        language=language if language != "auto" else None,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
        beam_size=5,
        word_timestamps=True if diarize else False
    )
    
    print(f"\nDetected language: {info.language} (probability: {info.language_probability:.2%})")
    print(f"Duration: {info.duration:.1f} seconds ({format_timestamp(info.duration)})\n")
    
    # Collect all segments
    all_segments = list(segments)
    
    if not all_segments:
        print("No speech detected in audio file.")
        return
    
    # Prepare output paths
    output_dir = audio_path.parent
    base_name = audio_path.stem
    
    # Save transcript in requested format
    if output_format == "txt" or output_format == "all":
        txt_path = output_dir / f"{base_name}_transcript.txt"
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(f"Meeting Transcription\n")
            f.write(f"File: {audio_path.name}\n")
            f.write(f"Duration: {format_timestamp(info.duration)}\n")
            f.write(f"Language: {info.language}\n")
            f.write(f"=" * 80 + "\n\n")
            
            for segment in all_segments:
                timestamp = format_timestamp(segment.start)
                f.write(f"[{timestamp}] {segment.text.strip()}\n")
        
        print(f"✓ Text transcript saved: {txt_path}")
    
    if output_format == "srt" or output_format == "all":
        srt_path = output_dir / f"{base_name}_transcript.srt"
        with open(srt_path, 'w', encoding='utf-8') as f:
            for i, segment in enumerate(all_segments, 1):
                start_time = format_timestamp(segment.start).replace('.', ',')
                end_time = format_timestamp(segment.end).replace('.', ',')
                f.write(f"{i}\n")
                f.write(f"{start_time} --> {end_time}\n")
                f.write(f"{segment.text.strip()}\n\n")
        
        print(f"✓ SRT subtitles saved: {srt_path}")
    
    if output_format == "json" or output_format == "all":
        json_path = output_dir / f"{base_name}_transcript.json"
        transcript_data = {
            "file": audio_path.name,
            "duration": info.duration,
            "language": info.language,
            "segments": [
                {
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text.strip()
                }
                for segment in all_segments
            ]
        }
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(transcript_data, f, indent=2, ensure_ascii=False)
        
        print(f"✓ JSON transcript saved: {json_path}")
    
    # Print summary
    print(f"\n{'=' * 80}")
    print(f"Transcription Summary:")
    print(f"  Total segments: {len(all_segments)}")
    print(f"  Total duration: {format_timestamp(info.duration)}")
    print(f"  Average segment length: {info.duration / len(all_segments):.1f} seconds")
    print(f"{'=' * 80}\n")
    
    # Show first few segments as preview
    print("Preview (first 5 segments):")
    for segment in all_segments[:5]:
        timestamp = format_timestamp(segment.start)
        print(f"  [{timestamp}] {segment.text.strip()}")
    
    if len(all_segments) > 5:
        print(f"  ... ({len(all_segments) - 5} more segments)")

def main():
    parser = argparse.ArgumentParser(
        description="Transcribe meeting recordings with Whisper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python transcribe_meeting.py meeting.wav
  python transcribe_meeting.py meeting.wav --model large-v3
  python transcribe_meeting.py meeting.wav --format srt
  python transcribe_meeting.py meeting.wav --device cpu
        """
    )
    
    parser.add_argument("audio_file", help="Path to audio file")
    parser.add_argument(
        "--model",
        default="large-v3",
        choices=["tiny", "base", "small", "medium", "large-v2", "large-v3"],
        help="Whisper model size (default: large-v3)"
    )
    parser.add_argument(
        "--device",
        default="cuda",
        choices=["cuda", "cpu"],
        help="Device to use (default: cuda, falls back to cpu if unavailable)"
    )
    parser.add_argument(
        "--format",
        default="txt",
        choices=["txt", "srt", "json", "all"],
        help="Output format (default: txt)"
    )
    parser.add_argument(
        "--language",
        default="en",
        help="Language code (default: en, use 'auto' for auto-detection)"
    )
    parser.add_argument(
        "--diarize",
        action="store_true",
        help="Enable speaker diarization (experimental)"
    )
    
    args = parser.parse_args()
    
    transcribe_meeting(
        args.audio_file,
        model_size=args.model,
        device=args.device,
        output_format=args.format,
        language=args.language,
        diarize=args.diarize
    )

if __name__ == "__main__":
    main()
