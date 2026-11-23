import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownLeft, ArrowUpRight, BadgeCheck, Banknote, CarFront, Check, ChevronDown, CircleHelp, Clock3, Fuel, Gauge, HandCoins, Landmark, Menu, Plus, ShieldCheck, SlidersHorizontal, Wallet, X } from 'lucide-react'
import { connectWallet, marketplace, parseEther, useRootstockTestnet } from './lib/contract'

const demoCars = [
  { id: 0, make: 'Toyota', model: 'Corolla SE', year: 2023, mileage: '18,420 mi', price: 23800, fuel: 'Hybrid', initials: 'TC', color: 'sage', dealer: 'Northline Motors' },
  { id: 1, make: 'Honda', model: 'CR-V EX-L', year: 2022, mileage: '24,105 mi', price: 31200, fuel: 'Gasoline', initials: 'HC', color: 'sand', dealer: 'Alder Auto Group' },
  { id: 2, make: 'Tesla', model: 'Model 3 Long Range', year: 2024, mileage: '8,650 mi', price: 36900, fuel: 'Electric', initials: 'T3', color: 'blue', dealer: 'Northline Motors' },
]
const demoOffers = [
  { id: 0, principal: '18,000', apr: 5.9, months: 48, lender: 'Cedar Capital' },
  { id: 1, principal: '25,000', apr: 6.4, months: 60, lender: 'Harbor Finance' },
  { id: 2, principal: '32,000', apr: 5.5, months: 72, lender: 'Cedar Capital' },
]
const fmt = value => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
const addr = value => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : ''
const stateName = ['Pending', 'Accepted', 'Funded', 'Active', 'Paid', 'Defaulted', 'Rejected']

function App() {
  const [role, setRole] = useState('Customer')
  const [section, setSection] = useState('Marketplace')
  const [wallet, setWallet] = useState('')
  const [network, setNetwork] = useState('Demo mode')
  const [live, setLive] = useState(false)
  const [cars, setCars] = useState(demoCars)
  const [offers, setOffers] = useState(demoOffers)
  const [applications, setApplications] = useState([])
  const [modal, setModal] = useState('')
  const [selectedCar, setSelectedCar] = useState(null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('All vehicles')

  const notify = message => { setToast(message); window.setTimeout(() => setToast(''), 3800) }
  const readContract = useCallback(async provider => {
    const contract = await marketplace(provider)
    const [vc, oc, ac] = await Promise.all([contract.vehicleCount(), contract.offerCount(), contract.applicationCount()])
    const [vehicleRows, offerRows, applicationRows] = await Promise.all([
      Promise.all(Array.from({ length: Number(vc) }, (_, id) => contract.getVehicle(id))),
      Promise.all(Array.from({ length: Number(oc) }, (_, id) => contract.getOffer(id))),
      Promise.all(Array.from({ length: Number(ac) }, (_, id) => contract.getApplication(id))),
    ])
    setCars(vehicleRows.map((v, id) => ({ id, make: v.make ?? v[2], model: v.model ?? v[3], year: Number(v.year ?? v[4]), price: Number((v.priceWei ?? v[5]) / 10n ** 18n), native: true, listed: v.listed ?? v[6], dealerAddress: v.dealer ?? v[0], mileage: 'On-chain listing', fuel: 'Vehicle', initials: `${(v.make ?? v[2]).slice(0, 1)}${(v.model ?? v[3]).slice(0, 1)}`, color: ['sage','sand','blue'][id % 3] })))
    setOffers(offerRows.map((o, id) => ({ id, lenderAddress: o.lender ?? o[0], principal: (Number((o.principalWei ?? o[1]) / 10n ** 18n)).toLocaleString(), apr: Number(o.aprBps ?? o[2]) / 100, months: Number(o.termMonths ?? o[3]), lender: addr(o.lender ?? o[0]), active: o.active ?? o[4] })))
    setApplications(applicationRows.map((a, id) => ({ id, vehicleId: Number(a.vehicleId ?? a[0]), offerId: Number(a.offerId ?? a[1]), customer: a.customer ?? a[2], dealerAddress: a.dealer ?? a[3], downPayment: a.downPaymentWei ?? a[4], totalDue: a.totalDueWei ?? a[5], paid: a.paidWei ?? a[6], nextDueAt: Number(a.nextDueAt ?? a[7]), paymentsMade: Number(a.paymentsMade ?? a[8]), state: Number(a.state ?? a[9]) })))
    setLive(true)
  }, [])

  async function handleConnect() {
    try {
      const { provider, signer } = await connectWallet()
      const address = await signer.getAddress()
      setWallet(address)
      const chain = await provider.getNetwork()
      setNetwork(chain.chainId === 31n ? 'Rootstock Testnet' : `Chain ${chain.chainId}`)
      try { await readContract(provider) } catch (error) { setLive(false); notify(error.message.includes('Add the deployed') ? 'Wallet connected. Add the deployed contract details to enable live mode.' : 'Wallet connected. The contract is not available on this network yet.') }
    } catch (error) { notify(error.message) }
  }

  async function switchNetwork() {
    try { await useRootstockTestnet(); setNetwork('Rootstock Testnet'); setWallet(''); setLive(false); notify('Switched to Rootstock Testnet. Connect your wallet to load the marketplace.') }
    catch (error) { notify(error.message) }
  }

  async function sendAction(action) {
    setBusy(true)
    try {
      const { provider, signer } = await connectWallet()
      const c = await marketplace(signer)
      await action(c, signer)
      notify('Transaction confirmed on Rootstock Testnet.')
      await readContract(provider)
      setModal('')
    } catch (error) { notify(error.shortMessage || error.reason || error.message) }
    finally { setBusy(false) }
  }

  function requireLive() {
    if (!wallet) { notify('Connect a wallet to continue.'); return false }
    if (!live) { notify('Add the deployed contract address and ABI in src/lib/contract.js to enable on-chain actions.'); return false }
    return true
  }

  const visibleCars = useMemo(() => cars.filter(car => car.listed !== false && (filter === 'All vehicles' || (filter === 'Under $30k' ? car.price < 30000 : car.year >= 2023))), [cars, filter])
  const listedCount = cars.filter(c => c.listed !== false).length
  const activeLoans = applications.filter(a => a.state === 3).length

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><CarFront size={21}/></div><span>roadstead</span><small>FINANCE</small></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list">
        <button className={section === 'Marketplace' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('Marketplace')}><Activity size={17}/> Marketplace</button>
        <button className={section === 'My loans' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('My loans')}><HandCoins size={17}/> My loans <span className="nav-count">{applications.length}</span></button>
        <button className={section === 'Vehicles' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('Vehicles')}><CarFront size={17}/> Vehicles</button>
        <button className={section === 'Loan offers' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('Loan offers')}><Landmark size={17}/> Loan offers</button>
      </nav>
      <div className="side-spacer"/>
      <div className="trust-card"><div className="trust-icon"><ShieldCheck size={17}/></div><div><strong>Built for confidence</strong><p>Every agreement is recorded on-chain.</p></div></div>
      <div className="sidebar-bottom"><span className="online-dot"/> Rootstock testnet <button title="Network info" onClick={() => notify('Transactions use the deployed marketplace contract on Rootstock Testnet.')}><CircleHelp size={15}/></button></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="crumb"><span>Workspace</span><span className="slash">/</span><b>{section}</b></div><div className="top-actions"><button className="network-chip network-button" onClick={switchNetwork}><span className="online-dot"/>{network}<ChevronDown size={12}/></button>{wallet ? <button className="wallet-button connected"><span className="wallet-dot"/>{addr(wallet)}<ChevronDown size={14}/></button> : <button className="wallet-button" onClick={handleConnect}><Wallet size={16}/> Connect wallet</button>}</div></header>

      {section === 'Marketplace' && <>
        <section className="hero"><div className="hero-content"><div className="eyebrow"><span className="eyebrow-line"/> AUTO FINANCE, REIMAGINED</div><h1>Your next car.<br/><em>A clearer way forward.</em></h1><p>Find the right vehicle and explore transparent loan terms from lenders in one place.</p><div className="hero-cta"><button className="primary-button" onClick={() => document.getElementById('vehicle-grid')?.scrollIntoView({ behavior: 'smooth' })}>Explore vehicles <ArrowDownLeft size={16}/></button><div className="hero-proof"><span className="proof-avatars"><i>JL</i><i>MR</i><i>AK</i></span><span>Trusted by <b>2,400+</b> drivers</span></div></div></div><div className="hero-art"><div className="hero-halo"/><div className="hero-car"><CarFront size={100} strokeWidth={1}/></div><div className="floating-card payment-card"><span>EST. MONTHLY</span><strong>$412<small>/mo</small></strong><div className="payment-bar"><i/></div><small>5.9% APR · 48 months</small></div><div className="floating-card verified-card"><span className="verified-icon"><BadgeCheck size={15}/></span><span>Terms you can trust</span></div><div className="art-caption">A smarter road starts here <span>↗</span></div></div></section>
        <section className="metric-row"><div className="metric"><span className="metric-icon mint"><CarFront size={17}/></span><div><small>VEHICLES AVAILABLE</small><strong>{listedCount || '—'}</strong></div><span className="metric-trend">{live ? 'live listings' : 'sample listings'}</span></div><div className="metric"><span className="metric-icon cream"><Landmark size={17}/></span><div><small>LENDER OFFERS</small><strong>{offers.length}</strong></div><span className="metric-trend">{live ? 'contract records' : 'demo terms'}</span></div><div className="metric"><span className="metric-icon lilac"><ShieldCheck size={17}/></span><div><small>ACTIVE LOANS</small><strong>{activeLoans}</strong></div><span className="metric-trend">{live ? 'on-chain' : 'demo preview'}</span></div><div className="metric"><span className="metric-icon peach"><Activity size={17}/></span><div><small>STARTING APR</small><strong>{offers.length ? `${Math.min(...offers.map(o => o.apr))}%` : '—'}</strong></div><span className="metric-trend">{live ? 'from lenders' : 'sample terms'}</span></div></section>
        <section className="listing-section" id="vehicle-grid"><div className="section-heading"><div><div className="section-kicker">THE MARKETPLACE</div><h2>Find your kind of drive</h2><p>Quality vehicles with financing options to match.</p></div><div className="listing-tools"><button className="filter-button" onClick={() => setFilter(filter === 'All vehicles' ? 'Under $30k' : filter === 'Under $30k' ? '2023 and newer' : 'All vehicles')}><SlidersHorizontal size={15}/>{filter}<ChevronDown size={14}/></button><div className="view-count">Showing <b>{visibleCars.length}</b> vehicles</div></div></div>
          <div className="car-grid">{visibleCars.map(car => <VehicleCard key={`${car.id}-${car.make}`} car={car} offers={offers} onApply={() => { setSelectedCar(car); if (requireLive()) setModal('apply') }}/>)}</div>
          {!visibleCars.length && <div className="empty-state">No vehicles match this filter yet.</div>}
        </section>
        <section className="bottom-banner"><div className="banner-icon"><Landmark size={20}/></div><div><strong>Are you a lender or dealer?</strong><p>Bring your inventory or financing offers to a more open marketplace.</p></div><button className="banner-button" onClick={() => setModal(role === 'Dealer' ? 'vehicle' : 'offer')}>Join the marketplace <ArrowUpRight size={15}/></button></section>
      </>}

      {section !== 'Marketplace' && <section className="workspace-page"><div className="section-kicker">YOUR WORKSPACE</div><h1>{section}</h1><p className="workspace-intro">Manage marketplace activity as a customer, dealer, or lender.</p><div className="role-switch"><span>Viewing as</span>{['Customer','Dealer','Lender'].map(r => <button key={r} className={role === r ? 'selected' : ''} onClick={() => setRole(r)}>{r}</button>)}</div>
        {section === 'Vehicles' && <><div className="workspace-heading"><h2>Vehicle inventory</h2><button className="primary-button small" onClick={() => { if (requireLive()) setModal('vehicle') }}><Plus size={15}/> List a vehicle</button></div><div className="car-grid">{cars.map(car => <VehicleCard key={car.id} car={car} offers={offers} onApply={() => { setSelectedCar(car); if (requireLive()) setModal('apply') }}/>)}</div></>}
        {section === 'Loan offers' && <><div className="workspace-heading"><h2>Available lender terms</h2><button className="primary-button small" onClick={() => { if (requireLive()) setModal('offer') }}><Plus size={15}/> Create an offer</button></div><div className="offer-table"><div className="offer-head"><span>LENDER</span><span>PRINCIPAL</span><span>APR</span><span>TERM</span><span/></div>{offers.map(o => <div className="offer-row" key={o.id}><span><span className="lender-mark"><Landmark size={15}/></span><b>{o.lender}</b></span><span>{o.principal} tRBTC</span><span className="apr-pill">{o.apr}%</span><span>{o.months} months</span><span><Check size={16} className="green-check"/></span></div>)}</div></>}
        {section === 'My loans' && <><div className="workspace-heading"><h2>Applications & repayments</h2><span className="chain-status"><span className="online-dot"/>{live ? 'Synced to contract' : 'Demo preview'}</span></div>{applications.length ? <div className="loan-list">{applications.map(a => <LoanRow key={a.id} application={a} car={cars[a.vehicleId]} offer={offers[a.offerId]} role={role} wallet={wallet} run={sendAction} notify={notify}/>)}</div> : <div className="empty-panel"><div className="empty-illustration"><HandCoins size={28}/></div><h3>No loan activity yet</h3><p>Applications, loan agreements, and repayment progress will appear here.</p><button className="text-button" onClick={() => setSection('Marketplace')}>Browse vehicles <ArrowUpRight size={15}/></button></div>}</>}
      </section>}
      <footer className="footer"><span>© 2026 Roadstead Finance</span><span>Transparent terms. Better journeys.</span><span className="footer-right"><ShieldCheck size={14}/> Rootstock Testnet</span></footer>
    </main>

    <div className="role-dock"><span>DEMO ROLE</span>{['Customer','Dealer','Lender'].map(r => <button key={r} className={role === r ? 'current' : ''} onClick={() => setRole(r)}>{r}</button>)}</div>
    {modal && <Modal type={modal} car={selectedCar} offers={offers} close={() => setModal('')} busy={busy} submit={async data => {
      if (!requireLive()) return
      if (modal === 'vehicle') await sendAction(async c => { const { id } = await import('ethers'); await (await c.listVehicle(id(data.vin), data.make, data.model, Number(data.year), parseEther(data.price))).wait() })
      if (modal === 'offer') await sendAction(async c => { await (await c.createOffer(parseEther(data.principal), Math.round(Number(data.apr) * 100), Number(data.months))).wait() })
      if (modal === 'apply') await sendAction(async c => { await (await c.applyForLoan(selectedCar.id, Number(data.offerId), { value: parseEther(data.downPayment || '0') })).wait() })
    }}/>}
    {toast && <div className="toast"><span className="toast-dot"/>{toast}<button onClick={() => setToast('')}><X size={14}/></button></div>}
  </div>
}

function VehicleCard({ car, offers, onApply }) {
  const offer = offers[0]
  const monthly = offer ? Math.round((Number(offer.principal.replaceAll(',', '')) * (1 + offer.apr / 100 * offer.months / 12)) / offer.months) : 0
  return <article className="vehicle-card"><div className={`car-visual ${car.color || 'sage'}`}><div className="car-topline"><span className="certified"><BadgeCheck size={12}/> {car.native ? 'ON-CHAIN LISTING' : 'SAMPLE PREVIEW'}</span><button className="heart-button" title="Save vehicle">♡</button></div><div className="car-symbol">{car.initials || 'VE'}<span className="car-orbit"/></div><div className="visual-ground"/><div className="visual-caption">{car.year} · {car.make}</div></div><div className="vehicle-info"><div className="car-title-row"><div><h3>{car.make} {car.model}</h3><span className="dealer-name">{car.dealer || addr(car.dealerAddress)}</span></div><strong className="price">{car.native ? `${car.price} tRBTC` : `$${fmt(car.price)}`}</strong></div><div className="spec-row"><span><Gauge size={13}/>{car.mileage}</span><span><Fuel size={13}/>{car.fuel}</span></div><div className="finance-preview"><div><span>FINANCING FROM</span><strong><b>{car.native ? 'See terms' : `$${fmt(monthly)}`}</b> <small>{car.native ? '' : '/ mo'}</small></strong></div><span className="rate-tag">{offer?.apr || '—'}% APR</span></div><button className="card-action" onClick={onApply}>View financing <ArrowUpRight size={15}/></button></div></article>
}

function LoanRow({ application: a, car, offer, role, wallet, run, notify }) {
  const act = async method => run(async c => {
    let tx
    if (method === 'fundLoan') tx = await c.fundLoan(a.id, { value: parseEther(String(offer.principal).replaceAll(',', '')) })
    else if (method === 'repay') {
      const remaining = a.totalDue - a.paid
      const installmentsLeft = BigInt(offer.months) - BigInt(a.paymentsMade)
      const installment = (remaining + installmentsLeft - 1n) / installmentsLeft
      tx = await c.repay(a.id, { value: installment })
    }
    else tx = await c[method](a.id)
    await tx.wait()
  })
  const canAccept = role === 'Dealer' && a.state === 0 && wallet?.toLowerCase() === a.dealerAddress?.toLowerCase()
  const canFund = role === 'Lender' && a.state === 1 && wallet?.toLowerCase() === offer?.lenderAddress?.toLowerCase()
  const canDeliver = role === 'Dealer' && a.state === 2 && wallet?.toLowerCase() === a.dealerAddress?.toLowerCase()
  const canRepay = role === 'Customer' && a.state === 3 && wallet?.toLowerCase() === a.customer?.toLowerCase()
  const canCancelFunding = a.state === 2 && (canDeliver || (role === 'Lender' && wallet?.toLowerCase() === offer?.lenderAddress?.toLowerCase()))
  const action = canAccept ? <><button onClick={() => act('acceptApplication')}>Accept</button><button onClick={() => act('rejectApplication')}>Reject</button></> : canFund ? <button onClick={() => act('fundLoan')}>Fund loan</button> : canDeliver ? <><button onClick={() => act('confirmDelivery')}>Confirm delivery</button><button onClick={() => act('rejectApplication')}>Cancel funding</button></> : canCancelFunding ? <button onClick={() => act('rejectApplication')}>Cancel funding</button> : canRepay ? <button onClick={() => act('repay')}>Make repayment</button> : a.state === 3 && Date.now() / 1000 > a.nextDueAt + 7 * 86400 ? <button onClick={() => act('declareDefault')}>Mark default</button> : null
  return <div className="loan-row"><div className="loan-car"><CarFront size={20}/></div><div className="loan-details"><strong>{car ? `${car.year} ${car.make} ${car.model}` : `Vehicle #${a.vehicleId}`}</strong><span>Application #{a.id} · {offer?.lender || 'Lender'}</span></div><span className={`loan-state state-${a.state}`}>{stateName[a.state] || 'Unknown'}</span><div className="loan-balance"><span>REPAID / TOTAL</span><b>{a.paid ? `${(Number(a.paid) / 1e18).toFixed(3)} / ` : ''}{a.totalDue ? `${(Number(a.totalDue) / 1e18).toFixed(3)} tRBTC` : '—'}</b></div>{action}</div>
}

function Modal({ type, car, offers, close, submit, busy }) {
  const title = type === 'vehicle' ? 'List a vehicle' : type === 'offer' ? 'Create a loan offer' : 'Apply for financing'
  const [values, setValues] = useState({ year: '2023', apr: '5.9', months: '48', offerId: '0', downPayment: '0.01' })
  const [error, setError] = useState('')
  const set = (key, value) => setValues(v => ({ ...v, [key]: value }))
  async function onSubmit(e) { e.preventDefault(); setError(''); try { await submit(values) } catch (err) { setError(err.message) } }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close() }}><div className="modal"><div className="modal-head"><div><span className="section-kicker">ROOTSTOCK TESTNET</span><h2>{title}</h2></div><button className="close-button" onClick={close}><X size={18}/></button></div>
    <form onSubmit={onSubmit}>
      {type === 'vehicle' && <><label>Make<input required placeholder="e.g. Toyota" value={values.make || ''} onChange={e => set('make', e.target.value)}/></label><label>Model<input required placeholder="e.g. Corolla SE" value={values.model || ''} onChange={e => set('model', e.target.value)}/></label><div className="form-pair"><label>Year<input required type="number" min="1980" max="2100" value={values.year} onChange={e => set('year', e.target.value)}/></label><label>Vehicle price (tRBTC)<input required type="number" min="0.001" step="0.001" placeholder="0.5" value={values.price || ''} onChange={e => set('price', e.target.value)}/></label></div><label>VIN (hashed before submission)<input required placeholder="VIN or identifier" value={values.vin || ''} onChange={e => set('vin', e.target.value)}/></label></>}
      {type === 'offer' && <><label>Loan principal (tRBTC)<input required type="number" min="0.001" step="0.001" placeholder="0.25" value={values.principal || ''} onChange={e => set('principal', e.target.value)}/></label><div className="form-pair"><label>APR (%)<input required type="number" min="0" max="50" step="0.1" value={values.apr} onChange={e => set('apr', e.target.value)}/></label><label>Term (months)<input required type="number" min="1" max="120" value={values.months} onChange={e => set('months', e.target.value)}/></label></div></>}
      {type === 'apply' && <><div className="application-summary"><span className={`summary-car ${car?.color}`}>{car?.initials}</span><div><strong>{car?.year} {car?.make} {car?.model}</strong><span>${fmt(car?.price)} listing price</span></div></div><label>Choose a lender offer<select value={values.offerId} onChange={e => set('offerId', e.target.value)}>{offers.map(o => <option key={o.id} value={o.id}>{o.lender} · {o.apr}% APR · {o.months} mo · {o.principal} tRBTC</option>)}</select></label><label>Down payment (tRBTC)<input required type="number" min="0" step="0.001" value={values.downPayment} onChange={e => set('downPayment', e.target.value)}/><small>Held in contract escrow until the dealer confirms delivery.</small></label><div className="secure-note"><ShieldCheck size={16}/> This creates an on-chain application. KYC documents should be shared securely off-chain.</div></>}
      {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="cancel-button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Waiting for wallet…' : type === 'apply' ? 'Submit application' : type === 'vehicle' ? 'List vehicle' : 'Publish offer'}<ArrowUpRight size={15}/></button></div>
    </form>
  </div></div>
}

export default App
