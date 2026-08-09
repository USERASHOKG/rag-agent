import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { FileUp, Send, Trash2, MessageCircle, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Helper function to convert ArrayBuffer to base64 safely in browser
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

export default function RAGChat() {
  const { user } = useAuth();
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      sources?: Array<{ chunkId: number; text: string; documentName: string; similarity: number }>;
    }>
  >([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: documents, isLoading: docsLoading, refetch: refetchDocs } = trpc.rag.listDocuments.useQuery();
  const uploadMutation = trpc.rag.uploadDocument.useMutation();
  const deleteMutation = trpc.rag.deleteDocument.useMutation();
  const queryMutation = trpc.rag.queryRAG.useMutation();
  const historyQuery = trpc.rag.getChatHistory.useQuery({
    documentId: selectedDocumentId || undefined,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load chat history when document changes
  useEffect(() => {
    if (historyQuery.data) {
      const formattedMessages = historyQuery.data.map((msg, idx) => ({
        id: `${msg.id}`,
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));
      setMessages(formattedMessages);
    }
  }, [historyQuery.data]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["application/pdf", "text/plain", "text/markdown"].includes(file.type)) {
      toast.error("Please upload a PDF or text file");
      return;
    }

    const buffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    setIsLoading(true);

    try {
      await uploadMutation.mutateAsync({
        fileName: file.name,
        fileBase64: base64,
        mimeType: file.type as "application/pdf" | "text/plain" | "text/markdown",
      });
      toast.success(`Document "${file.name}" uploaded and processed successfully`);
      refetchDocs();
      setMessages([]);
    } catch (error) {
      toast.error("Failed to upload document. Please try again.");
      if (error instanceof Error) {
        console.error("Upload error:", error.message);
      } else {
        console.error("Upload error:", error);
      }
    } finally {
      setIsLoading(false);
      e.target.value = "";
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    try {
      await deleteMutation.mutateAsync({ documentId: docId });
      toast.success("Document deleted");
      refetchDocs();
      if (selectedDocumentId === docId) {
        setSelectedDocumentId(null);
        setMessages([]);
      }
    } catch (error) {
      toast.error("Failed to delete document");
    }
  };

  const handleSendQuery = async () => {
    if (!query.trim()) return;

    const userMessage = query;
    setQuery("");
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const result = await queryMutation.mutateAsync({
        query: userMessage,
        documentId: selectedDocumentId || undefined,
        topK: 5,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.response,
          sources: result.sources,
        },
      ]);
    } catch (error) {
      toast.error("Failed to process query");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Document Library */}
      <div className="w-80 border-r border-border bg-sidebar flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-semibold text-sidebar-foreground mb-2">Documents</h1>
          <p className="text-sm text-muted-foreground">Upload and manage your documents</p>
        </div>

        {/* Upload Area */}
        <div className="p-4">
          <label className="block">
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleFileUpload}
              disabled={isLoading}
              className="hidden"
            />
            <div className="border-2 border-dashed border-sidebar-border rounded-lg p-4 text-center cursor-pointer hover:border-sidebar-primary transition-colors">
              <FileUp className="w-6 h-6 mx-auto mb-2 text-sidebar-muted-foreground" />
              <p className="text-sm font-medium text-sidebar-foreground">Upload Document</p>
              <p className="text-xs text-sidebar-muted-foreground mt-1">PDF or Text</p>
            </div>
          </label>
        </div>

        {/* Documents List */}
        <div className="flex-1 overflow-y-auto px-4 space-y-2">
          {docsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="w-5 h-5" />
            </div>
          ) : documents && documents.length > 0 ? (
            documents.map((doc) => (
              <div
                key={doc.id}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedDocumentId === doc.id
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80"
                }`}
                onClick={() => {
                  setSelectedDocumentId(doc.id);
                  setMessages([]);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate flex items-center gap-2">
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      {doc.fileName}
                    </p>
                    <p className="text-xs opacity-75 mt-1">{doc.totalChunks} chunks</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDocument(doc.id);
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm text-sidebar-muted-foreground">No documents yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {selectedDocumentId && documents
              ? documents.find((d) => d.id === selectedDocumentId)?.fileName
              : "RAG Chat"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {selectedDocumentId ? "Ask questions about this document" : "Select a document to start"}
          </p>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground mb-4 opacity-30" />
              <p className="text-lg font-medium text-foreground mb-2">
                {selectedDocumentId ? "Start a conversation" : "Select a document"}
              </p>
              <p className="text-sm text-muted-foreground max-w-sm">
                {selectedDocumentId
                  ? "Ask questions about the selected document and get AI-powered answers with source citations."
                  : "Choose a document from the library to begin asking questions."}
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-2xl rounded-lg px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  }`}
                >
                  <div className="text-sm">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>

                  {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <p className="text-xs font-medium opacity-70 mb-2">Sources:</p>
                      <div className="space-y-1">
                        {msg.sources.map((source, idx) => (
                          <div key={idx} className="text-xs opacity-60 line-clamp-2">
                            <span className="font-medium">{source.documentName}</span> (
                            {(source.similarity * 100).toFixed(0)}%)
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border bg-card p-4">
          <div className="flex gap-3">
            <Input
              placeholder={selectedDocumentId ? "Ask a question..." : "Select a document first..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSendQuery()}
              disabled={!selectedDocumentId || isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSendQuery}
              disabled={!selectedDocumentId || isLoading || !query.trim()}
              size="icon"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
