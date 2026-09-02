import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Mic, MicOff, Volume2, VolumeX, Play, Pause, RotateCcw, Clock, AlertTriangle, Loader2, CheckCircle2, XCircle, ArrowRight, Camera, CameraOff, Video, Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ANSWER_LANGUAGE_OPTIONS,
  DEFAULT_LANGUAGE_CODE,
  getLanguage,
  type AnswerLanguageOption,
} from "@/lib/languages";

type Phase = "loading" | "expired" | "welcome" | "interview" | "analyzing" | "result";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  difficulty: string;
  question_order: number;
}

interface Score {
  technical_score: number;
  communication_score: number;
  confidence_score: number;
  overall_rating: number;
  decision: string;
  ai_feedback: string;
}

export default function InterviewFlow() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  // State
  const [phase, setPhase] = useState<Phase>("loading");
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobSkills, setJobSkills] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(8);
  const [timePerQuestion, setTimePerQuestion] = useState(120);
  const [linkId, setLinkId] = useState("");
  const [interviewId, setInterviewId] = useState("");

  // Language selection
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([DEFAULT_LANGUAGE_CODE]);
  const [language, setLanguage] = useState<string>(DEFAULT_LANGUAGE_CODE);
  const [answerLanguage, setAnswerLanguage] = useState<AnswerLanguageOption>("same");
  const sessionKey = `intervia:interview:${token ?? ""}`;
  const speechLocale = getLanguage(
    answerLanguage === "english" ? "en" : language,
  ).locale;

  // Interview state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answer, setAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [tabWarnings, setTabWarnings] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Webcam state
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [webcamError, setWebcamError] = useState("");
  const [faceDetected, setFaceDetected] = useState(true);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const welcomeVideoRef = useRef<HTMLVideoElement | null>(null);
  const interviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const mobileVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceCheckIntervalRef = useRef<any>(null);

  // Helper: attach stream to a video element
  const attachStream = (el: HTMLVideoElement | null) => {
    if (el && webcamStreamRef.current) {
      el.srcObject = webcamStreamRef.current;
    }
  };

  // Result
  const [score, setScore] = useState<Score | null>(null);

  const timerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  // Load interview link
  useEffect(() => {
    if (!token) return;
    loadLink();
  }, [token]);

  const loadLink = async () => {
    const { data, error } = await supabase.functions.invoke("interview-session", {
      body: { action: "load", token },
    });

    if (error || !data?.valid) { setPhase("expired"); return; }

    const job = data.job;
    setLinkId(data.linkId);
    setJobTitle(job.title);
    setJobDescription(job.description);
    setJobSkills(job.required_skills || []);
    setQuestionCount(job.question_count);
    setTimePerQuestion(job.time_per_question);
    setCandidateName(data.candidateName || "");
    setCandidateEmail(data.candidateEmail || "");
    setPhase("welcome");
  };

  // Webcam: start stream
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" }, audio: false });
      webcamStreamRef.current = stream;
      attachStream(welcomeVideoRef.current);
      attachStream(interviewVideoRef.current);
      attachStream(mobileVideoRef.current);
      setWebcamEnabled(true);
      setWebcamError("");
    } catch (err: any) {
      console.error("Webcam error:", err);
      setWebcamError("Camera access denied. Please allow camera access to proceed.");
      setWebcamEnabled(false);
    }
  };

  // Webcam: stop stream
  const stopWebcam = () => {
    webcamStreamRef.current?.getTracks().forEach(t => t.stop());
    webcamStreamRef.current = null;
    setWebcamEnabled(false);
    if (faceCheckIntervalRef.current) clearInterval(faceCheckIntervalRef.current);
  };

  // Re-attach stream when phase changes and video elements mount
  useEffect(() => {
    attachStream(welcomeVideoRef.current);
    attachStream(interviewVideoRef.current);
    attachStream(mobileVideoRef.current);
  }, [phase, webcamEnabled]);

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => stopWebcam();
  }, []);

  // Determine violation type from reason string
  const getViolationType = (reason: string): string => {
    if (reason.toLowerCase().includes("tab switch")) return "tab_switch";
    if (reason.toLowerCase().includes("no face")) return "no_face";
    if (reason.toLowerCase().includes("focus") || reason.toLowerCase().includes("blur")) return "window_blur";
    if (reason.toLowerCase().includes("window")) return "new_window";
    if (reason.toLowerCase().includes("copy")) return "copy_attempt";
    return "shortcut_blocked";
  };

  // Anti-cheating: unified violation handler
  const registerViolation = useCallback((reason: string) => {
    const violationType = getViolationType(reason);

    setTabWarnings(prev => {
      const next = prev + 1;
      if (next >= 3) {
        toast({ title: "⚠️ Interview auto-submitted", description: "Too many violations detected.", variant: "destructive" });
        autoSubmit();
      } else {
        toast({ title: `⚠️ Warning ${next}/3`, description: `${reason}. This activity is being monitored.`, variant: "destructive" });
      }
      if (interviewId) {
        supabase.functions.invoke("interview-session", {
          body: {
            action: "violation",
            interviewId,
            violationType,
            description: reason,
            count: next,
          },
        }).then(() => {});
      }
      return next;
    });
  }, [interviewId]);

  // Anti-cheating: tab switch detection
  useEffect(() => {
    if (phase !== "interview") return;

    const handleVisibility = () => {
      if (document.hidden) registerViolation("Tab switch detected");
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase, registerViolation]);

  // Anti-cheating: block window.open, new tabs, right-click, dev tools shortcuts
  useEffect(() => {
    if (phase !== "interview") return;

    // Intercept window.open
    const originalOpen = window.open;
    window.open = (...args) => {
      registerViolation("Attempted to open a new window");
      return null;
    };

    // Block blur (catches alt-tab / clicking outside browser)
    const handleBlur = () => {
      registerViolation("Window lost focus");
    };

    // Block right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      toast({ title: "Right-click disabled", description: "Right-click is not allowed during the interview.", variant: "destructive" });
    };

    // Block keyboard shortcuts for opening new tabs/windows/search
    const handleKeyDown = (e: KeyboardEvent) => {
      const blocked = (
        (e.ctrlKey && e.key === "t") || // new tab
        (e.ctrlKey && e.key === "n") || // new window
        (e.ctrlKey && e.key === "w") || // close tab
        (e.ctrlKey && e.shiftKey && e.key === "N") || // incognito
        (e.ctrlKey && e.key === "l") || // address bar
        (e.key === "F5") || // refresh
        (e.ctrlKey && e.key === "r") || // refresh
        (e.key === "F12") || // dev tools
        (e.ctrlKey && e.shiftKey && e.key === "I") || // dev tools
        (e.ctrlKey && e.shiftKey && e.key === "J") || // console
        (e.ctrlKey && e.key === "u") // view source
      );
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        toast({ title: "Action blocked", description: "This action is not allowed during the interview.", variant: "destructive" });
      }
    };

    // Block copy/paste to discourage web lookups
    const handleCopy = (e: ClipboardEvent) => {
      // Allow paste in the answer textarea only
      if (e.type === "copy") {
        e.preventDefault();
        toast({ title: "Copy disabled", description: "Copying content is not allowed during the interview.", variant: "destructive" });
      }
    };

    window.addEventListener("blur", handleBlur);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("copy", handleCopy);

    return () => {
      window.open = originalOpen;
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("copy", handleCopy);
    };
  }, [phase, registerViolation]);

  // Webcam: face presence check using canvas brightness analysis
  useEffect(() => {
    if (phase !== "interview" || !webcamEnabled) return;

    let noFaceCount = 0;

    faceCheckIntervalRef.current = setInterval(() => {
      const video = interviewVideoRef.current || mobileVideoRef.current;
      if (!video || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx || video.readyState < 2) return;

      canvas.width = 160;
      canvas.height = 120;
      ctx.drawImage(video, 0, 0, 160, 120);
      const imageData = ctx.getImageData(0, 0, 160, 120);
      const data = imageData.data;

      let skinPixels = 0;
      const total = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15 && r - b > 15) {
          skinPixels++;
        }
      }

      const skinRatio = skinPixels / total;
      if (skinRatio < 0.05) {
        noFaceCount++;
        setFaceDetected(false);
        if (noFaceCount >= 3) {
          registerViolation("No face detected in webcam");
          noFaceCount = 0;
        }
      } else {
        noFaceCount = 0;
        setFaceDetected(true);
      }
    }, 3000);

    return () => clearInterval(faceCheckIntervalRef.current);
  }, [phase, webcamEnabled, registerViolation]);

  // Timer
  useEffect(() => {
    if (phase !== "interview" || questions.length === 0) return;
    setTimeLeft(timePerQuestion);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleNextQuestion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [currentQ, questions.length, phase]);

  // Start interview
  const startInterview = async () => {
    const { data: started, error: startError } = await supabase.functions.invoke("interview-session", {
      body: { action: "start", token },
    });

    if (startError || !started?.interviewId) {
      toast({ title: "Error starting interview", variant: "destructive" });
      return;
    }
    const interview = { id: started.interviewId as string };
    setInterviewId(interview.id);

    // Generate questions via edge function
    setPhase("loading");
    try {
      const { data, error } = await supabase.functions.invoke("generate-questions", {
        body: { interviewId: interview.id, jobTitle, jobDescription, skills: jobSkills, questionCount, difficulty: "adaptive" },
      });

      if (error) throw error;
      const qs = data?.questions || [];
      setQuestions(qs);
      setPhase("interview");
    } catch (err) {
      console.error("Failed to generate questions:", err);
      // Fallback: generate basic questions
      const fallbackQs = generateFallbackQuestions(interview.id);
      setQuestions(fallbackQs);
      setPhase("interview");
    }
  };

  const generateFallbackQuestions = (intId: string): Question[] => {
    const types = ["technical", "hr", "scenario"] as const;
    const baseQuestions = [
      `Tell me about your experience with ${jobSkills[0] || jobTitle}.`,
      `What makes you a good fit for a ${jobTitle} position?`,
      `Describe a challenging project you've worked on.`,
      `How do you handle tight deadlines?`,
      `What's your approach to learning new technologies?`,
      `Describe a time you disagreed with a team member.`,
      `Where do you see yourself in 3 years?`,
      `What questions do you have about this role?`,
    ];

    return baseQuestions.slice(0, questionCount).map((q, i) => ({
      id: `fallback-${i}`,
      question_text: q,
      question_type: types[i % 3],
      difficulty: i < 3 ? "easy" : i < 6 ? "medium" : "hard",
      question_order: i,
    }));
  };

  // Submit answer and move to next
  const handleNextQuestion = async () => {
    if (submitting) return;
    setSubmitting(true);

    const q = questions[currentQ];
    if (q && interviewId) {
      await supabase.functions.invoke("interview-session", {
        body: {
          action: "answer",
          interviewId,
          questionId: q.id,
          answerText: answer || "(No answer provided)",
          timeTakenSeconds: timePerQuestion - timeLeft,
        },
      });
    }

    clearInterval(timerRef.current);
    setAnswer("");
    setSubmitting(false);

    if (currentQ >= questions.length - 1) {
      // Interview complete
      finishInterview();
    } else {
      setCurrentQ(prev => prev + 1);
    }
  };

  const autoSubmit = async () => {
    await supabase.functions.invoke("interview-session", {
      body: { action: "complete", interviewId, status: "auto_submitted" },
    });
    evaluateInterview();
  };

  const finishInterview = async () => {
    await supabase.functions.invoke("interview-session", {
      body: { action: "complete", interviewId, status: "completed" },
    });
    evaluateInterview();
  };

  const evaluateInterview = async () => {
    setPhase("analyzing");

    try {
      const { data, error } = await supabase.functions.invoke("evaluate-interview", {
        body: { interviewId },
      });

      if (error) throw error;
      setScore(data?.score || { technical_score: 65, communication_score: 70, confidence_score: 60, overall_rating: 65, decision: "pending", ai_feedback: "Evaluation completed." });
    } catch (err) {
      console.error("Evaluation error:", err);
      setScore({ technical_score: 65, communication_score: 70, confidence_score: 60, overall_rating: 65, decision: "pending", ai_feedback: "Thank you for completing the interview." });
    }

    setTimeout(() => setPhase("result"), 3000);
  };

  // Voice input (Web Speech API)
  const toggleVoice = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      toast({ title: "Speech recognition not supported in this browser", variant: "destructive" });
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setAnswer(transcript);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  // TTS
  const speakQuestion = () => {
    if (isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const q = questions[currentQ];
    if (!q) return;
    const utterance = new SpeechSynthesisUtterance(q.question_text);
    utterance.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
    speechSynthesis.speak(utterance);
  };

  const replayQuestion = () => {
    speechSynthesis.cancel();
    const q = questions[currentQ];
    if (!q) return;
    const utterance = new SpeechSynthesisUtterance(q.question_text);
    utterance.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
    speechSynthesis.speak(utterance);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // RENDER
  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Preparing your interview...</p>
        </div>
      </div>
    );
  }

  if (phase === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md text-center">
          <CardContent className="py-12">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Link Expired or Invalid</h2>
            <p className="text-muted-foreground">This interview link has expired or has already been used. Please contact the HR team for a new link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "welcome") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="max-w-lg">
            <CardHeader className="text-center">
              <Brain className="h-10 w-10 text-primary mx-auto mb-2" />
              <CardTitle className="text-2xl">AI Interview</CardTitle>
              <p className="text-muted-foreground">{jobTitle}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <p>📝 You'll answer <strong>{questionCount} questions</strong></p>
                <p>⏱️ <strong>{timePerQuestion} seconds</strong> per question</p>
                <p>🎤 You can type or use voice input</p>
                <p>🔊 Questions can be read aloud</p>
                <p>📹 Webcam monitoring is required throughout</p>
                <p>⚠️ Tab switching & window changes are monitored</p>
                <p>🚫 Opening new tabs, right-click, and copy are disabled</p>
                <p>🔒 3 violations will auto-submit your interview</p>
              </div>

              {/* Webcam permission */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Camera Access</span>
                  </div>
                  {webcamEnabled ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>
                  ) : (
                    <Badge variant="outline">Required</Badge>
                  )}
                </div>
                {webcamEnabled ? (
                  <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-w-[240px] mx-auto">
                    <video ref={welcomeVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={startWebcam} className="w-full gap-2">
                    <Camera className="h-4 w-4" /> Enable Camera
                  </Button>
                )}
                {webcamError && <p className="text-xs text-destructive">{webcamError}</p>}
              </div>

              <div className="space-y-2">
                <Label>Your Name</Label>
                <Input value={candidateName} onChange={e => setCandidateName(e.target.value)} placeholder="Enter your name" />
              </div>
              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input type="email" value={candidateEmail} onChange={e => setCandidateEmail(e.target.value)} placeholder="your@email.com" />
              </div>
              <Button onClick={startInterview} disabled={!candidateName.trim() || !webcamEnabled} className="w-full gap-2">
                Start Interview <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (phase === "analyzing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative mx-auto mb-6 h-20 w-20">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring" />
            <div className="absolute inset-2 rounded-full bg-primary/30 animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
            <div className="absolute inset-4 flex items-center justify-center rounded-full bg-primary">
              <Brain className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-2">Analyzing your responses...</h2>
          <p className="text-muted-foreground">Our AI is evaluating your performance</p>
        </motion.div>
      </div>
    );
  }

  if (phase === "result" && score) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          <Card>
            <CardContent className="py-8 text-center space-y-6">
              {score.decision === "selected" ? (
                <div className="space-y-2">
                  <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
                  <h2 className="text-2xl font-bold">Congratulations! 🎉</h2>
                  <p className="text-muted-foreground">You've been selected for the next round</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <XCircle className="h-16 w-16 text-destructive mx-auto" />
                  <h2 className="text-2xl font-bold">Thank you for participating</h2>
                  <p className="text-muted-foreground">Unfortunately, you were not selected this time</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Technical", value: score.technical_score },
                  { label: "Communication", value: score.communication_score },
                  { label: "Confidence", value: score.confidence_score },
                ].map(s => (
                  <div key={s.label} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <Progress value={s.value} className="h-1.5" />
                  </div>
                ))}
              </div>

              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium mb-1">Overall Score</p>
                <p className="text-4xl font-bold text-primary">{score.overall_rating}/100</p>
              </div>

              {score.ai_feedback && (
                <div className="text-left rounded-lg border p-4">
                  <p className="text-sm font-medium mb-2">AI Feedback</p>
                  <p className="text-sm text-muted-foreground">{score.ai_feedback}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // INTERVIEW PHASE
  const q = questions[currentQ];
  if (!q) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Hidden canvas for face detection */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">{jobTitle}</span>
        </div>
        <div className="flex items-center gap-4">
          {!faceDetected && (
            <Badge variant="destructive" className="gap-1 animate-pulse">
              <CameraOff className="h-3 w-3" /> No face detected
            </Badge>
          )}
          {tabWarnings > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> {tabWarnings} warning{tabWarnings > 1 ? "s" : ""}
            </Badge>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Progress */}
      <div className="px-6 py-3 border-b">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Question {currentQ + 1} of {questions.length}</span>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className={timeLeft <= 10 ? "text-destructive font-bold" : ""}>{formatTime(timeLeft)}</span>
          </div>
        </div>
        <Progress value={((currentQ + 1) / questions.length) * 100} className="h-2" />
      </div>

      {/* Main content with webcam sidebar */}
      <div className="flex">
        {/* Question area */}
        <div className="flex-1 max-w-3xl mx-auto px-6 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{q.question_type}</Badge>
                  <Badge variant="outline">{q.difficulty}</Badge>
                </div>
                <h2 className="text-xl font-semibold">{q.question_text}</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={speakQuestion} className="gap-1">
                    {isSpeaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                    {isSpeaking ? "Stop" : "Listen"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={replayQuestion} className="gap-1">
                    <RotateCcw className="h-3 w-3" /> Replay
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Textarea
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={6}
                  className="resize-none"
                />
                <div className="flex items-center justify-between">
                  <Button
                    variant={isRecording ? "destructive" : "outline"}
                    size="sm"
                    onClick={toggleVoice}
                    className="gap-2"
                  >
                    {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    {isRecording ? "Stop Recording" : "Voice Input"}
                  </Button>
                  <Button onClick={handleNextQuestion} disabled={submitting} className="gap-2">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {currentQ >= questions.length - 1 ? "Submit Interview" : "Next Question"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Webcam feed - fixed sidebar */}
        {webcamEnabled && (
          <div className="hidden md:block w-64 p-4 border-l">
            <div className="sticky top-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <div className={`h-2 w-2 rounded-full ${faceDetected ? 'bg-green-500' : 'bg-destructive animate-pulse'}`} />
                {faceDetected ? "Monitoring active" : "Face not detected"}
              </div>
              <div className={`relative rounded-lg overflow-hidden bg-black aspect-video border-2 ${faceDetected ? 'border-green-500/30' : 'border-destructive'}`}>
                <video ref={(el) => { interviewVideoRef.current = el; attachStream(el); }} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute top-1 right-1">
                  <div className="flex items-center gap-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    REC
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">Your webcam is being monitored</p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile webcam - floating pip */}
      {webcamEnabled && (
        <div className="md:hidden fixed bottom-4 right-4 z-50">
          <div className={`relative w-28 h-20 rounded-lg overflow-hidden border-2 shadow-lg ${faceDetected ? 'border-green-500/30' : 'border-destructive'}`}>
            <video ref={(el) => { mobileVideoRef.current = el; attachStream(el); }} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute top-0.5 right-0.5">
              <div className="flex items-center gap-0.5 bg-black/60 text-white text-[8px] px-1 py-0.5 rounded">
                <div className="h-1 w-1 rounded-full bg-red-500 animate-pulse" />
                REC
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
