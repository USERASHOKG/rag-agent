import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { MessageCircle, Upload, Brain, Zap, ArrowRight } from "lucide-react";
import { startLogin } from "@/const";

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-semibold text-foreground">Manus RAG Agent</h1>
            </div>
            <Button variant="outline" onClick={() => setLocation("/chat")}>
              Open Chat <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Intelligent Document Q&A
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Upload your documents and ask questions powered by AI. Get accurate answers grounded in your content with source citations.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="p-6">
              <Upload className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Easy Upload</h3>
              <p className="text-sm text-muted-foreground">
                Upload PDF and text files. Our system automatically processes and indexes your documents.
              </p>
            </Card>

            <Card className="p-6">
              <Brain className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Smart Search</h3>
              <p className="text-sm text-muted-foreground">
                Semantic search finds the most relevant content from your documents instantly.
              </p>
            </Card>

            <Card className="p-6">
              <MessageCircle className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">AI Responses</h3>
              <p className="text-sm text-muted-foreground">
                Get accurate answers with citations showing exactly where the information came from.
              </p>
            </Card>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Button size="lg" onClick={() => setLocation("/chat")} className="gap-2">
              <Zap className="w-5 h-5" />
              Start Chatting Now
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border bg-card mt-16">
          <div className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
            <p>Powered by Manus RAG Agent • Built with advanced AI and vector embeddings</p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <Brain className="w-16 h-16 text-primary mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-foreground mb-4">Manus RAG Agent</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Upload documents and chat with AI. Get intelligent answers grounded in your content.
        </p>
        <Button size="lg" onClick={() => startLogin()} className="gap-2">
          <MessageCircle className="w-5 h-5" />
          Sign In to Get Started
        </Button>
      </div>
    </div>
  );
}
