"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer, generator } from "@/constants";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

interface AgentProps {
  userName: string;
  userId: string;
  type: string;
  interviewId?: string;
  questions?: string[];
}

interface Message {
  type: string;
  transcriptType?: string;
  role?: "user" | "system" | "assistant";
  transcript?: string;
  functionCall?: {
    name: string;
    parameters: unknown;
  };
}

const Agent = ({ userName, userId, type, interviewId, questions }: AgentProps) => {
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");
  // Prevent the post-call action (navigate / generate feedback) from firing more
  // than once. The combined effect below re-runs whenever `messages` changes,
  // so without this guard it would call router.push / createFeedback on every
  // late-arriving transcript while callStatus is already FINISHED.
  const hasHandledCallEnd = useRef(false);
  // Always hold the latest messages so the feedback action captures the full
  // transcript even though it's triggered from the callStatus effect.
  const messagesRef = useRef<SavedMessage[]>([]);

  useEffect(() => {
    const onCallStart = () => {
      setCallStatus(CallStatus.ACTIVE);
    };

    const onCallEnd = () => {
      setCallStatus(CallStatus.FINISHED);
    };

    const onMessage = (message: Message) => {
      if (
        message.type === "transcript" &&
        message.transcriptType === "final" &&
        message.role &&
        message.transcript
      ) {
        const newMessage: SavedMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => [...prev, newMessage]);
      }

      // Client-side tool calling: CreateFunctionToolDTO (tools array) sends
      // "tool-calls" messages (NOT "function-call") to the client by default.
      // Arguments arrive as a JSON string and must be parsed.
      if (message.type === "tool-calls") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolCallList = (message as any).toolCallList as Array<{
          id: string;
          function: { name: string; arguments: string | Record<string, unknown> };
        }>;

        const toolCall = toolCallList?.find(
          (tc) => tc.function.name === "generateInterview"
        );
        if (!toolCall) return;

        const args =
          typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;

        fetch("/api/vapi/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...args, userid: userId }),
        })
          .then((res) => res.json())
          .then((data) => {
            vapi.send({
              type: "add-message",
              message: {
                role: "tool" as const,
                tool_call_id: toolCall.id,
                content: data.success
                  ? "Interview generated successfully."
                  : "Failed to generate interview.",
              },
            });
          })
          .catch(() => {
            vapi.send({
              type: "add-message",
              message: {
                role: "tool" as const,
                tool_call_id: toolCall.id,
                content: "Failed to generate interview.",
              },
            });
          });
      }
    };

    const onSpeechStart = () => {
      setIsSpeaking(true);
    };

    const onSpeechEnd = () => {
      setIsSpeaking(false);
    };

    const onError = (error: Error) => {
      console.log("Error:", error);
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
    };
  }, []);


  // Keep ref in sync so the callStatus effect always sees the latest messages.
  messagesRef.current = messages;

  // Update the displayed transcript line whenever a new message arrives.
  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }
  }, [messages]);

  // Handle end-of-call navigation / feedback generation exactly once.
  useEffect(() => {
    if (callStatus !== CallStatus.FINISHED || hasHandledCallEnd.current) return;
    hasHandledCallEnd.current = true;

    if (type === "generate") {
      router.push("/");
    } else {
      // Use keepalive:true so the browser keeps the request alive even after
      // the client-side navigation below — this guarantees feedback is saved.
      fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          userId,
          transcript: messagesRef.current,
        }),
        keepalive: true,
      });
      router.push(`/interview/${interviewId}/feedback`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus]);

  const handleDisconnect = () => {
    setCallStatus(CallStatus.FINISHED);
    vapi.stop();
  };

  const handleCall = async () => {
    setCallStatus(CallStatus.CONNECTING);
    // Reset guard so a second call in the same session works correctly.
    hasHandledCallEnd.current = false;

    try {
      if (type === "generate") {
        await vapi.start(generator);
      } else {
        const formattedQuestions = questions
          ? questions.map((q: string) => `- ${q}\n`).join("\n")
          : "";
        await vapi.start(interviewer, {
          variableValues: {
            questions: formattedQuestions,
          },
        });
      }
    } catch (error) {
      console.error("Failed to start call:", error);
      setCallStatus(CallStatus.INACTIVE);
    }
  };

  return (
    <>
      <div className="call-view">
        {/* AI Interviewer Card */}
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="profile-image"
              width={65}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        {/* User Profile Card */}
        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.png"
              alt="profile-image"
              width={539}
              height={539}
              className="rounded-full object-cover size-[120px]"
            />
            <h3>{userName}</h3>
          </div>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="transcript-border my-5">
          <div className="transcript">
            <p
              key={lastMessage}
              className={cn(
                "transition-opacity duration-500 opacity-0",
                "animate-fadeIn opacity-100"
              )}
            >
              {lastMessage}
            </p>
          </div>
        </div>
      )}

      <div className="w-full flex justify-center">
        {callStatus !== CallStatus.ACTIVE ? (
          <button
            className="relative btn-call mt-4"
            onClick={handleCall}
            disabled={callStatus === CallStatus.CONNECTING}
          >
            <span
              className={cn(
                "absolute animate-ping rounded-full opacity-75",
                callStatus !== CallStatus.CONNECTING && "hidden"
              )}
            />
            <span className="relative">
              {callStatus === CallStatus.INACTIVE || callStatus === CallStatus.FINISHED
                ? "Call"
                : ". . ."}
            </span>
          </button>
        ) : (
          <button className="btn-disconnect my-3" onClick={handleDisconnect}>
            End
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;
