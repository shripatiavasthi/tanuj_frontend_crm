import React, { useEffect, useState } from 'react';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://tanujphytonbackend.vercel.app/api')
  .replace(/\/+$/, '');

const INITIAL_FORM = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'consumer',
};

const EMPTY_SUB_SERVICE = { name: '', description: '', icon: '' };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function getErrorMessage(error, responseBody) {
  if (error.status === 405) {
    return 'The deployed backend does not support creating services yet. Deploy the latest Python backend, then try again.';
  }
  if (responseBody?.detail) {
    if (Array.isArray(responseBody.detail)) {
      return responseBody.detail.map((item) => item.msg).filter(Boolean).join('. ');
    }
    return responseBody.detail;
  }
  if (error instanceof TypeError) {
    return 'Could not reach the API. Check the backend URL and whether the backend allows this CRM origin.';
  }
  return 'The request could not be completed. Please try again.';
}

export default function App() {
  const [activePage, setActivePage] = useState('users');
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem('crm_admin_token') || '');
  const [adminName, setAdminName] = useState(() => sessionStorage.getItem('crm_admin_name') || '');
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', setupSecret: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [form, setForm] = useState(INITIAL_FORM);
  const [busy, setBusy] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [services, setServices] = useState([]);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    subServices: [{ ...EMPTY_SUB_SERVICE }],
  });
  const [imageData, setImageData] = useState('');
  const [servicesBusy, setServicesBusy] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState('');

  const refreshServices = async () => {
    setServicesLoading(true);
    setServicesError('');
    try {
      const response = await fetch(`${API_BASE_URL}/services`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw Object.assign(new Error('Could not load services'), { responseBody: data });
      }
      if (!Array.isArray(data)) throw new Error('The service catalog returned an unexpected response.');
      setServices(data);
    } catch (error) {
      setServicesError(getErrorMessage(error, error.responseBody));
    } finally {
      setServicesLoading(false);
    }
  };

  useEffect(() => {
    if (activePage === 'services') refreshServices();
  }, [activePage]);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrorMessage('');
    setCreatedUser(null);
    setCopied(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setErrorMessage('');
    setCreatedUser(null);
    setCopied(false);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || null,
          password: form.password,
          role: form.role,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw Object.assign(new Error('Registration failed'), { responseBody: data });
      }

      setCreatedUser(data.user);
      setForm(INITIAL_FORM);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, error.responseBody));
    } finally {
      setBusy(false);
    }
  };

  const copyDetails = async () => {
    if (!createdUser) return;
    try {
      await navigator.clipboard.writeText(
        `Name: ${createdUser.name}\nEmail: ${createdUser.email}\nRole: ${createdUser.role}${createdUser.phone ? `\nPhone: ${createdUser.phone}` : ''}`,
      );
      setCopied(true);
    } catch {
      setErrorMessage('Could not access the clipboard. Copy the account details manually.');
    }
  };

  const updateServiceForm = (event) => {
    const { name, value } = event.target;
    setServiceForm((current) => ({ ...current, [name]: value }));
    setServicesError('');
  };

  const updateSubService = (index, field, value) => {
    setServiceForm((current) => ({
      ...current,
      subServices: current.subServices.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item),
    }));
    setServicesError('');
  };

  const readServiceImage = (event) => {
    const file = event.target.files?.[0];
    setImageData('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setServicesError('Choose a JPEG, PNG, or WebP image.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setServicesError('Images must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setImageData(reader.result);
    };
    reader.onerror = () => setServicesError('Could not read the selected image.');
    reader.readAsDataURL(file);
  };

  const readSubServiceImage = (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setServicesError('Choose a JPEG, PNG, or WebP image for the subservice.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setServicesError('Subservice images must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') updateSubService(index, 'image_url', reader.result);
    };
    reader.onerror = () => setServicesError('Could not read the selected subservice image.');
    reader.readAsDataURL(file);
  };

  const createService = async (event) => {
    event.preventDefault();
    setServicesBusy(true);
    setServicesError('');

    const enteredSubServices = serviceForm.subServices.filter((item) =>
      item.name.trim() || item.description.trim() || item.icon.trim() || item.image_url);
    if (enteredSubServices.some((item) => !item.name.trim())) {
      setServicesError('Enter a name for each subservice, or remove the empty row.');
      setServicesBusy(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: serviceForm.name.trim(),
          description: serviceForm.description.trim(),
          image_url: imageData || null,
          sub_services: enteredSubServices.map((item) => ({
            name: item.name.trim(),
            description: item.description.trim(),
            icon: item.icon.trim(),
            image_url: item.image_url || null,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw Object.assign(new Error('Could not create service'), {
          responseBody: data,
          status: response.status,
        });
      }

      setServices((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
      setServiceForm({ name: '', description: '', subServices: [{ ...EMPTY_SUB_SERVICE }] });
      setImageData('');
    } catch (error) {
      setServicesError(getErrorMessage(error, error.responseBody));
    } finally {
      setServicesBusy(false);
    }
  };

  const submitAdminAuth = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    try {
      const isSetup = authMode === 'setup';
      const response = await fetch(`${API_BASE_URL}/admin/${isSetup ? 'setup' : 'login'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isSetup ? { 'X-Admin-Setup-Secret': authForm.setupSecret } : {}),
        },
        body: JSON.stringify({
          ...(isSetup ? { name: authForm.name.trim() } : {}),
          email: authForm.email.trim().toLowerCase(),
          password: authForm.password,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw Object.assign(new Error('Admin authentication failed'), {
          responseBody: data,
          status: response.status,
        });
      }

      sessionStorage.setItem('crm_admin_token', data.token);
      sessionStorage.setItem('crm_admin_name', data.admin.name);
      setAdminToken(data.token);
      setAdminName(data.admin.name);
      setAuthForm({ name: '', email: '', password: '', setupSecret: '' });
      setActivePage('users');
    } catch (error) {
      setAuthError(getErrorMessage(error, error.responseBody));
    } finally {
      setAuthBusy(false);
    }
  };

  const logoutAdmin = () => {
    sessionStorage.removeItem('crm_admin_token');
    sessionStorage.removeItem('crm_admin_name');
    setAdminToken('');
    setAdminName('');
    setServices([]);
    setActivePage('users');
  };

  if (!adminToken) {
    const isSetup = authMode === 'setup';
    return (
      <main className="page-shell">
        <header className="topbar">
          <a className="brand" href="/" aria-label="CareConnect CRM home">
            <span className="brand-mark">+</span>
            <span>CareConnect <span className="brand-light">CRM</span></span>
          </a>
          <span className="topbar-label">ADMIN SIGN IN</span>
        </header>
        <section className="auth-content">
          <div className="intro">
            <div className="eyebrow"><span className="eyebrow-dot" /> SECURE ADMIN ACCESS</div>
            <h1>{isSetup ? 'Create the first admin' : 'Sign in to CRM'}</h1>
            <p>{isSetup ? 'One-time setup. Only the first administrator can be created.' : 'Use your CRM administrator email and password.'}</p>
          </div>
          <form className="form-card auth-card" onSubmit={submitAdminAuth}>
            {isSetup ? (
              <div className="field">
                <label htmlFor="admin-name">Admin name <span>*</span></label>
                <input id="admin-name" autoComplete="name" maxLength={120} value={authForm.name} onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))} required />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="admin-email">Email address <span>*</span></label>
              <input id="admin-email" type="email" autoComplete="username" value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} required />
            </div>
            <div className="field">
              <label htmlFor="admin-password">Password <span>*</span></label>
              <input id="admin-password" type="password" autoComplete={isSetup ? 'new-password' : 'current-password'} minLength={isSetup ? 12 : 1} maxLength={128} value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} required />
              {isSetup ? <small className="field-hint">Use at least 12 characters. The password is stored as a secure hash.</small> : null}
            </div>
            {isSetup ? (
              <div className="field">
                <label htmlFor="setup-secret">One-time setup secret <span>*</span></label>
                <input id="setup-secret" type="password" autoComplete="off" value={authForm.setupSecret} onChange={(event) => setAuthForm((current) => ({ ...current, setupSecret: event.target.value }))} required />
                <small className="field-hint">Set CRM_ADMIN_SETUP_SECRET in the backend environment before first setup.</small>
              </div>
            ) : null}
            {authError ? <div className="alert error-alert" role="alert"><span aria-hidden="true">!</span><p>{authError}</p></div> : null}
            <button className="submit-button" type="submit" disabled={authBusy}>
              {authBusy ? <><span className="spinner" /> Please wait…</> : isSetup ? 'Create admin account →' : 'Sign in →'}
            </button>
            <button className="text-button auth-switch" type="button" onClick={() => { setAuthMode(isSetup ? 'login' : 'setup'); setAuthError(''); }}>
              {isSetup ? 'Already set up? Sign in' : 'First time? Set up the first admin'}
            </button>
          </form>
        </section>
        <footer className="footer">
          <span>CareConnect CRM</span>
          <span>Healthcare, connected.</span>
        </footer>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="CareConnect CRM home">
          <span className="brand-mark">+</span>
          <span>CareConnect <span className="brand-light">CRM</span></span>
        </a>
        <div className="topbar-account">
          <span className="topbar-label">{adminName || 'ADMIN WORKSPACE'}</span>
          <button className="logout-button" type="button" onClick={logoutAdmin}>Sign out</button>
        </div>
      </header>

      <div className="dashboard-layout">
        <nav className="side-nav" aria-label="CRM sections">
          <button className={activePage === 'users' ? 'nav-button active' : 'nav-button'} onClick={() => setActivePage('users')}>Users</button>
          <button className={activePage === 'services' ? 'nav-button active' : 'nav-button'} onClick={() => setActivePage('services')}>Services</button>
        </nav>
        <section className="content">
        {activePage === 'services' ? (
          <>
            <div className="intro">
              <div className="eyebrow"><span className="eyebrow-dot" /> SERVICE CATALOG</div>
              <h1>Manage services</h1>
              <p>Create the services and subservices consumers can request in the mobile app.</p>
            </div>

            <div className="catalog-workspace">
              <form className="form-card catalog-form" key="service-create-form" onSubmit={createService}>
                <div className="card-heading">
                  <div><h2>New service</h2><p>Add a catalog item and its subservices</p></div>
                  <span className="user-icon" aria-hidden="true">✚</span>
                </div>

                <div className="field">
                  <label htmlFor="service-name">Service name <span>*</span></label>
                  <input id="service-name" name="name" maxLength={120} value={serviceForm.name} onChange={updateServiceForm} placeholder="e.g. Nursing Care" required />
                </div>
                <div className="field">
                  <label htmlFor="service-description">Description</label>
                  <textarea id="service-description" name="description" maxLength={2000} value={serviceForm.description} onChange={updateServiceForm} placeholder="Describe this service" rows={3} />
                </div>
                <div className="field">
                  <label htmlFor="service-image">Service image <small>Optional · JPEG, PNG, or WebP · max 5 MB</small></label>
                  <input id="service-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={readServiceImage} />
                  {imageData ? <img className="service-image-preview" src={imageData} alt="Service preview" /> : null}
                </div>

                <div className="subservice-heading">
                  <div><h3>Subservices</h3><p>Optional request choices under this service</p></div>
                  <button className="small-button" type="button" onClick={() => setServiceForm((current) => ({ ...current, subServices: [...current.subServices, { ...EMPTY_SUB_SERVICE }] }))}>+ Add subservice</button>
                </div>
                {serviceForm.subServices.map((item, index) => (
                  <div className="subservice-fields" key={index}>
                    <div className="field">
                      <label htmlFor={`subservice-name-${index}`}>Name</label>
                      <input id={`subservice-name-${index}`} maxLength={120} value={item.name} onChange={(event) => updateSubService(index, 'name', event.target.value)} placeholder="e.g. Wound Dressing" />
                    </div>
                    <div className="subservice-row">
                      <div className="field">
                        <label htmlFor={`subservice-icon-${index}`}>Icon <small>Emoji</small></label>
                        <input id={`subservice-icon-${index}`} maxLength={16} value={item.icon} onChange={(event) => updateSubService(index, 'icon', event.target.value)} placeholder="🩹" />
                      </div>
                      <div className="field">
                        <label htmlFor={`subservice-description-${index}`}>Description</label>
                        <input id={`subservice-description-${index}`} maxLength={1000} value={item.description} onChange={(event) => updateSubService(index, 'description', event.target.value)} placeholder="Brief details" />
                      </div>
                      {serviceForm.subServices.length > 1 ? (
                        <button className="remove-button" type="button" aria-label={`Remove subservice ${index + 1}`} onClick={() => setServiceForm((current) => ({ ...current, subServices: current.subServices.filter((_, itemIndex) => itemIndex !== index) }))}>×</button>
                      ) : null}
                    </div>
                    <div className="field subservice-image-field">
                      <label htmlFor={`subservice-image-${index}`}>Picture or logo <small>Optional · JPEG, PNG, or WebP · max 5 MB</small></label>
                      <input id={`subservice-image-${index}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => readSubServiceImage(index, event)} />
                      {item.image_url ? <img className="subservice-image-preview" src={item.image_url} alt={`${item.name || 'Subservice'} preview`} /> : null}
                    </div>
                  </div>
                ))}

                {servicesError ? <div className="alert error-alert" role="alert"><span aria-hidden="true">!</span><p>{servicesError}</p></div> : null}
                <button className="submit-button" type="submit" disabled={servicesBusy}>
                  {servicesBusy ? <><span className="spinner" /> Saving service…</> : <>Add service <span aria-hidden="true">→</span></>}
                </button>
              </form>

              <section className="catalog-list" aria-labelledby="catalog-heading">
                <div className="card-heading">
                  <div><h2 id="catalog-heading">Current services</h2><p>{services.length} service{services.length === 1 ? '' : 's'} in the catalog</p></div>
                  <button className="small-button" type="button" onClick={refreshServices} disabled={servicesLoading}>{servicesLoading ? 'Loading…' : 'Refresh'}</button>
                </div>
                {servicesError && !servicesLoading ? <div className="alert error-alert" role="alert"><span aria-hidden="true">!</span><p>{servicesError}</p></div> : null}
                {servicesLoading ? <p className="catalog-empty">Loading services…</p> : null}
                {!servicesLoading && !services.length && !servicesError ? <p className="catalog-empty">No services in the catalog yet. Add one using the form.</p> : null}
                <div className="service-cards">
                  {services.map((service) => (
                    <article className="service-card" key={service.id}>
                      {service.image_url ? <img className="service-card-image" src={service.image_url} alt="" /> : <div className="service-card-placeholder" aria-hidden="true">✚</div>}
                      <div className="service-card-copy">
                        <h3>{service.name}</h3>
                        <p>{service.description || 'No description'}</p>
                        {service.sub_services?.length ? (
                          <ul>{service.sub_services.map((subService, index) => <li key={`${service.id}-${index}`}><span>{subService.icon} {subService.name}</span>{subService.description ? <small>{subService.description}</small> : null}{subService.image_url ? <img className="subservice-list-image" src={subService.image_url} alt="" /> : null}</li>)}</ul>
                        ) : <small className="no-subservices">No subservices</small>}
                      </div>
                    </article>
                  ))}
                </div>
                </section>
            </div>
          </>
        ) : (
          <>
        <div className="intro">
          <div className="eyebrow"><span className="eyebrow-dot" /> ADMIN WORKSPACE</div>
          <h1>Create an account</h1>
          <p>Add a consumer or care provider to the CareConnect platform.</p>
        </div>

        <div className="workspace">
          <form className="form-card" key="user-create-form" onSubmit={submit}>
            <div className="card-heading">
              <div>
                <h2>New user</h2>
                <p>Account details</p>
              </div>
              <span className="user-icon" aria-hidden="true">♙</span>
            </div>

            <label htmlFor="role">Account type</label>
            <div className="role-picker" role="group" aria-label="Choose account type">
              <button
                type="button"
                className={`role-option ${form.role === 'consumer' ? 'selected' : ''}`}
                onClick={() => update({ target: { name: 'role', value: 'consumer' } })}
                aria-pressed={form.role === 'consumer'}
              >
                <span className="role-symbol consumer-symbol">♡</span>
                <span><strong>Consumer</strong><small>Books home care</small></span>
                <span className="radio-dot" />
              </button>
              <button
                type="button"
                className={`role-option ${form.role === 'provider' ? 'selected' : ''}`}
                onClick={() => update({ target: { name: 'role', value: 'provider' } })}
                aria-pressed={form.role === 'provider'}
              >
                <span className="role-symbol provider-symbol">✚</span>
                <span><strong>Provider</strong><small>Delivers care</small></span>
                <span className="radio-dot" />
              </button>
            </div>

            <div className="field">
              <label htmlFor="name">Full name <span>*</span></label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                maxLength={120}
                placeholder="e.g. Alex Morgan"
                value={form.name}
                onChange={update}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="email">Email address <span>*</span></label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={form.email}
                onChange={update}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="phone">Phone number <small>Optional</small></label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={32}
                placeholder="+1 555 000 0000"
                value={form.phone}
                onChange={update}
              />
            </div>

            <div className="field">
              <label htmlFor="password">Temporary password <span>*</span></label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                placeholder="At least 8 characters"
                value={form.password}
                onChange={update}
                required
              />
              <small className="field-hint">Share this securely with the new user. They can sign in using this password.</small>
            </div>

            {errorMessage ? (
              <div className="alert error-alert" role="alert">
                <span aria-hidden="true">!</span>
                <p>{errorMessage}</p>
              </div>
            ) : null}

            <button className="submit-button" type="submit" disabled={busy}>
              {busy ? <><span className="spinner" /> Creating account…</> : <>Create {form.role} account <span aria-hidden="true">→</span></>}
            </button>
            <p className="privacy-note"><span aria-hidden="true">▣</span> Passwords are sent securely to the API and are never shown after account creation.</p>
          </form>

          <aside className="side-panel">
            {createdUser ? (
              <div className="success-card" role="status">
                <div className="success-icon">✓</div>
                <p className="success-kicker">ACCOUNT CREATED</p>
                <h2>You're all set</h2>
                <p className="success-copy">The new {createdUser.role} account is ready.</p>
                <dl className="user-summary">
                  <div><dt>Name</dt><dd>{createdUser.name}</dd></div>
                  <div><dt>Email</dt><dd>{createdUser.email}</dd></div>
                  <div><dt>Role</dt><dd><span className={`role-badge ${createdUser.role}`}>{createdUser.role}</span></dd></div>
                  {createdUser.phone ? <div><dt>Phone</dt><dd>{createdUser.phone}</dd></div> : null}
                </dl>
                <button className="copy-button" type="button" onClick={copyDetails}>
                  {copied ? 'Copied' : 'Copy account details'}
                </button>
                <button className="text-button" type="button" onClick={() => setCreatedUser(null)}>Add another user</button>
              </div>
            ) : (
              <div className="info-card">
                <div className="info-illustration" aria-hidden="true">
                  <span className="illustration-circle" />
                  <span className="illustration-person">♙</span>
                  <span className="illustration-plus">+</span>
                </div>
                <h2>Care starts with connection.</h2>
                <p>Create a secure account so consumers can request services and providers can respond to care opportunities.</p>
                <div className="info-divider" />
                <p className="api-status"><span className="status-dot" /> API endpoint <code>{API_BASE_URL}</code></p>
              </div>
            )}
          </aside>
        </div>

        <div className="security-warning">
          <span aria-hidden="true">⚠</span>
          <p><strong>Internal use only:</strong> The current registration endpoint is public and does not verify CRM administrator access. Do not publish this CRM publicly until admin authentication is added to the backend.</p>
        </div>
          </>
        )}
        </section>
      </div>

      <footer className="footer">
        <span>CareConnect CRM</span>
        <span>Healthcare, connected.</span>
      </footer>
    </main>
  );
}
