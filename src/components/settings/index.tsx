import { useState, useEffect } from "react";
import { useWindowResize } from "@/hooks";
import { SettingsIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  ScrollArea,
} from "@/components";
import { ProviderSelection } from "./ProviderSelection";
import { ApiKeyInput } from "./ApiKeyInput";
import { ModelSelection } from "./ModelSelection";
import { Disclaimer } from "./Disclaimer";
import { SystemPrompt } from "./SystemPrompt";
import { Speech } from "./Speech";

import {
  loadSettingsFromStorage,
  saveSettingsToStorage,
  fetchModels,
  getProviderById,
} from "@/lib";
import { SettingsState } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { EnhancedUploadInterface } from "../upload/EnhancedUploadInterface";

export const Settings = () => {
  const [settings, setSettings] = useState<SettingsState>(
    loadSettingsFromStorage
  );
  const { resizeWindow } = useWindowResize();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [googleConnectMessage, setGoogleConnectMessage] = useState<string | null>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(false);

  // Save to localStorage whenever settings change
  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

  // Check Google connection on mount/open
  useEffect(() => {
    const check = async () => {
      try {
        const connected = await invoke<boolean>("is_google_connected");
        setIsGoogleConnected(Boolean(connected));
      } catch {}
    };
    check();
  }, [isPopoverOpen]);

  const updateSettings = (updates: Partial<SettingsState>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const handleApiKeySubmit = async () => {
    if (!settings.apiKey.trim()) return;

    const provider = getProviderById(settings.selectedProvider);
    if (!provider) return;

    // Mark API key as submitted first
    updateSettings({
      isApiKeySubmitted: true,
      isLoadingModels: false,
      modelsFetchError: null,
      availableModels: [],
    });

    // Try to fetch models if provider supports it (custom providers don't have models endpoint)
    if (provider.models && !provider.isCustom) {
      updateSettings({ isLoadingModels: true });

      try {
        const models = await fetchModels(provider, settings.apiKey.trim());
        updateSettings({
          isLoadingModels: false,
          availableModels: models,
          modelsFetchError: null,
          // Clear selected model if it's not in the fetched models
          selectedModel: models.includes(settings.selectedModel)
            ? settings.selectedModel
            : "",
        });
      } catch (error) {
        updateSettings({
          isLoadingModels: false,
          modelsFetchError:
            error instanceof Error ? error.message : "Failed to fetch models",
          availableModels: [],
        });
      }
    } else if (
      provider.isCustom &&
      provider.defaultModel &&
      !settings.customModel
    ) {
      // For custom providers, auto-fill the default model if none is set
      updateSettings({
        customModel: provider.defaultModel,
      });
    }
  };

  const handleApiKeyDelete = () => {
    updateSettings({
      apiKey: "",
      isApiKeySubmitted: false,
      selectedModel: "",
      customModel: "",
      availableModels: [],
      isLoadingModels: false,
      modelsFetchError: null,
    });
  };

  const handleOpenAiApiKeySubmit = () => {
    if (!settings.openAiApiKey.trim()) return;
    updateSettings({
      isOpenAiApiKeySubmitted: true,
    });
  };

  const handleOpenAiApiKeyDelete = () => {
    updateSettings({
      openAiApiKey: "",
      isOpenAiApiKeySubmitted: false,
    });
  };

  const handleOpenAiKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleOpenAiApiKeySubmit();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleApiKeySubmit();
    }
  };

  const currentProvider = getProviderById(settings.selectedProvider);

  useEffect(() => {
    resizeWindow(isPopoverOpen);
  }, [isPopoverOpen, resizeWindow]);

  // Auto-close on focus loss disabled to prevent interruptions during form interactions
  // Settings should be closed manually via the toggle button for better UX
  // useWindowFocus({
  //   onFocusLost: () => {
  //     setIsPopoverOpen(false);
  //   },
  // });

  const handleConnectGoogle = async () => {
    try {
      setIsConnectingGoogle(true);
      setGoogleConnectMessage(null);
      const result = await invoke<string>("connect_google_suite");
      setGoogleConnectMessage(result);
      setIsGoogleConnected(true);
    } catch (e: any) {
      setGoogleConnectMessage(e?.toString?.() || "Failed to connect Google Suite");
      setIsGoogleConnected(false);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      setIsConnectingGoogle(true);
      const result = await invoke<string>("disconnect_google_suite");
      setGoogleConnectMessage(result);
      setIsGoogleConnected(false);
    } catch (e: any) {
      setGoogleConnectMessage(e?.toString?.() || "Failed to disconnect");
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          aria-label="Open Settings"
          className="cursor-pointer [data-state=open]:bg-[red]"
          title="Open Settings"
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      {/* Settings Panel */}
      <PopoverContent
        align="end"
        side="bottom"
        className="select-none w-screen p-0 border overflow-hidden border-input/50"
        sideOffset={8}
      >
        <ScrollArea className="h-[calc(100vh-6.5rem)]">
          <div className="p-6 space-y-4">
            {/* Configuration Header */}
            <div className="border-b border-input/50 pb-2">
              <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                AI Configuration
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configure your AI provider, authentication, and model
                preferences for the best experience.
              </p>
            </div>

            {/* Google Suite Connect */}
            <div className="flex items-center justify-between gap-2 p-3 rounded-md border border-input/50 bg-background/50">
              <div className="text-sm">
                <div className="font-medium">Connect Google Suite</div>
                <div className="text-xs text-muted-foreground">Authorize access to your Gmail and Calendar</div>
              </div>
              <div className="flex items-center gap-2">
                {googleConnectMessage && (
                  <span className="text-xs text-muted-foreground max-w-[240px] truncate" title={googleConnectMessage}>{googleConnectMessage}</span>
                )}
                {isGoogleConnected ? (
                  <Button onClick={handleDisconnectGoogle} disabled={isConnectingGoogle} size="sm" variant="secondary">
                    {isConnectingGoogle ? "Disconnecting..." : "Disconnect"}
                  </Button>
                ) : (
                  <Button onClick={handleConnectGoogle} disabled={isConnectingGoogle} size="sm">
                    {isConnectingGoogle ? "Connecting..." : "Connect"}
                  </Button>
                )}
              </div>
            </div>

            {/* AI Provider Selection */}
            <ProviderSelection
              value={settings.selectedProvider}
              onChange={(value) => {
                const selectedProvider = getProviderById(value);
                const defaultModel = selectedProvider?.isCustom
                  ? selectedProvider.defaultModel || ""
                  : "";

                updateSettings({
                  selectedProvider: value,
                  apiKey: "",
                  isApiKeySubmitted: false,
                  selectedModel: "",
                  customModel: defaultModel,
                  availableModels: [],
                  isLoadingModels: false,
                  modelsFetchError: null,
                });
              }}
            />

            {/* API Key Configuration */}
            <ApiKeyInput
              providerName={currentProvider?.name || ""}
              value={settings.apiKey}
              onChange={(value) => updateSettings({ apiKey: value })}
              onSubmit={handleApiKeySubmit}
              onDelete={handleApiKeyDelete}
              onKeyPress={handleKeyPress}
              isSubmitted={settings.isApiKeySubmitted}
            />

            {/* Model Selection */}
            <ModelSelection
              provider={settings.selectedProvider}
              selectedModel={settings.selectedModel}
              customModel={settings.customModel}
              onModelChange={(value) =>
                updateSettings({
                  selectedModel: value.replace("models/", ""),
                })
              }
              onCustomModelChange={(value) =>
                updateSettings({ customModel: value })
              }
              disabled={!settings.isApiKeySubmitted}
              availableModels={settings.availableModels}
              isLoadingModels={settings.isLoadingModels}
              modelsFetchError={settings.modelsFetchError}
            />

            {/* Speech-to-Text Configuration (only show for non-OpenAI providers) */}
            {settings.selectedProvider &&
              settings.selectedProvider !== "openai" && (
                <Speech
                  value={settings.openAiApiKey}
                  onChange={(value) => updateSettings({ openAiApiKey: value })}
                  onSubmit={handleOpenAiApiKeySubmit}
                  onDelete={handleOpenAiApiKeyDelete}
                  onKeyPress={handleOpenAiKeyPress}
                  isSubmitted={settings.isOpenAiApiKeySubmitted}
                />
              )}

            {/* System Prompt */}
            <SystemPrompt
              value={settings.systemPrompt}
              onChange={(value) => updateSettings({ systemPrompt: value })}
            />

            {/* Enhanced Document Upload Interface */}
            <EnhancedUploadInterface />
          </div>

          <div className="pb-4 flex items-center justify-center">
            <a
              href="https://www.srikanthnani.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground text-center font-medium"
            >
              ArkAngel
            </a>
          </div>
        </ScrollArea>

        <div className="border-t border-input/50">
          <Disclaimer />
        </div>
      </PopoverContent>
    </Popover>
  );
};
