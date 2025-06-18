import React from 'react';
import { useAppStore } from '@/store/main';

const GV_NotificationCenter: React.FC = () => {
  const toggleNotificationCenter = useAppStore(
    (state) => state.global_ui_state.toggle_notification_center
  );

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black opacity-50" onClick={toggleNotificationCenter}></div>
      <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-xl">
        <div className="p-4">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <div className="mt-4">
            <p className="text-gray-600">No new notifications</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GV_NotificationCenter;