import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '../components/RequireAuth';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { AppShell } from '../app/layout/AppShell';
import { AssetsPage } from '../features/assets/pages/AssetsPage';
import { BillingPage } from '../features/billing/pages/BillingPage';
import { BillingSuccessPage } from '../features/billing/pages/BillingSuccessPage';
import { ChatPage } from '../features/chat/pages/ChatPage';
import { GeneratePage } from '../features/generate/pages/GeneratePage';
import { CanvasPage } from '../features/canvas/pages/CanvasPage';
import { FoyerPage } from '../features/home/pages/FoyerPage';
import { ProjectDetailPage } from '../features/projects/pages/ProjectDetailPage';
import { ProjectsPage } from '../features/projects/pages/ProjectsPage';
import {
  WorkshopPage,
  WorkshopProjectRedirect,
} from '../features/workshop/pages/WorkshopRedirects';
import type { ReactNode } from 'react';

function Protected({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={<AppShell />}>
        <Route index element={<FoyerPage />} />
        <Route path="chat" element={<Protected><ChatPage /></Protected>} />
        {/* 兼容旧链接：工坊是超级工坊内形态，不再作为并列入口 */}
        <Route path="workshop" element={<Protected><WorkshopPage /></Protected>} />
        <Route path="workshop/:projectId" element={<Protected><WorkshopProjectRedirect /></Protected>} />
        <Route path="generate" element={<Protected><GeneratePage /></Protected>} />
        <Route path="assets" element={<Protected><AssetsPage /></Protected>} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="billing/success" element={<Protected><BillingSuccessPage /></Protected>} />
        <Route path="projects" element={<Protected><ProjectsPage /></Protected>} />
        <Route path="projects/:projectId" element={<Protected><ProjectDetailPage /></Protected>} />
        <Route
          path="projects/:projectId/episodes/:episodeId"
          element={<Protected><CanvasPage /></Protected>}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
