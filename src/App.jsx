import { useState, useEffect } from 'react' // 修正 1: useEffect 要擺喺呢度
import './App.css'

function App() {
  const [name, setName] = useState('')
  const [seed, setSeed] = useState('1')
  const [members, setMembers] = useState(() => {
    const saved = localStorage.getItem('trip_members');
    return saved ? JSON.parse(saved) : [];
  });
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [payer, setPayer] = useState('')
  const [day, setDay] = useState('Day 1')
  const [splitMode, setSplitMode] = useState('equal')
  const [ratios, setRatios] = useState({})
  const [selectedMembers, setSelectedMembers] = useState([])
  const [expenses, setExpenses] = useState(() => {
    const saved = localStorage.getItem('trip_expenses');
    return saved ? JSON.parse(saved) : [];
  }); const [settlements, setSettlements] = useState([]);
  const [settlementDetails, setSettlementDetails] = useState(null);
  const [currency, setCurrency] = useState('HKD')
  const [rates, setRates] = useState({ HKD: 1, TWD: 4.12, JPY: 20.15 })

  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`

  const generateNewAvatar = () => {
    setSeed(Math.random().toString())
  }

  // 修正 2: 移除了原本包喺 function 入面嘅 import
  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/HKD')
      .then(response => response.json())
      .then(data => {
        if (data && data.rates) {
          console.log("實時匯率已更新！", data.rates)
          setRates(data.rates)
        }
      })
      .catch(error => console.error("匯率更新失敗：", error))
  }, [])
  // 當 members 成員名單有變動時，自動儲存落瀏覽器
  useEffect(() => {
    localStorage.setItem('trip_members', JSON.stringify(members));
  }, [members]);

  // 當 expenses 開支紀錄有變動時，自動儲存落瀏覽器
  useEffect(() => {
    localStorage.setItem('trip_expenses', JSON.stringify(expenses));
  }, [expenses]);

  const addMember = () => {
    if (name.trim() === '') return
    const newMember = { id: Date.now(), name, avatar: avatarUrl }
    setMembers([...members, newMember])
    setName('')
    generateNewAvatar()
  }

  const addExpense = () => {
    if (!description || !amount || !payer) {
      alert("請填寫所有欄位！")
      return
    }

    const currentRate = rates[currency] || 1
    const convertedHKD = parseFloat(amount) / currentRate
    let debtDetails = {}

    if (splitMode === 'equal') {
      const share = convertedHKD / members.length
      members.forEach(m => debtDetails[m.name] = share)
    }
    else if (splitMode === 'individual') {
      if (selectedMembers.length === 0) { alert("請選擇承擔者！"); return }
      debtDetails[selectedMembers[0]] = convertedHKD
    }
    else if (splitMode === 'ratio') {
      const totalRatio = Object.values(ratios).reduce((sum, val) => sum + parseFloat(val || 0), 0)
      if (totalRatio === 0) { alert("請輸入有效的比例！"); return }
      members.forEach(m => {
        const personRatio = parseFloat(ratios[m.name] || 0)
        debtDetails[m.name] = (convertedHKD * personRatio) / totalRatio
      })
    }

    const newExpense = {
      id: Date.now(),
      description,
      amount: parseFloat(amount),
      currency: currency,
      hkdAmount: convertedHKD.toFixed(2),
      payer,
      day,
      splitMode,
      debtDetails
    }

    setExpenses([...expenses, newExpense])
    setDescription('')
    setAmount('')
    setRatios({})
  }
  const calculateSettlement = () => {
    if (members.length === 0 || expenses.length === 0) return;

    // 1. 初始化 Balance (餘額表)
    let balances = {};
    members.forEach(m => balances[m.name] = 0);

    // 2. 核心計數：付款人 +，承擔者 -
    expenses.forEach(exp => {
      const totalAmount = parseFloat(exp.hkdAmount);
      // 付款人：餘額增加 (代表佢出咗錢，人哋欠佢)
      balances[exp.payer] += totalAmount;

      // 承擔者：根據 debtDetails 扣減餘額 (代表佢哋欠錢)
      Object.keys(exp.debtDetails).forEach(name => {
        balances[name] -= exp.debtDetails[name];
      });
    });

    // 3. 債務與債權清單
    let debtors = []; // 欠錢的人 (Balance < 0)
    let creditors = []; // 應收錢的人 (Balance > 0)

    Object.keys(balances).forEach(name => {
      let bal = balances[name];
      if (bal < -0.01) debtors.push({ name, amount: Math.abs(bal) });
      else if (bal > 0.01) creditors.push({ name, amount: bal });
    });

    // 4. Greedy Algorithm 進行配對清數
    let result = [];
    let d = 0, c = 0;
    while (d < debtors.length && c < creditors.length) {
      let pay = Math.min(debtors[d].amount, creditors[c].amount);
      result.push(`${debtors[d].name} ➡️ 支付 $${pay.toFixed(2)} 予 ${creditors[c].name}`);

      debtors[d].amount -= pay;
      creditors[c].amount -= pay;
      if (debtors[d].amount < 0.01) d++;
      if (creditors[c].amount < 0.01) c++;
    }

    setSettlementDetails({
      totalTripCost: expenses.reduce((sum, exp) => sum + parseFloat(exp.hkdAmount), 0).toFixed(2),
      individualBalances: balances // 呢個儲存咗每個人最後嘅爭額
    });

    setSettlements(result);
  };

  return (
    <div className="App">
      <h1>旅行分帳計划 ✈️</h1>

      <div className="card">
        <h3>新增成員</h3>
        <img src={avatarUrl} alt="Avatar" width="100" style={{ borderRadius: '50%' }} />
        <br />
        <button onClick={generateNewAvatar}>🎲 換個樣</button>
        <div style={{ marginTop: '10px' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="輸入朋友名..." />
          <button onClick={addMember} style={{ marginLeft: '10px', backgroundColor: '#4CAF50', color: 'white' }}>➕ 加入</button>
        </div>
      </div>

      <div className="member-list" style={{ marginTop: '20px' }}>
        <h3>成員名單 ({members.length} 人)</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px' }}>
          {members.map(m => (
            <div key={m.id} className="member-item">
              <img src={m.avatar} alt={m.name} width="50" style={{ borderRadius: '50%' }} />
              <p style={{ fontSize: '12px', margin: '5px 0' }}>{m.name}</p>
            </div>
          ))}
        </div>
      </div>

      <hr style={{ margin: '40px 0' }} />

      <div className="card" style={{ backgroundColor: '#fffbe6' }}>
        <h3>新增支出 💰</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px', margin: '0 auto' }}>
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            <option value="Day 1">Day 1</option>
            <option value="Day 2">Day 2</option>
            <option value="Day 3">Day 3</option>
          </select>

          <input placeholder="支出項目" value={description} onChange={(e) => setDescription(e.target.value)} />

          <div style={{ display: 'flex', gap: '5px' }}>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ flex: 1, padding: '12px' }}>
              <option value="HKD">HKD</option>
              <option value="TWD">TWD</option>
              <option value="JPY">JPY</option>
            </select>
            <input type="number" placeholder={`金額 (${currency})`} value={amount} onChange={(e) => setAmount(e.target.value)} style={{ flex: 2, padding: '12px' }} />
          </div>

          <select value={payer} onChange={(e) => setPayer(e.target.value)}>
            <option value="">選擇付款人...</option>
            {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>

          {/* 分帳方式區域 */}
          <div style={{ margin: '15px 0', padding: '10px', background: '#fcfcfc', borderRadius: '8px', border: '1px solid #eee', textAlign: 'left' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#666' }}>分帳方式：</label>
            <select value={splitMode} onChange={(e) => setSplitMode(e.target.value)} style={{ marginTop: '5px', background: '#fff', width: '100%' }}>
              <option value="equal">平分 (Equal Split)</option>
              <option value="individual">由特定某人全付 (Individual)</option>
              <option value="ratio">按比例分帳 (Ratio)</option>
            </select>

            {splitMode === 'individual' && (
              <div style={{ marginTop: '10px' }}>
                <label style={{ fontSize: '12px', color: '#888' }}>誰承擔這筆費用？</label>
                <select onChange={(e) => setSelectedMembers([e.target.value])} style={{ background: '#fff', width: '100%' }}>
                  <option value="">選擇承擔者...</option>
                  {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </div>
            )}

            {splitMode === 'ratio' && (
              <div style={{ marginTop: '10px', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #ddd' }}>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '8px' }}>請輸入比例 (%)：</label>
                {members.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px' }}>{m.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input type="number" placeholder="0" value={ratios[m.name] || ''} onChange={(e) => setRatios({ ...ratios, [m.name]: e.target.value })} style={{ width: '60px', padding: '5px', textAlign: 'right' }} />
                      <span style={{ marginLeft: '5px' }}>%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={addExpense} style={{ backgroundColor: '#ff9800', color: 'white', padding: '12px', borderRadius: '10px', fontWeight: 'bold' }}>
            ✅ 添加帳目
          </button>
        </div>
      </div>

      <div style={{ marginTop: '30px', textAlign: 'left', maxWidth: '500px', margin: '30px auto' }}>
        <h3>📋 開支記錄</h3>
        {expenses.length === 0 ? <p>暫時未有紀錄</p> : (
          <div style={{ padding: 0 }}>
            {expenses.map(exp => (
              <div key={exp.id} className="expense-item" style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{exp.day}</span>
                  <div style={{ fontWeight: 'bold' }}>{exp.description}</div>
                  {/* 顯示細節 */}
                  <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px' }}>
                    模式：{exp.splitMode === 'equal' ? '全體平分' : exp.splitMode === 'ratio' ? '按比例' : '特定個人全付'}
                    {exp.splitMode === 'ratio' && ` (${Object.entries(exp.debtDetails).map(([n, v]) => `${n}:${((v / exp.hkdAmount) * 100).toFixed(0)}%`).join(', ')})`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#ef4444', fontWeight: 'bold' }}>${exp.amount} {exp.currency}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{exp.payer} 支付 (約 HKD ${exp.hkdAmount})</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* 📊 最終結算清單 */}
      <div className="card" style={{ backgroundColor: '#e0f2f1', marginTop: '40px' }}>
        <h3>📊 最終結算清單</h3>
        <button
          onClick={calculateSettlement}
          style={{ backgroundColor: '#009688', color: 'white', marginBottom: '20px' }}
        >
          💰 立即計數 (自動清數)
        </button>

        {settlementDetails && (
          <div style={{ fontSize: '13px', backgroundColor: '#f0f4f8', padding: '10px', borderRadius: '8px', marginBottom: '15px', textAlign: 'left' }}>
            <p><strong>總開支：</strong> HKD ${settlementDetails.totalTripCost}</p>
            <p><strong>個人盈餘/欠額：</strong> (正數代表應收回，負數代表需支付)</p>
            <ul style={{ paddingLeft: '20px' }}>
              {Object.entries(settlementDetails.individualBalances).map(([name, bal]) => (
                <li key={name}>{name}: {bal > 0 ? '+' : ''}${bal.toFixed(2)}</li>
              ))}
            </ul>
          </div>
        )}

        {settlements.length === 0 ? (
          <p>撳上面粒掣開始計數</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {settlements.map((s, index) => (
              <li key={index} style={{
                padding: '12px',
                background: 'white',
                marginBottom: '8px',
                borderRadius: '8px',
                fontWeight: 'bold',
                borderLeft: '5px solid #009688',
                textAlign: 'left'
              }}>
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default App
