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

function ApplicationForm({ application, stages, onCancel, onSaved }) {
  const [form, setForm] = useState({
    companyName: application?.companyName ?? '',
    roleTitle: application?.roleTitle ?? '',
    stageId: application ? (application.stageId == null ? '' : String(application.stageId)) : (stages[0] ? String(stages[0].id) : ''),
    jobLink: application?.jobLink ?? '',
    deadline: application?.deadline ?? '',
    notes: application?.notes ?? '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.companyName.trim() || !form.roleTitle.trim()) {
      setError('Company name and role title are required.');
      return;
    }

    setError('');
    setSubmitting(true);
    const isEditing = Boolean(application);
    try {
      const { application: savedApplication } = await apiRequest(
        isEditing ? `/api/applications/${application.id}` : '/api/applications',
        {
          method: isEditing ? 'PATCH' : 'POST',
          body: JSON.stringify({ ...form, companyName: form.companyName.trim(), roleTitle: form.roleTitle.trim() }),
        },
      );
      onSaved(savedApplication);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  return (
    <div className="application-form-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onCancel();
    }}>
      <section className="application-form-dialog" aria-labelledby="application-form-title" aria-modal="true" role="dialog">
        <div className="application-form-heading">
          <div>
            <p className="eyebrow">APPLICATION DETAILS</p>
            <h2 id="application-form-title">{application ? 'Edit application' : 'Add an application'}</h2>
          </div>
          <button className="close-button" disabled={submitting} onClick={onCancel} type="button" aria-label="Close form">×</button>
        </div>
        <form className="application-form" onInvalid={(event) => {
          if (['companyName', 'roleTitle'].includes(event.target.name)) {
            setError('Company name and role title are required.');
          }
        }} onSubmit={handleSubmit}>
          <div className="application-form-grid">
            <div className="field-group">
              <label htmlFor="company-name">Company name <span aria-hidden="true">*</span></label>
              <input autoFocus id="company-name" maxLength={150} name="companyName" onChange={updateField} required value={form.companyName} />
            </div>
            <div className="field-group">
              <label htmlFor="role-title">Role title <span aria-hidden="true">*</span></label>
              <input id="role-title" maxLength={150} name="roleTitle" onChange={updateField} required value={form.roleTitle} />
            </div>
            <div className="field-group">
              <label htmlFor="application-stage">Stage</label>
              <select id="application-stage" name="stageId" onChange={updateField} value={form.stageId}>
                <option value="">No stage</option>
                {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="job-link">Job link</label>
              <input id="job-link" name="jobLink" onChange={updateField} placeholder="https://…" type="url" value={form.jobLink} />
            </div>
            <div className="field-group">
              <label htmlFor="application-deadline">Deadline</label>
              <input id="application-deadline" name="deadline" onChange={updateField} type="date" value={form.deadline} />
            </div>
            <div className="field-group field-full-width">
              <label htmlFor="application-notes">Notes</label>
              <textarea id="application-notes" maxLength={10000} name="notes" onChange={updateField} placeholder="People to follow up with, interview notes, and more…" rows={4} value={form.notes} />
            </div>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="application-form-actions">
            <button className="secondary-button" disabled={submitting} onClick={onCancel} type="button">Cancel</button>
            <button className="primary-button" disabled={submitting} type="submit">{submitting ? 'Saving…' : application ? 'Save changes' : 'Save application'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProtectedDashboard({ user, onLogout }) {
  const [error, setError] = useState('');
  const [stages, setStages] = useState([]);
  const [stageError, setStageError] = useState('');
  const [stageLoading, setStageLoading] = useState(true);
  const [stageBusy, setStageBusy] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [editingStageId, setEditingStageId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationError, setApplicationError] = useState('');
  const [applicationForm, setApplicationForm] = useState(null);
  const [savingStageId, setSavingStageId] = useState(null);
  const [dashboardSummary, setDashboardSummary] = useState(null);

  useEffect(() => {
    apiRequest('/api/stages')
      .then(({ stages: savedStages }) => setStages(savedStages))
      .catch((requestError) => setStageError(requestError.message))
      .finally(() => setStageLoading(false));
  }, []);

  useEffect(() => {
    apiRequest('/api/applications')
      .then(({ applications: savedApplications }) => setApplications(savedApplications))
      .catch((requestError) => setApplicationError(requestError.message))
      .finally(() => setApplicationsLoading(false));
  }, []);

  useEffect(() => {
    apiRequest('/api/applications/summary')
      .then(setDashboardSummary)
      .catch((requestError) => setApplicationError(requestError.message));
  }, []);

  async function refreshDashboardSummary() {
    try {
      const summary = await apiRequest('/api/applications/summary');
      setDashboardSummary(summary);
    } catch (requestError) {
      setApplicationError(requestError.message);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      onLogout();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleAddStage(event) {
    event.preventDefault();
    setStageError('');
    setStageBusy(true);
    try {
      const { stage } = await apiRequest('/api/stages', {
        method: 'POST',
        body: JSON.stringify({ name: newStageName }),
      });
      setStages((current) => [...current, stage]);
      setNewStageName('');
      await refreshDashboardSummary();
    } catch (requestError) {
      setStageError(requestError.message);
    } finally {
      setStageBusy(false);
    }
  }

  async function handleRenameStage(event, stageId) {
    event.preventDefault();
    setStageError('');
    setStageBusy(true);
    try {
      const { stage } = await apiRequest(`/api/stages/${stageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editingName }),
      });
      setStages((current) => current.map((item) => item.id === stage.id ? stage : item));
      setEditingStageId(null);
      setEditingName('');
      await refreshDashboardSummary();
    } catch (requestError) {
      setStageError(requestError.message);
    } finally {
      setStageBusy(false);
    }
  }

  async function handleDeleteStage(stageId) {
    setStageError('');
    setStageBusy(true);
    try {
      await apiRequest(`/api/stages/${stageId}`, { method: 'DELETE' });
      setStages((current) => current.filter((stage) => stage.id !== stageId));
      setApplications((current) => current.map((application) => (
        String(application.stageId) === String(stageId)
          ? { ...application, stageId: null, stageName: null }
          : application
      )));
      await refreshDashboardSummary();
    } catch (requestError) {
      setStageError(requestError.message);
    } finally {
      setStageBusy(false);
    }
  }

  async function handleChangeApplicationStage(application, nextStageId) {
    const previousStageId = application.stageId == null ? '' : String(application.stageId);
    setApplicationError('');
    setSavingStageId(application.id);
    setApplications((current) => current.map((item) => (
      String(item.id) === String(application.id)
        ? { ...item, stageId: nextStageId || null, stageName: stages.find((stage) => String(stage.id) === nextStageId)?.name ?? null }
        : item
    )));
    try {
      const { application: updated } = await apiRequest(`/api/applications/${application.id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stageId: nextStageId || null }),
      });
      setApplications((current) => current.map((item) => String(item.id) === String(updated.id) ? updated : item));
      await refreshDashboardSummary();
    } catch (requestError) {
      setApplications((current) => current.map((item) => (
        String(item.id) === String(application.id)
          ? { ...item, stageId: previousStageId || null, stageName: application.stageName }
          : item
      )));
      setApplicationError(requestError.message);
    } finally {
      setSavingStageId(null);
    }
  }

  async function handleDeleteApplication(application) {
    if (!window.confirm(`Permanently delete the application at ${application.companyName}?`)) return;
    setApplicationError('');
    try {
      await apiRequest(`/api/applications/${application.id}`, { method: 'DELETE' });
      setApplications((current) => current.filter((item) => String(item.id) !== String(application.id)));
      await refreshDashboardSummary();
    } catch (requestError) {
      setApplicationError(requestError.message);
    }
  }

  function handleApplicationSaved(savedApplication) {
    setApplications((current) => {
      const exists = current.some((item) => String(item.id) === String(savedApplication.id));
      return exists
        ? current.map((item) => String(item.id) === String(savedApplication.id) ? savedApplication : item)
        : [savedApplication, ...current];
    });
    setApplicationForm(null);
    setApplicationError('');
    refreshDashboardSummary();
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
        <p>Keep every opportunity and next step together in one place.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
      <section className="dashboard-overview" aria-label="Application overview">
        <div className="summary-card summary-total">
          <p className="summary-label">Total applications</p>
          <strong className="summary-total-number">{dashboardSummary?.totalApplications ?? (applicationsLoading ? '—' : applications.length)}</strong>
          <span className="summary-caption">opportunities in your pipeline</span>
        </div>
        <div className="summary-card summary-stages">
          <div className="summary-section-heading">
            <h2>By stage</h2>
            <span>Current pipeline</span>
          </div>
          {dashboardSummary ? (
            <div className="stage-count-grid">
              {dashboardSummary.stageCounts.map((stage) => (
                <div className="stage-count-item" key={stage.stageId}>
                  <span>{stage.stageName}</span>
                  <strong>{stage.count}</strong>
                </div>
              ))}
              {!dashboardSummary.stageCounts.length && <p className="summary-muted">Add a stage to see your breakdown.</p>}
            </div>
          ) : <p className="summary-muted">Loading stage counts…</p>}
        </div>
        <div className="summary-card upcoming-card">
          <div className="summary-section-heading">
            <div>
              <p className="eyebrow">NEXT 7 DAYS</p>
              <h2>Upcoming deadlines</h2>
            </div>
            <span className="deadline-count">{dashboardSummary?.upcomingDeadlines.length ?? '—'}</span>
          </div>
          {!dashboardSummary ? (
            <p className="summary-muted">Loading deadlines…</p>
          ) : dashboardSummary.upcomingDeadlines.length ? (
            <ul className="deadline-list">
              {dashboardSummary.upcomingDeadlines.map((application) => (
                <li className="deadline-item" key={application.id}>
                  <span className="deadline-date">{new Date(`${application.deadline}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  <div className="deadline-details">
                    <strong>{application.roleTitle}</strong>
                    <span>{application.companyName}{application.stageName ? ` · ${application.stageName}` : ''}</span>
                  </div>
                  <button className="text-button" onClick={() => setApplicationForm({ mode: 'edit', application })} type="button">Edit</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="summary-muted deadline-empty">Nothing due in the next 7 days. You’re all caught up.</p>
          )}
        </div>
      </section>
      <section className="applications-section" aria-labelledby="applications-title">
        <div className="applications-heading">
          <div>
            <p className="eyebrow">YOUR JOB SEARCH</p>
            <h2 id="applications-title">Applications</h2>
            <p>Track each opportunity from first look to final decision.</p>
          </div>
          <button className="primary-button add-application-button" onClick={() => setApplicationForm({ mode: 'create' })} type="button">
            Add application <span aria-hidden="true">+</span>
          </button>
        </div>
        {applicationError && <p className="form-error application-list-error" role="alert">{applicationError}</p>}
        {applicationsLoading ? (
          <p className="applications-empty">Loading your applications…</p>
        ) : applications.length ? (
          <div className="application-list">
            {applications.map((application) => (
              <article className="application-card" key={application.id}>
                <div className="application-card-main">
                  <div className="application-card-title">
                    <h3>{application.roleTitle}</h3>
                    <p>{application.companyName}</p>
                  </div>
                  {application.deadline && <p className="application-deadline">Deadline <strong>{new Date(`${application.deadline}T00:00:00`).toLocaleDateString()}</strong></p>}
                  {application.jobLink && <a className="application-link" href={application.jobLink} rel="noreferrer" target="_blank">View job ↗</a>}
                  {application.notes && <p className="application-notes">{application.notes}</p>}
                </div>
                <div className="application-card-actions">
                  <label className="visually-hidden" htmlFor={`application-stage-${application.id}`}>Stage for {application.roleTitle} at {application.companyName}</label>
                  <select
                    className="application-stage-select"
                    disabled={savingStageId !== null || !stages.length}
                    id={`application-stage-${application.id}`}
                    onChange={(event) => handleChangeApplicationStage(application, event.target.value)}
                    value={application.stageId == null ? '' : String(application.stageId)}
                  >
                    <option value="">No stage</option>
                    {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                  </select>
                  <button className="text-button" onClick={() => setApplicationForm({ mode: 'edit', application })} type="button">Edit</button>
                  <button className="danger-button" onClick={() => handleDeleteApplication(application)} type="button">Delete</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="applications-empty">
            <span className="empty-mark" aria-hidden="true">✳</span>
            <h3>Your next opportunity starts here.</h3>
            <p>Add your first application to keep its details and progress together.</p>
          </div>
        )}
      </section>
      <section className="stage-manager" aria-labelledby="stage-manager-title">
        <div className="stage-manager-heading">
          <div>
            <p className="eyebrow">YOUR APPLICATION PIPELINE</p>
            <h2 id="stage-manager-title">Manage stages</h2>
            <p>Add or rename stages to match your personal process.</p>
          </div>
          <span className="stage-count">{stages.length} {stages.length === 1 ? 'stage' : 'stages'}</span>
        </div>

        {stageLoading ? (
          <p className="stage-empty">Loading your stages…</p>
        ) : (
          <ul className="stage-list">
            {stages.map((stage) => (
              <li className="stage-row" key={stage.id}>
                {editingStageId === stage.id ? (
                  <form className="stage-rename-form" onSubmit={(event) => handleRenameStage(event, stage.id)}>
                    <label className="visually-hidden" htmlFor={`stage-${stage.id}`}>Stage name</label>
                    <input
                      autoFocus
                      id={`stage-${stage.id}`}
                      maxLength={50}
                      onChange={(event) => setEditingName(event.target.value)}
                      required
                      value={editingName}
                    />
                    <div className="stage-actions">
                      <button className="secondary-button" disabled={stageBusy} type="submit">Save</button>
                      <button className="text-button" disabled={stageBusy} onClick={() => setEditingStageId(null)} type="button">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <span className="stage-name"><span className="stage-dot" aria-hidden="true" />{stage.name}</span>
                    <div className="stage-actions">
                      <button
                        className="text-button"
                        disabled={stageBusy}
                        onClick={() => { setEditingStageId(stage.id); setEditingName(stage.name); }}
                        type="button"
                      >
                        Rename
                      </button>
                      <button className="danger-button" disabled={stageBusy} onClick={() => handleDeleteStage(stage.id)} type="button">
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
            {!stages.length && <li className="stage-empty">No stages yet. Add one to get started.</li>}
          </ul>
        )}

        <form className="stage-add-form" onSubmit={handleAddStage}>
          <label className="visually-hidden" htmlFor="new-stage-name">New stage name</label>
          <input
            id="new-stage-name"
            maxLength={50}
            onChange={(event) => setNewStageName(event.target.value)}
            placeholder="e.g. Final Interview"
            required
            value={newStageName}
          />
          <button className="primary-button" disabled={stageBusy || !newStageName.trim()} type="submit">Add stage <span aria-hidden="true">+</span></button>
        </form>
        {stageError && <p className="form-error" role="alert">{stageError}</p>}
      </section>
      {applicationForm && (
        <ApplicationForm
          application={applicationForm.application}
          onCancel={() => setApplicationForm(null)}
          onSaved={handleApplicationSaved}
          stages={stages}
        />
      )}
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
