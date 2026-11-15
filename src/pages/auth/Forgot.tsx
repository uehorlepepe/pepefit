import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MailCheck, ShieldCheck } from 'lucide-react';
import { AuthFrame } from './AuthFrame';
import { authApi } from '../../lib/api';

export function Forgot() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<{ message: string; devResetUrl?: string; devNote?: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter the email connected to your account.'); return; }
    setLoading(true);
    try {
      const res = await authApi.forgot(email);
      setSent(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame
      title={sent ? <>Check your<br /><em>inbox.</em></> : <>Reset your<br /><em>password.</em></>}
      subtitle={sent ? sent.message : 'Enter the email you signed up with and we\'ll send you a secure link to choose a new password.'}
      footer={<>Remembered it? <Link to="/login">Sign in</Link></>}
    >
      {sent ? (
        <div className="stack mt-24" style={{ gap: 14 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="row" style={{ gap: 11 }}>
              <span className="icon-box volt"><MailCheck size={18} /></span>
              <div>
                <b style={{ fontSize: 13 }}>Reset link requested</b>
                <div className="tiny faint" style={{ marginTop: 2 }}>The link expires in 60 minutes.</div>
              </div>
            </div>
            {sent.devResetUrl && (
              <>
                <div className="divider" />
                <div className="tiny faint" style={{ lineHeight: 1.6 }}>{sent.devNote}</div>
                <button className="btn btn-primary btn-block mt-14" onClick={() => navigate(sent.devResetUrl!)}>
                  <ShieldCheck size={16} /> Open secure reset link
                </button>
                <div className="tiny faint" style={{ textAlign: 'center', marginTop: 10 }}>Email delivery is simulated in this environment.</div>
              </>
            )}
          </div>
          <Link to="/login" className="back-link" style={{ justifyContent: 'center' }}><ArrowLeft size={13} /> Back to sign in</Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading ? <span className="spinner" /> : <>Send reset link <ArrowRight size={16} /></>}
          </button>
          <Link to="/login" className="back-link" style={{ justifyContent: 'center', marginTop: 4 }}><ArrowLeft size={13} /> Back to sign in</Link>
        </form>
      )}
    </AuthFrame>
  );
}