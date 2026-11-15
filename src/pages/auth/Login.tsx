import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Play, Sparkles } from 'lucide-react';
import { AuthFrame } from './AuthFrame';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';

export function Login() {
  const { user, login, demoLogin } = useAuth();
  const { toast } = useUI();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<'form' | 'demo' | null>(null);

  if (user) return <Navigate to={user.onboarded ? '/home' : '/onboarding'} replace />;

  const after = (onboarded: boolean) => {
    navigate(onboarded ? '/home' : '/onboarding', { replace: true });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setLoading('form');
    try {
      const u = await login(email, password);
      after(u.onboarded);
    } catch (err: any) {
      setError(err.message);
      setLoading(null);
    }
  };

  const demo = async () => {
    setError(null);
    setLoading('demo');
    try {
      const u = await demoLogin();
      toast('Welcome back, Alex', 'success', 'Demo account loaded with 6 weeks of data.');
      after(u.onboarded);
    } catch (err: any) {
      setError(err.message);
      setLoading(null);
    }
  };

  return (
    <AuthFrame
      title={<>Train. Fuel.<br /><em>Evolve.</em></>}
      subtitle="One place for your training, nutrition and the progress that comes with it."
      footer={<>New to Pepefit? <Link to="/signup">Create an account</Link></>}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <div className="row-between">
            <label className="label" htmlFor="password">Password</label>
            <Link to="/forgot-password" className="tiny" style={{ color: 'var(--muted)', fontWeight: 550 }}>Forgot?</Link>
          </div>
          <div className="pw-wrap">
            <input id="password" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" className="pw-toggle" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!!loading}>
          {loading === 'form' ? <span className="spinner" /> : <>Sign in <ArrowRight size={16} /></>}
        </button>
      </form>

      <div className="auth-divider">or explore the demo</div>
      <button type="button" className="demo-card" onClick={demo} disabled={!!loading}>
        <span className="icon-box volt"><Sparkles size={17} /></span>
        <span className="grow">
          <b style={{ fontSize: 12.5, display: 'block' }}>Alex's demo account</b>
          <span className="tiny faint">6 weeks of workouts, meals & progress</span>
        </span>
        {loading === 'demo' ? <span className="spinner" style={{ color: 'var(--text)' }} /> : <Play size={15} style={{ color: 'var(--volt)' }} />}
      </button>
    </AuthFrame>
  );
}