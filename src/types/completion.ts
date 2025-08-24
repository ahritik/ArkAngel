// Completion-related types
export interface AttachedFile {
  id: string;
  name: string;
  type: string;
  base64: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  attachedFiles?: AttachedFile[];
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface CompletionState {
  input: string;
  response: string;
  isLoading: boolean;
  error: string | null;
  attachedFiles: AttachedFile[];
  currentConversationId: string | null;
  conversationHistory: ChatMessage[];
}

// Provider-related types
export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  chatEndpoint: string;
  authType: "bearer" | "x-api-key" | "query";
  authParam?: string;
  defaultModel: string;
  response: {
    contentPath: string;
    usagePath: string;
  };
  input: {
    text: {
      placement: string;
      exampleStructure: any;
    };
    image: {
      type: string;
      placement: string;
      exampleStructure: any;
    };
  };
  models: {
    endpoint: string;
    method: string;
    responsePath: string;
    idKey: string;
  } | null;
}
