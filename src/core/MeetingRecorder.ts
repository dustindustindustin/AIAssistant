import moment from "moment";
import { spawn, ChildProcess, exec } from "child_process";
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

  // Check available disk space before recording
  private checkDiskSpace(): Promise<boolean> {
    return new Promise((resolve) => {
      exec("df -h . | tail -1 | awk '{print $4}'", (error, stdout, stderr) => {
        if (error) {
          console.error(`[MeetingRecorder] Could not check disk space:`, error);
          // Assume we have space if check fails
          resolve(true);
          return;
        }
        const available = stdout.trim();
        console.log(`[MeetingRecorder] Available disk space: ${available}`);
        
        // Parse the size - if it ends with G (gigabytes), we're good
        // If M (megabytes), check if > 500M
        if (available.includes('G')) {
          resolve(true);
        } else if (available.includes('M')) {
          const megabytes = parseFloat(available);
          resolve(megabytes > 500);
        } else {
          // Less than 1MB or other unit
          resolve(false);
        }
      });
    });
  }

  async start(): Promise<void> {
    if (this.isRecording) {
      console.log("[MeetingRecorder] Meeting recording already in progress");
      return;
    }

    // Check disk space before starting
    const hasSpace = await this.checkDiskSpace();
    if (!hasSpace) {
      console.error("[MeetingRecorder] Insufficient disk space for recording");
      display({
        status: "error",
        emoji: "💾",
        text: "Not enough disk space!\nFree up space and try again.",
        RGB: "#ff0000",
      });
      return;
    }

    this.currentMeetingFile = `${meetingsDir}/meeting_${moment().format(
      "YYYYMMDD_HHmmss"
    )}.${recordFileFormat}`;
    this.startTime = new Date();

    console.log(`[MeetingRecorder] Starting meeting recording: ${this.currentMeetingFile}`);

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
      console.error("[MeetingRecorder] Recording process error:", error);
      display({
        status: "error",
        emoji: "❌",
        text: `Recording failed: ${error.message}`,
        RGB: "#ff0000",
      });
      this.stop();
    });

    this.recordingProcess.on("exit", (code, signal) => {
      console.log(`[MeetingRecorder] Recording process exited with code ${code}, signal ${signal}`);
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
      console.log("[MeetingRecorder] No meeting recording in progress");
      return;
    }

    console.log(`[MeetingRecorder] Stopping meeting recording`);

    if (this.recordingProcess) {
      try {
        this.recordingProcess.kill("SIGINT");
      } catch (e) {
        console.error("[MeetingRecorder] Error stopping recording process:", e);
      }
      this.recordingProcess = null;
    }

    this.isRecording = false;

    const duration = this.startTime
      ? Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000)
      : 0;

    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    // Validate file was created successfully
    setTimeout(() => {
      if (fs.existsSync(this.currentMeetingFile)) {
        const stats = fs.statSync(this.currentMeetingFile);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        if (stats.size > 0) {
          console.log(`[MeetingRecorder] Recording saved successfully:`);
          console.log(`  File: ${this.currentMeetingFile}`);
          console.log(`  Size: ${fileSizeMB} MB`);
          console.log(`  Duration: ${minutes}m ${seconds}s`);
          
          display({
            status: "meeting_saved",
            emoji: "✅",
            text: `Meeting saved! (${fileSizeMB}MB)\nDuration: ${minutes}m ${seconds}s\n${this.currentMeetingFile.split('/').pop()}`,
            RGB: "#00ff00",
            scroll_speed: 3,
          });

          // Optional: Auto-transfer to desktop
          if (process.env.AUTO_TRANSFER_MEETINGS === "true") {
            this.transferToDesktop();
          }
        } else {
          console.error(`[MeetingRecorder] Recording file is empty (0 bytes)`);
          display({
            status: "error",
            emoji: "⚠️",
            text: "Recording failed!\nFile is empty.",
            RGB: "#ff6800",
          });
        }
      } else {
        console.error(`[MeetingRecorder] Recording file was not created: ${this.currentMeetingFile}`);
        display({
          status: "error",
          emoji: "❌",
          text: "Recording failed!\nFile not found.",
          RGB: "#ff0000",
        });
      }
    }, 500); // Wait 500ms for file to be flushed to disk

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
