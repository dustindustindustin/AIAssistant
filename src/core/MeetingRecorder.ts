import moment from "moment";
import { spawn, ChildProcess } from "child_process";
import { display } from "../device/display";
import { getCurrentTimeTag } from "../utils/index";
import { meetingsDir } from "../utils/dir";
import { recordFileFormat } from "../device/audio";
import fs from "fs";

class MeetingRecorder {
  private isRecording: boolean = false;
  private currentMeetingFile: string = "";
  private recordingProcess: ChildProcess | null = null;
  private startTime: Date | null = null;
  private maxDuration: number;

  constructor() {
    // Default 4 hours, can be overridden by env var
    this.maxDuration = parseInt(process.env.MEETING_MAX_DURATION || "14400", 10) * 1000;
    
    // Ensure meetings directory exists
    if (!fs.existsSync(meetingsDir)) {
      fs.mkdirSync(meetingsDir, { recursive: true });
    }
  }

  start(): void {
    if (this.isRecording) {
      console.log("Meeting recording already in progress");
      return;
    }

    this.currentMeetingFile = `${meetingsDir}/meeting_${moment().format(
      "YYYYMMDD_HHmmss"
    )}.${recordFileFormat}`;
    this.startTime = new Date();

    console.log(`[${getCurrentTimeTag()}] Starting meeting recording: ${this.currentMeetingFile}`);

    // Start continuous recording with sox
    this.recordingProcess = spawn("sox", [
      "-t",
      "alsa",
      "default",
      "-t",
      recordFileFormat,
      "-c",
      "1",
      "-r",
      "16000",
      this.currentMeetingFile,
    ]);

    this.recordingProcess.on("error", (error) => {
      console.error("Meeting recording error:", error);
      this.stop();
    });

    this.isRecording = true;

    display({
      status: "meeting_recording",
      emoji: "📝",
      text: "Meeting recording...\nTriple-click to stop",
      RGB: "#ff00ff", // Purple/Magenta
      scroll_speed: 3,
    });

    // Auto-stop after max duration
    setTimeout(() => {
      if (this.isRecording) {
        console.log("Meeting recording max duration reached, stopping...");
        this.stop();
      }
    }, this.maxDuration);
  }

  stop(): void {
    if (!this.isRecording) {
      console.log("No meeting recording in progress");
      return;
    }

    console.log(`[${getCurrentTimeTag()}] Stopping meeting recording`);

    if (this.recordingProcess) {
      try {
        this.recordingProcess.kill("SIGINT");
      } catch (e) {
        console.error("Error stopping recording process:", e);
      }
      this.recordingProcess = null;
    }

    this.isRecording = false;

    const duration = this.startTime
      ? Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000)
      : 0;

    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    display({
      status: "meeting_saved",
      emoji: "✅",
      text: `Meeting saved!\nDuration: ${minutes}m ${seconds}s\n${this.currentMeetingFile.split('/').pop()}`,
      RGB: "#00ff00",
      scroll_speed: 3,
    });

    console.log(`Meeting recording saved: ${this.currentMeetingFile}`);
    console.log(`Duration: ${minutes} minutes ${seconds} seconds`);
    console.log(`Transfer to desktop for transcription with:`);
    console.log(`python transcribe_meeting.py ${this.currentMeetingFile}`);

    // Optional: Auto-transfer to desktop
    if (process.env.AUTO_TRANSFER_MEETINGS === "true") {
      this.transferToDesktop();
    }

    this.startTime = null;
    
    // Return to idle after 5 seconds
    setTimeout(() => {
      display({
        status: "idle",
        emoji: "😴",
        RGB: "#000055",
      });
    }, 5000);
  }

  toggle(): void {
    if (this.isRecording) {
      this.stop();
    } else {
      this.start();
    }
  }

  getStatus(): { isRecording: boolean; currentFile: string; duration: number } {
    const duration = this.startTime
      ? Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000)
      : 0;

    return {
      isRecording: this.isRecording,
      currentFile: this.currentMeetingFile,
      duration,
    };
  }

  private transferToDesktop(): void {
    const desktopPath = process.env.DESKTOP_TRANSFER_PATH;
    
    if (!desktopPath) {
      console.log("DESKTOP_TRANSFER_PATH not configured, skipping auto-transfer");
      return;
    }

    console.log(`Transferring meeting to ${desktopPath}...`);
    
    // Use scp or cp depending on if it's a network path
    const isNetworkPath = desktopPath.startsWith("//") || desktopPath.startsWith("\\\\");
    
    if (isNetworkPath) {
      // Network path - use cp or rsync
      const { spawn } = require("child_process");
      const transferProcess = spawn("cp", [this.currentMeetingFile, desktopPath]);
      
      transferProcess.on("close", (code: number) => {
        if (code === 0) {
          console.log("Meeting transferred successfully!");
        } else {
          console.error("Failed to transfer meeting file");
        }
      });
    } else {
      // Assume SSH path (user@host:/path)
      const { spawn } = require("child_process");
      const transferProcess = spawn("scp", [this.currentMeetingFile, desktopPath]);
      
      transferProcess.on("close", (code: number) => {
        if (code === 0) {
          console.log("Meeting transferred successfully!");
        } else {
          console.error("Failed to transfer meeting file");
        }
      });
    }
  }
}

export default MeetingRecorder;
