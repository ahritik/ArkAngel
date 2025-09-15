import React from "react";
import { Settings } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  isConnected: boolean;
  isConnecting: boolean;
  connectMessage: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

// Helper function to create Google Suite integration
export const createGoogleSuiteIntegration = (): Integration => ({
  id: "google-suite",
  name: "Google Suite",
  description: "Authorize access to your Gmail and Calendar",
  icon: React.createElement(Settings, { className: "h-5 w-5" }),
  isConnected: false,
  isConnecting: false,
  connectMessage: null,
  connect: async () => {
    try {
      await invoke<string>("connect_google_suite");
      console.log('[Integrations][Google] Connect successful');
    } catch (e: any) {
      console.error('[Integrations][Google] Connect error:', e);
      throw e;
    }
  },
  disconnect: async () => {
    try {
      await invoke<string>("disconnect_google_suite");
      console.log('[Integrations][Google] Disconnect successful');
    } catch (e: any) {
      console.error('[Integrations][Google] Disconnect error:', e);
      throw e;
    }
  }
});

// Helper function to check Google connection status
export const checkGoogleConnectionStatus = async (): Promise<boolean> => {
  try {
    const connected = await invoke<boolean>("is_google_connected");
    return Boolean(connected);
  } catch (err) {
    console.error('[Integrations][Google] Failed to check connection status:', err);
    return false;
  }
};

// Function to get all available integrations
export const getAvailableIntegrations = async (): Promise<Integration[]> => {
  const integrations: Integration[] = [];

  // Add Google Suite integration
  const googleIntegration = createGoogleSuiteIntegration();
  googleIntegration.isConnected = await checkGoogleConnectionStatus();
  integrations.push(googleIntegration);

  // Future integrations can be added here
  // Example:
  // const slackIntegration = createSlackIntegration();
  // slackIntegration.isConnected = await checkSlackConnectionStatus();
  // integrations.push(slackIntegration);

  return integrations;
};