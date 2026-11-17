import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff } from 'lucide-react';
import { AuthFrame } from './AuthFrame';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';

export function Signup() {
  const { user, signup } = useAuth();
  const { toast } = useUI();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={user.onboarded ? '/home' : '/onboarding'} replace />;

  const strength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) { setError('Tell us your name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address.'); return; }
    if (password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    setLoading(true);
    try {
      await signup(name.trim(), email.trim(), password);
      toast('Account created', 'success', 'Let\'s set up your goals.');
      navigate('/onboarding', { replace: true });
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <AuthFrame
      title={<>Create your<br /><em>account.</em></>}
      subtitle="Two minutes of setup, then training and food live in one place."
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" className="input" autoComplete="name" placeholder="Alex Rivera" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">Password</label>
          <div className="pw-wrap">
            <input id="password" className="input" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" className="pw-toggle" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="row" style={{ gap: 4, marginTop: 2 }}>
            {[1, 2, 3].map(i => <i key={i} style={{ height: 3, flex: 1, borderRadius: 9, background: strength >= i ? 'var(--volt)' : 'var(--line)', transition: '.25s' }} />)}
            <span className="tiny faint" style={{ marginLeft: 6 }}>{strength === 0 ? '8+ characters' : strength === 1 ? 'Getting there' : strength === 2 ? 'Good' : 'Strong'}</span>
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
          {loading ? <span className="spinner" /> : <>Create account <ArrowRight size={16} /></>}
        </button>
        <div className="row tiny faint" style={{ justifyContent: 'center', gap: 5, marginTop: -2 }}>
          <Check size={11} /> No ads, no upsells, nothing sold.
        </div>
      </form>
      <Link to="/login" className="back-link" style={{ marginTop: 20 }}><ArrowLeft size={13} /> Back to sign in</Link>
    </AuthFrame>
  );
}