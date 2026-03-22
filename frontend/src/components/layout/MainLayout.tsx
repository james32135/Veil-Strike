import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { ToastContainer } from '@/components/shared/Toast';
import { useNotificationStore } from '@/stores/notificationStore';

export default function MainLayout() {
  const { notifications, dismiss } = useNotificationStore();

  return (
    <div className="min-h-screen bg-dark flex flex-col relative">
      {/* Aurora orb backgrounds */}
      <div className="aurora-bg">
        <div className="aurora-orb aurora-orb-1" />
        <div className="aurora-orb aurora-orb-2" />
        <div className="aurora-orb aurora-orb-3" />
      </div>

      {/* Subtle noise overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, rgba(255, 107, 53, 0.05), transparent 50%),
                           radial-gradient(circle at 80% 50%, rgba(255, 61, 0, 0.03), transparent 50%)`,
        }}
      />

      <Navbar />
      <main className="flex-1 pt-[72px] relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>
      <Footer />
      <ToastContainer notifications={notifications} onDismiss={dismiss} />
    </div>
  );
}
