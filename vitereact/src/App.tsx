import React from "react";
import { Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* Import Shared Global Views (GV_*) */
import GV_TopNav from '@/components/views/GV_TopNav.tsx';
import GV_Footer from '@/components/views/GV_Footer.tsx';
import GV_NotificationCenter from '@/components/views/GV_NotificationCenter.tsx';

/* Import Unique Views (UV_*) */
import UV_Landing from '@/components/views/UV_Landing.tsx';
import UV_Login from '@/components/views/UV_Login.tsx';
import UV_SignUp from '@/components/views/UV_SignUp.tsx';
import UV_Dashboard from '@/components/views/UV_Dashboard.tsx';
import UV_Transactions from '@/components/views/UV_Transactions.tsx';
import UV_BudgetManagement from '@/components/views/UV_BudgetManagement.tsx';
import UV_BillReminders from '@/components/views/UV_BillReminders.tsx';
import UV_IncomeTracking from '@/components/views/UV_IncomeTracking.tsx';
import UV_SpendingAnalysis from '@/components/views/UV_SpendingAnalysis.tsx';
import UV_AccountManagement from '@/components/views/UV_AccountManagement.tsx';
import UV_NotificationSettings from '@/components/views/UV_NotificationSettings.tsx';
import UV_Profile from '@/components/views/UV_Profile.tsx';

import { useAppStore } from '@/store/main';

const queryClient = new QueryClient();

const App: React.FC = () => {
  // Retrieve the notification center state from the global store
  const isNotificationCenterOpen = useAppStore(
    (state) => state.global_ui_state.is_notification_center_open
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col min-h-screen">
        {/* Global Top Navigation appears on every page */}
        <GV_TopNav />

        {/* Main content area that displays different views based on routes */}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<UV_Landing />} />
            <Route path="/login" element={<UV_Login />} />
            <Route path="/signup" element={<UV_SignUp />} />
            <Route path="/dashboard" element={<UV_Dashboard />} />
            <Route path="/transactions" element={<UV_Transactions />} />
            <Route path="/budgets" element={<UV_BudgetManagement />} />
            <Route path="/bills" element={<UV_BillReminders />} />
            <Route path="/income" element={<UV_IncomeTracking />} />
            <Route path="/analysis" element={<UV_SpendingAnalysis />} />
            <Route path="/accounts" element={<UV_AccountManagement />} />
            <Route path="/settings/notifications" element={<UV_NotificationSettings />} />
            <Route path="/profile" element={<UV_Profile />} />
          </Routes>
        </main>

        {/* Conditional Global Notification Center overlay */}
        {isNotificationCenterOpen && <GV_NotificationCenter />}

        {/* Global footer appears on every page */}
        <GV_Footer />
      </div>
    </QueryClientProvider>
  );
};

export default App;