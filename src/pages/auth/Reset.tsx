import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Eye, EyeOff, KeyRound } from 'lucide-react';
import { AuthFrame } from './AuthFrame';
import { authApi } from '../../lib/api';

export function Reset() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) { setError('This reset link is missing its token. Request a new link.'); return; }
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError('Those passwords don\'t match.'); return; }
    setLoading(true);
    try {
      await authApi.reset(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame
      title={done ? <>Password<br /><em>updated.</em></> : <>Choose a new<br /><em>password.</em></>}
      subtitle={done ? 'You\'re all set. Sign in with your new password to get back to training.' : 'Make it something you\'ll remember — at least 8 characters.'}
      footer={done ? <Link to="/login">Go to sign in</Link> : <Link to="/login">Cancel</Link>}
    >
      {done ? (
        <div className="mt-24">
          <div className="card center" style={{ padding: 26 }}>
            <div className="icon-box volt" style={{ margin: '0 auto 12px', width: 48, height: 48, borderRadius: 15 }}><Check size={22} /></div>
            <b style={{ fontSize: 14 }}>Password changed successfully</b>
            <p className="tiny faint mt-6">Your old password no longer works.</p>
            <button className="btn btn-primary btn-block mt-18" onClick={() => navigate('/login')}>Sign in <ArrowRight size={16} /></button>
          </div>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          {!token && <div className="form-error">No reset token found. Use the link from your reset email.</div>}
          <div className="field">
            <label className="label" htmlFor="new-password">New password</label>
            <div className="pw-wrap">
              <input id="new-password" className="input" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
              <button type="button" className="pw-toggle" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="confirm-password">Confirm password</label>
            <input id="confirm-password" className="input" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat your new password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading || !token}>
            {loading ? <span className="spinner" /> : <><KeyRound size={16} /> Update password</>}
          </button>
        </form>
      )}
    </AuthFrame>
  );
}