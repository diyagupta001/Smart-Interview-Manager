import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion } from "framer-motion";
import { Brain, BarChart3, Shield, Zap, CheckCircle2, ArrowRight } from "lucide-react";

const features = [
  { icon: Brain, title: "AI-Powered Questions", desc: "Adaptive questions that adjust difficulty based on candidate responses" },
  { icon: BarChart3, title: "Smart Analytics", desc: "Comprehensive scoring across technical, communication, and confidence dimensions" },
  { icon: Shield, title: "Anti-Cheating", desc: "Tab switching detection and activity monitoring for fair assessments" },
  { icon: Zap, title: "Instant Results", desc: "AI-generated scorecards and feedback delivered immediately after interview" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Brain className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight">InterviewAI</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link to="/signup">
            <Button>Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-6">
            <Zap className="h-3.5 w-3.5" />
            AI-Powered Interview Platform
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            Hire Smarter with
            <br />
            <span className="text-primary">AI Interviews</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Create job roles, generate unique interview links, and let AI conduct adaptive interviews
            with automatic scoring, anti-cheating detection, and instant results.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="gap-2">
                Start Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline">Sign In</Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 + 0.3 }}
              className="rounded-xl border bg-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="space-y-6">
          {[
            "Create job roles with required skills and difficulty levels",
            "Generate unique, time-limited interview links",
            "Candidates answer AI-adaptive questions via text or voice",
            "Get instant AI-generated scorecards and hiring decisions",
          ].map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 + 0.5 }}
              className="flex items-start gap-4"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {i + 1}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                <span className="text-muted-foreground">{step}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} InterviewAI. Built with intelligence.</p>
      </footer>
    </div>
  );
}
