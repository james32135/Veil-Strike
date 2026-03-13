import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { ToastContainer } from '@/components/shared/Toast';
import { useNotificationStore } from '@/stores/notificationStore';

export default function MainLayout() {
  const { notifications, dismiss } = useNotificationStore();

  return (
    <div className="min-h-screen bg-dark flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>
      <Footer />
      <ToastContainer notifications={notifications} onDismiss={dismiss} />
    </div>
  );
}
