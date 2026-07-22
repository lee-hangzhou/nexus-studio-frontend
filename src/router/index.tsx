import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '../components/RequireAuth';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { AppShell } from '../app/layout/AppShell';
import { AssetsPage } from '../features/assets/pages/AssetsPage';
import { ChatPage } from '../features/chat/pages/ChatPage';
import { GeneratePage } from '../features/generate/pages/GeneratePage';
import { CanvasPage } from '../features/canvas/pages/CanvasPage';
import { FoyerPage } from '../features/home/pages/FoyerPage';
import { ProjectsPage } from '../features/projects/pages/ProjectsPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<FoyerPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="generate" element={<GeneratePage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId/canvas" element={<CanvasPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
