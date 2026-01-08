import moment from "moment";
import {
  getCurrentTimeTag,
  getRecordFileDurationMs,
  splitSentences,
} from "./../utils/index";
import { get, noop } from "lodash";
import {
  onButtonPressed,
  onButtonReleased,
  onButtonDoubleClick,
  onButtonTripleClick,
  display,
  getCurrentStatus,
  onCameraCapture,
} from "../device/display";
import { recordAudioManually, recordFileFormat } from "../device/audio";
import {
  recognizeAudio,
  chatWithLLMStream,
  ttsProcessor,
} from "../cloud-api/server";
import { extractEmojis } from "../utils";
import { StreamResponser } from "./StreamResponsor";
import { cameraDir, recordingsDir } from "../utils/dir";
import { getLatestDisplayImg, setLatestCapturedImg } from "../utils/image";
import MeetingRecorder from "./MeetingRecorder";

class ChatFlow {
  currentFlowName: string = "";
  recordingsDir: string = "";
  currentRecordFilePath: string = "";
  asrText: string = "";
  streamResponser: StreamResponser;
  partialThinking: string = "";
  thinkingSentences: string[] = [];
  answerId: number = 0;
  enableCamera: boolean = false;
  meetingRecorder: MeetingRecorder;
  enableMeetingMode: boolean = false;

  constructor(options: { enableCamera?: boolean } = {}) {
    console.log(`[${getCurrentTimeTag()}] ChatBot started.`);
    this.recordingsDir = recordingsDir;
    this.enableMeetingMode = process.env.ENABLE_MEETING_MODE === "true";
    this.meetingRecorder = new MeetingRecorder();
    this.setCurrentFlow("sleep");
    this.streamResponser = new StreamResponser(
      ttsProcessor,
      (sentences: string[]) => {
        if (this.currentFlowName !== "answer") return;
        const fullText = sentences.join(" ");
        display({
          status: "answering",
          emoji: extractEmojis(fullText) || "😊",
          text: fullText,
          RGB: "#0000ff",
          scroll_speed: 3,
        });
      },
      (text: string) => {
        if (this.currentFlowName !== "answer") return;
        display({
          status: "answering",
          text: text || undefined,
          scroll_speed: 3,
        });
      }
    );
    if (options?.enableCamera) {
      this.enableCamera = true;
    }
  }

  async recognizeAudio(path: string): Promise<string> {
    if ((await getRecordFileDurationMs(path)) < 500) {
      console.log("[ChatFlow] Record audio too short, skipping recognition.");
      return Promise.resolve("");
    }
    
    // Add timeout and error handling for ASR
    const ASR_TIMEOUT_MS = 30000; // 30 seconds
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error("ASR timeout after 30 seconds")), ASR_TIMEOUT_MS);
    });
    
    try {
      const result = await Promise.race([
        recognizeAudio(path),
        timeoutPromise
      ]);
      return result;
    } catch (error) {
      console.error("[ChatFlow] ASR Error:", error);
      display({
        status: "error",
        emoji: "⚠️",
        text: "Voice recognition failed: " + (error instanceof Error ? error.message : "Unknown error"),
        RGB: "#ff0000",
      });
      throw error;
    }
  }

  partialThinkingCallback = (
    partialThinking: string,
  ): void => {
    this.partialThinking += partialThinking;
    const { sentences, remaining } = splitSentences(this.partialThinking);
    if (sentences.length > 0) {
      this.thinkingSentences.push(...sentences);
      const displayText = this.thinkingSentences.join(" ");
      display({
        status: "Thinking",
        emoji: "🤔",
        text: displayText,
        RGB: "#ff6800", // yellow
        scroll_speed: 6,
      });
    }
    this.partialThinking = remaining;
  };

  setCurrentFlow = (flowName: string): void => {
    console.log(`[${getCurrentTimeTag()}] switch to:`, flowName);
    switch (flowName) {
      case "sleep":
        this.currentFlowName = "sleep";
        onButtonPressed(() => {
          this.setCurrentFlow("listening");
        });
        onButtonReleased(noop);
        // camera mode
        if (this.enableCamera) {
          const captureImgPath = `${cameraDir}/capture-${moment().format(
            "YYYYMMDD-HHmmss"
          )}.jpg`;
          onButtonDoubleClick(() => {
            display({
              camera_mode: true,
              capture_image_path: captureImgPath,
            });
          });
          onCameraCapture(() => {
            setLatestCapturedImg(captureImgPath);
          });
        }
        // meeting mode
        if (this.enableMeetingMode) {
          onButtonTripleClick(() => {
            console.log(`[${getCurrentTimeTag()}] Triple-click detected - toggling meeting mode`);
            this.meetingRecorder.toggle();
          });
        }
        display({
          status: "idle",
          emoji: "😴",
          RGB: "#000055",
          ...(getCurrentStatus().text === "Listening..."
            ? {
                text: `Long Press the button to say something${
                  this.enableCamera ? ",\ndouble click to launch camera" : ""
                }${this.enableMeetingMode ? ",\ntriple click for meeting mode" : ""}.`,
              }
            : {}),
        });
        break;
      case "listening":
        this.answerId += 1;
        this.currentFlowName = "listening";
        this.currentRecordFilePath = `${
          this.recordingsDir
        }/user-${Date.now()}.${recordFileFormat}`;
        onButtonPressed(noop);
        const { result, stop } = recordAudioManually(
          this.currentRecordFilePath
        );
        onButtonReleased(() => {
          stop();
          display({
            RGB: "#ff6800", // yellow
          });
        });
        result
          .then(() => {
            console.log("[ChatFlow] Recording completed: " + this.currentRecordFilePath);
            this.setCurrentFlow("asr");
          })
          .catch((err) => {
            console.error(`[ChatFlow] Recording Error:`, err);
            display({
              status: "error",
              emoji: "🎤",
              text: "Recording failed. Please try again.",
              RGB: "#ff0000",
            });
            setTimeout(() => this.setCurrentFlow("sleep"), 3000);
          });
        display({
          status: "listening",
          emoji: "😐",
          RGB: "#00ff00",
          text: "Listening...",
        });
        break;
      case "asr":
        this.currentFlowName = "asr";
        display({
          status: "recognizing",
        });
        onButtonDoubleClick(null);
        Promise.race([
          this.recognizeAudio(this.currentRecordFilePath),
          new Promise<string>((resolve) => {
            onButtonPressed(() => {
              resolve("[UserPress]");
            });
            onButtonReleased(noop);
          }),
        ])
        .then((result) => {
          if (this.currentFlowName !== "asr") return;
          if (result === "[UserPress]") {
            console.log("[ChatFlow] User interrupted ASR with button press");
            this.setCurrentFlow("listening");
          } else {
            if (result) {
              console.log("[ChatFlow] ASR Success - Text: \"" + result + "\"");
              this.asrText = result;
              display({ status: "recognizing", text: result });
              this.setCurrentFlow("answer");
            } else {
              console.log("[ChatFlow] ASR returned empty result");
              this.setCurrentFlow("sleep");
            }
          }
        })
        .catch((error) => {
          console.error(`[ChatFlow] ASR Failed:", error);
          display({
            status: "error",
            emoji: "❌",
            text: "Could not understand audio. Please try again.",
            RGB: "#ff0000",
          });
          setTimeout(() => {
            if (this.currentFlowName === "asr") {
              this.setCurrentFlow("sleep");
            }
          }, 3000);
        });
        break;
      case "answer":
        display({
          status: "answering...",
          RGB: "#00c8a3",
        });
        this.currentFlowName = "answer";
        const currentAnswerId = this.answerId;
        onButtonPressed(() => {
          this.setCurrentFlow("listening");
        });
        onButtonReleased(noop);
        const {
          partial,
          endPartial,
          getPlayEndPromise,
          stop: stopPlaying,
        } = this.streamResponser;
        this.partialThinking = "";
        this.thinkingSentences = [];
        
        // Wrap LLM streaming with timeout and error handling
        const LLM_TIMEOUT_MS = 60000; // 60 seconds for LLM
        const llmTimeoutTimer = setTimeout(() => {
          console.error("[ChatFlow] LLM timeout after " + (LLM_TIMEOUT_MS / 1000) + " seconds");
          if (this.currentFlowName === "answer") {
            display({
              status: "error",
              emoji: "⏱️",
              text: "Response took too long. Please try again.",
              RGB: "#ff6800",
            });
            setTimeout(() => this.setCurrentFlow("sleep"), 3000);
          }
        }, LLM_TIMEOUT_MS);
        
        console.log("[ChatFlow] Starting LLM stream for: \"" + this.asrText + "\"");
        
        try {
          chatWithLLMStream(
            [
              {
                role: "user",
                content: this.asrText,
              },
            ],
            (text) => {
              clearTimeout(llmTimeoutTimer); // Clear timeout on first response
              return currentAnswerId === this.answerId && partial(text);
            },
            () => {
              clearTimeout(llmTimeoutTimer);
              console.log("[ChatFlow] LLM stream completed successfully");
              return currentAnswerId === this.answerId && endPartial();
            },
            (partialThinking) =>
              currentAnswerId === this.answerId &&
              this.partialThinkingCallback(partialThinking),
            (functionName: string, result?: string) => {
              if (result) {
                console.log("[ChatFlow] Function [" + functionName + "] returned: " + result);
                display({
                  text: "[" + functionName + "]" + result,
                });
              } else {
                console.log("[ChatFlow] Invoking function: " + functionName);
                display({
                  text: "Invoking [" + functionName + "]...",
                });
              }
            }
          ).catch((error) => {
            clearTimeout(llmTimeoutTimer);
            console.error("[ChatFlow] LLM Stream Error:", error);
            display({
              status: "error",
              emoji: "❌",
              text: "AI error: " + (error instanceof Error ? error.message : "Please try again"),
              RGB: "#ff0000",
            });
            setTimeout(() => {
              if (this.currentFlowName === "answer") {
                this.setCurrentFlow("sleep");
              }
            }, 3000);
          });
        } catch (error) {
          clearTimeout(llmTimeoutTimer);
          console.error("[ChatFlow] Failed to start LLM stream:", error);
          display({
            status: "error",
            emoji: "❌",
            text: "Could not connect to AI. Please try again.",
            RGB: "#ff0000",
          });
          setTimeout(() => this.setCurrentFlow("sleep"), 3000);
        }
        
        getPlayEndPromise().then(() => {
          if (this.currentFlowName === "answer") {
            const img = getLatestDisplayImg();
            if (img) {
              console.log("[ChatFlow] Displaying generated image: " + img);
              display({
                image: img,
              });
              this.setCurrentFlow("image");
            } else {
              console.log("[ChatFlow] No image to display, returning to sleep");
              this.setCurrentFlow("sleep");
            }
          }
        }).catch((error) => {
          console.error("[ChatFlow] Error in play end promise:", error);
          this.setCurrentFlow("sleep");
        });
        onButtonPressed(() => {
          stopPlaying();
          this.setCurrentFlow("listening");
        });
        onButtonReleased(noop);
        break;
      case "image":
        onButtonPressed(() => {
          display({ image: "" });
          this.setCurrentFlow("listening");
        });
        onButtonReleased(noop);
        break;
      default:
        console.error("Unknown flow name:", flowName);
        break;
    }
  };
}

export default ChatFlow;
