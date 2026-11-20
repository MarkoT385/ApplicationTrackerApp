import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { apiRequest } from './api.js';

function AuthPage({ mode, onAuthenticated }) {
  const navigate = useNavigate();
  const isSignup = mode === 'signup';
  const [form, setForm] = useState({ username: '', email: '', identifier: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await apiRequest(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(isSignup
          ? { username: form.username, email: form.email, password: form.password }
          : { identifier: form.identifier, password: form.password }),
      });
      onAuthenticated(result.user);
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="intro">
        <div className="brand-mark">CT</div>
        <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
        <h1>Make your next move a little more manageable.</h1>
        <p className="intro-copy">
          Keep every opportunity, deadline, and next step together in one private workspace.
        </p>
        <div className="feature-note"><span>01</span> A clear view of your career journey</div>
        <div className="feature-note"><span>02</span> Every application, right where you need it</div>
      </section>

      <section className="form-panel">
        <div className="form-heading">
          <p className="eyebrow">{isSignup ? 'GET STARTED' : 'WELCOME BACK'}</p>
          <h2>{isSignup ? 'Create your account' : 'Sign in to your space'}</h2>
          <p>{isSignup ? 'Your job search, organized from day one.' : 'Pick up right where you left off.'}</p>
        </div>
        <form onSubmit={handleSubmit}>
          {isSignup ? (
            <>
              <label htmlFor="username">Username</label>
              <input
                autoComplete="username"
                id="username"
                maxLength={30}
                minLength={3}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                pattern="[A-Za-z0-9_]{3,30}"
                placeholder="jane_doe"
                required
                value={form.username}
              />
              <label htmlFor="email">Email address</label>
              <input
                autoComplete="email"
                id="email"
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="you@example.com"
                required
                type="email"
                value={form.email}
              />
            </>
          ) : (
            <>
              <label htmlFor="identifier">Username or email</label>
              <input
                autoComplete="username"
                id="identifier"
                onChange={(event) => setForm({ ...form, identifier: event.target.value })}
                placeholder="Your username or email"
                required
                value={form.identifier}
              />
            </>
          )}
          <label htmlFor="password">Password</label>
          <input
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            id="password"
            minLength={isSignup ? 8 : undefined}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'}
            required
            type="password"
            value={form.password}
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
            <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="switch-mode">
          {isSignup ? 'Already have an account?' : 'New to Career Tracker?'}{' '}
          <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Create an account'}</Link>
        </p>
        <p className="privacy-note"><span aria-hidden="true">●</span> Your career journey is yours alone.</p>
      </section>
    </main>
  );
}

function ProtectedDashboard({ user, onLogout }) {
  const [error, setError] = useState('');

  async function handleLogout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      onLogout();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <Link className="dashboard-brand" to="/dashboard"><span className="brand-mark">CT</span> Career Tracker</Link>
        <button className="text-button" onClick={handleLogout} type="button">Sign out ↗</button>
      </header>
      <section className="welcome-card">
        <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
        <h1>Welcome, {user.username}.</h1>
        <p>Your account is ready. This is where your application dashboard will live.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    apiRequest('/api/auth/me')
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch((requestError) => {
        if (requestError.status === 401) {
          setUser(null);
        } else {
          setSessionError(requestError.message);
        }
      })
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) {
    return <main className="loading" aria-label="Loading">Loading your workspace…</main>;
  }
  if (sessionError) {
    return (
      <main className="loading session-error" role="alert">
        <div>
          <p>We couldn’t verify your session: {sessionError}</p>
          <button className="primary-button" onClick={() => window.location.reload()} type="button">Try again</button>
        </div>
      </main>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <AuthPage mode="login" onAuthenticated={setUser} />}
      />
      <Route
        path="/signup"
        element={user ? <Navigate to="/dashboard" replace /> : <AuthPage mode="signup" onAuthenticated={setUser} />}
      />
      <Route
        path="/dashboard"
        element={user ? <ProtectedDashboard user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
