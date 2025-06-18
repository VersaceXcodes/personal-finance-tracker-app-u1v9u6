import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

// Define TypeScript interfaces for our state slices

export interface AuthState {
  jwt_token: string;
  user_data: {
    id: string;
    email: string;
    name: string;
  };
  is_authenticated: boolean;
}

export interface Notification {
  id: string;
  notification_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface GlobalUiState {
  is_notification_center_open: boolean;
}

export interface ResponsiveState {
  viewport_width: number;
  viewport_height: number;
  device_type: string;
}

export interface AppStore {
  // state slices
  auth_state: AuthState;
  notification_state: Notification[];
  global_ui_state: GlobalUiState;
  responsive_state: ResponsiveState;
  socket: Socket | null;
  
  // actions for auth_state
  set_auth_state: (auth: AuthState) => void;
  update_auth_state: (updates: Partial<AuthState>) => void;
  logout: () => void;
  
  // actions for notifications
  set_notifications: (notifications: Notification[]) => void;
  add_notification: (notification: Notification) => void;
  mark_notification_as_read: (id: string) => void;
  
  // action for global ui state
  set_notification_center_open: (is_open: boolean) => void;
  
  // action for responsive state
  set_responsive_state: (responsive: ResponsiveState) => void;
  
  // actions for socket connection and realtime subscriptions
  init_socket: () => Promise<void>;
  disconnect_socket: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // initial state for auth_state
      auth_state: {
        jwt_token: "",
        user_data: {
          id: "",
          email: "",
          name: "",
        },
        is_authenticated: false,
      },
      // initial state for notifications
      notification_state: [],
      // initial state for global_ui_state
      global_ui_state: {
        is_notification_center_open: false,
      },
      // initial state for responsive_state
      responsive_state: {
        viewport_width: 1024,
        viewport_height: 768,
        device_type: "desktop",
      },
      // ephemeral socket, not persisted
      socket: null,
      
      // actions for auth state
      set_auth_state: (auth) => set({ auth_state: auth }),
      update_auth_state: (updates) =>
        set((state) => ({
          auth_state: { ...state.auth_state, ...updates },
        })),
      logout: () =>
        set({
          auth_state: {
            jwt_token: "",
            user_data: { id: "", email: "", name: "" },
            is_authenticated: false,
          },
        }),
      
      // actions for notifications
      set_notifications: (notifications) =>
        set({ notification_state: notifications }),
      add_notification: (notification) =>
        set((state) => ({
          notification_state: [...state.notification_state, notification],
        })),
      mark_notification_as_read: (id) =>
        set((state) => ({
          notification_state: state.notification_state.map((notification) =>
            notification.id === id ? { ...notification, is_read: true } : notification
          ),
        })),
      
      // action for global UI state
      set_notification_center_open: (is_open) =>
        set((state) => ({
          global_ui_state: { ...state.global_ui_state, is_notification_center_open: is_open },
        })),
      
      // action for responsive state
      set_responsive_state: (responsive) => set({ responsive_state: responsive }),
      
      // action to initialize socket and subscribe to realtime notifications
      init_socket: async () => {
        try {
          const socket_instance = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000');
          // Subscribe to realtime "notification" events
          socket_instance.on('notification', (data: Notification) => {
            get().add_notification(data);
          });
          set({ socket: socket_instance });
        } catch (error) {
          console.error("Socket initialization error:", error);
        }
      },
      
      // action to disconnect socket
      disconnect_socket: () => {
        const { socket } = get();
        if (socket) {
          socket.disconnect();
          set({ socket: null });
        }
      },
    }),
    {
      name: 'app_store',
      // Only persist the selected slices, do not persist ephemeral values like socket
      partialize: (state) => ({
        auth_state: state.auth_state,
        notification_state: state.notification_state,
        global_ui_state: state.global_ui_state,
        responsive_state: state.responsive_state,
      }),
    }
  )
);