import React, { useState, useEffect } from "react";
import {
  Settings,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
  Button,
  ScrollArea,
} from "@/components";
import { getAvailableIntegrations, Integration } from "./integrationDefinitions";
import { useWindowResize, useWindowFocus } from "@/hooks";

interface IntegrationsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Integrations: React.FC<IntegrationsProps> = ({
  isOpen,
  onClose,
}) => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const { resizeWindow } = useWindowResize();

  // Initialize integrations
  useEffect(() => {
    if (isOpen) {
      initializeIntegrations();
    }
  }, [isOpen]);

  // Match ChatHistory: resize window when popover open state changes
  useEffect(() => {
    resizeWindow(isOpen);
  }, [isOpen, resizeWindow]);

  // Close when window focus is lost (like ChatHistory)
  useWindowFocus({
    onFocusLost: () => {
      onClose();
    },
  });

  const updateIntegration = (integrationId: string, updates: Partial<Integration>) => {
    setIntegrations(prev => prev.map(integration =>
      integration.id === integrationId
        ? { ...integration, ...updates }
        : integration
    ));
  };

  const initializeIntegrations = async () => {
    const availableIntegrations = await getAvailableIntegrations();
    setIntegrations(availableIntegrations);
  };

  const handleConnect = async (integrationId: string) => {
    const integration = integrations.find(i => i.id === integrationId);
    if (integration) {
      updateIntegration(integrationId, { isConnecting: true, connectMessage: null });

      try {
        await integration.connect();
        updateIntegration(integrationId, {
          isConnecting: false,
          connectMessage: "Connected successfully",
          isConnected: true
        });
      } catch (e: any) {
        updateIntegration(integrationId, {
          isConnecting: false,
          connectMessage: e?.toString?.() || "Failed to connect",
          isConnected: false
        });
      }
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    const integration = integrations.find(i => i.id === integrationId);
    if (integration) {
      updateIntegration(integrationId, { isConnecting: true });

      try {
        await integration.disconnect();
        updateIntegration(integrationId, {
          isConnecting: false,
          connectMessage: "Disconnected successfully",
          isConnected: false
        });
      } catch (e: any) {
        updateIntegration(integrationId, {
          isConnecting: false,
          connectMessage: e?.toString?.() || "Failed to disconnect",
          isConnected: false
        });
      }
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Anchor near top-right like ChatHistory button */}
      <PopoverAnchor asChild>
        <div className="fixed top-2 right-2 w-0 h-0" />
      </PopoverAnchor>
      <PopoverContent
        align="end"
        side="bottom"
        className="select-none w-screen p-0 border overflow-hidden border-input/50"
        sideOffset={8}
      >
        <div className="border-b border-input/50 p-4">
          <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Integrations
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Connect and manage your third-party integrations
          </p>
        </div>
        <ScrollArea className="h-[calc(100vh-8.75rem)]">
          <div className="p-6 space-y-4">

            {integrations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Settings className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-lg text-muted-foreground">
                  No integrations available
                </p>
                <p className="text-sm text-muted-foreground/70 mt-2">
                  Integrations will appear here when available
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {integrations.map((integration) => (
                  <div
                    key={integration.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-md border border-input/50 bg-background/50"
                  >
                    <div className="text-sm">
                      <div className="font-medium">{integration.name}</div>
                      <div className="text-xs text-muted-foreground">{integration.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {integration.connectMessage && (
                        <span className="text-xs text-muted-foreground max-w-[240px] truncate" title={integration.connectMessage}>{integration.connectMessage}</span>
                      )}
                      {integration.isConnected ? (
                        <Button onClick={() => handleDisconnect(integration.id)} disabled={integration.isConnecting} size="sm" variant="secondary">
                          {integration.isConnecting ? "Disconnecting..." : "Disconnect"}
                        </Button>
                      ) : (
                        <Button onClick={() => handleConnect(integration.id)} disabled={integration.isConnecting} size="sm">
                          {integration.isConnecting ? "Connecting..." : "Connect"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};