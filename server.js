const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3030;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const ROLES = {
  admin: ['*'],
  hr: ['dashboard','employees','timekeeping','leave','branches','reports:employee','reports:attendance','reports:leave'],
  payroll: ['dashboard','employees:read','timekeeping','leave:read','payroll','reports:payroll','reports:accounting','reports:attendance','reports:leave'],
  accounting: ['dashboard','employees:read','payroll:read','reports:payroll','reports:accounting','reports:contributions'],
  manager: ['dashboard','employees:read','timekeeping:read','leave:approve','reports:employee','reports:attendance','reports:leave'],
  approver: ['dashboard','leave:approve','payroll:approve','timekeeping:approve','reports:payroll','reports:leave'],
  employee: ['dashboard:self','employees:self','timekeeping:self','leave:self','payroll:self']
};

const SETTINGS = {
  company: { name: 'DEGZ Enterprise HRIS', address: 'Philippines', tin: '', phone: '', email: '' },
  payroll: {
    daysPerMonth: 26, hoursPerDay: 8, semiMonthlyFactor: 0.5,
    otMultiplier: 1.25, restDayMultiplier: 1.30, holidayMultiplier: 2.00,
    specialHolidayMultiplier: 1.30, nightDiffRate: 0.10,
    paidHolidayOnAbsence: false,
    loanDeductionLimitPercent: 50
  },
  sss: { employeeRate: 0.05, employerRate: 0.10, maxMSC: 35000, minMSC: 5000, ecLow: 10, ecHigh: 30, ecThresholdMSC: 15000, enabled: true },
  philhealth: { rate: 0.05, floor: 10000, ceiling: 100000, employeeShare: 0.50, enabled: true },
  pagibig: { lowRateEmployee: 0.01, highRateEmployee: 0.02, employerRate: 0.02, threshold: 1500, maxFundSalary: 5000, enabled: true },
  tax: { annualization: true, benefitExemption: 90000, enabled: true },
  workGroups: { Regular:{otMultiplier:1.25,holidayMultiplier:2,nightDiffRate:0.10}, Operations:{otMultiplier:1.25,holidayMultiplier:2,nightDiffRate:0.10} },
  biometrics: { enabled:false, deviceName:'Generic Biometric Device', pushToken:'CHANGE-ME', endpointMode:'csv-or-push' }
};

const collections = ['companies','branches','departments','positions','workGroups','employees','users','schedules','holidays','attendance','leaveTypes','leaveRequests','loans','deductions','payrollPeriods','payrollRecords','documents','audit'];
const now = () => new Date().toISOString();
const uid = (prefix='id') => `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
const hash = (p,salt='degz-hris') => crypto.createHash('sha256').update(`${salt}:${p}`).digest('hex');
const safe = n => Number.isFinite(Number(n)) ? Number(n) : 0;
const money = n => Math.round((safe(n)+Number.EPSILON)*100)/100;

function seedDb(){
  if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true});
  if(fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE,'utf8'));
  const companyId = uid('co');
  const branchId = uid('br');
  const depId = uid('dep');
  const posId = uid('pos');
  const emp1 = uid('emp'), emp2 = uid('emp'), emp3 = uid('emp');
  const db = {
    meta: { version: 1, createdAt: now(), updatedAt: now() },
    settings: structuredClone(SETTINGS),
    companies: [{id: companyId, name: SETTINGS.company.name, code:'DEGZ', active:true, createdAt:now()}],
    branches: [{id:branchId, companyId, name:'Main Branch', code:'MAIN', address:'Philippines', active:true, createdAt:now()}],
    departments: [{id:depId, companyId, name:'Administration', code:'ADMIN', active:true, createdAt:now()}],
    positions: [{id:posId, companyId, departmentId:depId, name:'HR Administrator', code:'HR-001', active:true, createdAt:now()}],
    workGroups: [
      {id:uid('wg'), companyId, name:'Regular', code:'REG', scheduleName:'Regular Day Shift', otMultiplier:1.25, holidayMultiplier:2, nightDiffRate:0.10, active:true, createdAt:now()},
      {id:uid('wg'), companyId, name:'Operations', code:'OPS', scheduleName:'Night Shift', otMultiplier:1.25, holidayMultiplier:2, nightDiffRate:0.10, active:true, createdAt:now()}
    ],
    users: [
      {id:uid('usr'), companyId, allowedBranchIds:[], username:'admin', passwordHash:hash('admin123'), role:'admin', employeeId:null, name:'System Administrator', active:true, createdAt:now()},
      {id:uid('usr'), companyId, allowedBranchIds:[], username:'hr', passwordHash:hash('hr123'), role:'hr', employeeId:null, name:'HR Manager', active:true, createdAt:now()},
      {id:uid('usr'), companyId, allowedBranchIds:[], username:'payroll', passwordHash:hash('payroll123'), role:'payroll', employeeId:null, name:'Payroll Officer', active:true, createdAt:now()}
    ],
    employees: [
      {id:emp1, companyId, employeeNo:'EMP-0001', firstName:'Juan', middleName:'Dela', lastName:'Cruz', suffix:'', sex:'Male', birthDate:'1994-02-15', civilStatus:'Single', email:'juan@example.com', mobile:'09170000001', address:'Manila', emergencyContact:'Maria Cruz', emergencyPhone:'09170000002', hireDate:'2023-01-10', status:'Active', employmentType:'Regular', branchId, departmentId:depId, positionId:posId, workGroup:'Regular', workGroupId:null, scheduleId:null, payType:'Monthly', basicSalary:30000, allowances:2000, bankName:'', bankAccount:'', sssNo:'', philhealthNo:'', pagibigNo:'', tinNo:'', createdAt:now(), updatedAt:now()},
      {id:emp2, companyId, employeeNo:'EMP-0002', firstName:'Ana', middleName:'M.', lastName:'Reyes', suffix:'', sex:'Female', birthDate:'1996-06-20', civilStatus:'Married', email:'ana@example.com', mobile:'09170000003', address:'Quezon City', emergencyContact:'Jose Reyes', emergencyPhone:'09170000004', hireDate:'2024-04-01', status:'Active', employmentType:'Regular', branchId, departmentId:depId, positionId:posId, workGroup:'Regular', workGroupId:null, scheduleId:null, payType:'Monthly', basicSalary:28000, allowances:1500, bankName:'', bankAccount:'', sssNo:'', philhealthNo:'', pagibigNo:'', tinNo:'', createdAt:now(), updatedAt:now()},
      {id:emp3, companyId, employeeNo:'EMP-0003', firstName:'Mark', middleName:'S.', lastName:'Santos', suffix:'', sex:'Male', birthDate:'1998-09-12', civilStatus:'Single', email:'mark@example.com', mobile:'09170000005', address:'Pasig', emergencyContact:'Lina Santos', emergencyPhone:'09170000006', hireDate:'2025-02-03', status:'Active', employmentType:'Probationary', branchId, departmentId:depId, positionId:posId, workGroup:'Operations', workGroupId:null, scheduleId:null, payType:'Monthly', basicSalary:24000, allowances:1000, bankName:'', bankAccount:'', sssNo:'', philhealthNo:'', pagibigNo:'', tinNo:'', createdAt:now(), updatedAt:now()}
    ],
    schedules: [
      {id:uid('sch'), companyId, name:'Regular Day Shift', start:'09:00', end:'18:00', breakMinutes:60, graceMinutes:10, restDays:[0], active:true, createdAt:now()},
      {id:uid('sch'), companyId, name:'Night Shift', start:'21:00', end:'06:00', breakMinutes:60, graceMinutes:10, restDays:[0], active:true, createdAt:now()}
    ],
    holidays: [
      {id:uid('hol'), companyId, date:`${new Date().getFullYear()}-11-30`, name:'Bonifacio Day', type:'regular', multiplier:2, active:true, createdAt:now()}
    ],
    attendance: [],
    leaveTypes: [
      {id:uid('lt'), companyId, name:'Vacation Leave', code:'VL', defaultDays:15, paid:true, active:true},
      {id:uid('lt'), companyId, name:'Sick Leave', code:'SL', defaultDays:15, paid:true, active:true},
      {id:uid('lt'), companyId, name:'Emergency Leave', code:'EL', defaultDays:3, paid:false, active:true}
    ],
    leaveRequests: [], loans: [], deductions: [], payrollPeriods: [], payrollRecords: [], documents: [], audit: []
  };
  fs.writeFileSync(DB_FILE,JSON.stringify(db,null,2));
  return db;
}

let db = seedDb();
const sessions = new Map();
function save(){ db.meta.updatedAt=now(); fs.writeFileSync(DB_FILE,JSON.stringify(db,null,2)); }
function collection(name){ if(!db[name]) db[name]=[]; return db[name]; }
function currentUser(req){ const token=req.headers['x-session-token']; return token ? sessions.get(token) : null; }
function can(user, permission){
  if(!user) return false;
  const perms=ROLES[user.role]||[];
  if(perms.includes('*')) return true;
  if(perms.includes(permission)) return true;
  const root=String(permission).split(':')[0];
  return perms.includes(root);
}
function audit(user, action, entity, entityId, detail={}){
  collection('audit').push({id:uid('aud'), companyId:user.companyId, userId:user.id, username:user.username, action, entity, entityId, detail, createdAt:now()});
}
function send(res,status,data,headers={}){
  const body=typeof data==='string'?data:JSON.stringify(data);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(body);
}
function text(res,status,body,type='text/plain; charset=utf-8'){res.writeHead(status,{'Content-Type':type});res.end(body);}
async function readBody(req){ return await new Promise((resolve,reject)=>{ let s=''; req.on('data',c=>s+=c); req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch(e){reject(e);}}); req.on('error',reject);});}
function serveStatic(res,urlPath){
  let rel=urlPath==='/'?'index.html':urlPath.replace(/^\/+/, '');
  const file=path.normalize(path.join(PUBLIC,rel));
  if(!file.startsWith(PUBLIC)) return text(res,403,'Forbidden');
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()) return text(res,404,'Not found');
  const ext=path.extname(file);
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
  res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);
}
function accessibleEmployeeIds(user){
  const emps=collection('employees').filter(e=>e.companyId===user.companyId);
  if(!user.allowedBranchIds?.length) return new Set(emps.map(e=>e.id));
  return new Set(emps.filter(e=>user.allowedBranchIds.includes(e.branchId)).map(e=>e.id));
}
function scoped(arr,user){
  let rows=arr.filter(x=>x.companyId===user.companyId);
  if(user.role==='employee' && user.employeeId){
    rows=rows.filter(x=>x.id===user.employeeId || x.employeeId===user.employeeId);
  }
  if(user.allowedBranchIds?.length){
    const ids=accessibleEmployeeIds(user);
    rows=rows.filter(x=>{
      if(x.branchId) return user.allowedBranchIds.includes(x.branchId);
      if(x.employeeId) return ids.has(x.employeeId);
      return true;
    });
  }
  return rows;
}
function findCompanyScoped(name,id,user){ return collection(name).find(x=>x.id===id && x.companyId===user.companyId); }
function parseDate(d){ const x=new Date(d); return Number.isNaN(x.getTime())?null:x; }
function within(date,start,end){ const d=parseDate(date), a=parseDate(start), b=parseDate(end); return d&&a&&b&&d>=a&&d<=b; }

function annualTax(annual){
  const t=safe(annual);
  if(t<=250000) return 0;
  if(t<=400000) return (t-250000)*0.15;
  if(t<=800000) return 22500+(t-400000)*0.20;
  if(t<=2000000) return 102500+(t-800000)*0.25;
  if(t<=8000000) return 402500+(t-2000000)*0.30;
  return 2202500+(t-8000000)*0.35;
}
function periodTax(taxable, frequency){
  const t=safe(taxable);
  const tables={
    'Monthly':[[20833,0,0,20833],[33332,0,0.15,20833],[66666,1875,0.20,33332],[166666,8541.8,0.25,66666],[666666,33541.8,0.30,166666],[Infinity,183541.8,0.35,666666]],
    'Semi-Monthly':[[10417,0,0,10417],[16666,0,0.15,10417],[33332,937.5,0.20,16667],[83332,4270.7,0.25,33333],[333332,16770.7,0.30,83333],[Infinity,91770.7,0.35,333333]],
    'Weekly':[[4808,0,0,4808],[7691,0,0.15,4808],[15384,432.6,0.20,7692],[38461,1971.2,0.25,15385],[153845,7740.45,0.30,38462],[Infinity,42355.65,0.35,153846]],
    'Daily':[[685,0,0,685],[1095,0,0.15,685],[2191,61.65,0.20,1096],[5478,280.85,0.25,2192],[21917,1102.6,0.30,5479],[Infinity,6034,0.35,21918]]
  };
  const tbl=tables[frequency]||tables.Monthly;
  const idx=tbl.findIndex(r=>t<=r[0]); const r=tbl[idx<0?tbl.length-1:idx]; if(r[2]===0)return 0; return money(r[1]+Math.max(0,t-r[3])*r[2]);
}
function statutory(employee, gross, period, companySettings){
  const s=companySettings;
  const ss=s.sss.enabled ? Math.min(Math.max(gross,s.sss.minMSC),s.sss.maxMSC) : 0;
  const sssEE=s.sss.enabled?money(ss*s.sss.employeeRate):0;
  const sssER=s.sss.enabled?money(ss*s.sss.employerRate + (ss>=s.sss.ecThresholdMSC?s.sss.ecHigh:s.sss.ecLow)):0;
  const mbs=Math.min(Math.max(safe(employee.basicSalary),s.philhealth.floor),s.philhealth.ceiling);
  const phTotal=s.philhealth.enabled?money(mbs*s.philhealth.rate):0;
  const phEE=s.philhealth.enabled?money(phTotal*s.philhealth.employeeShare):0;
  const phER=s.philhealth.enabled?money(phTotal-phEE):0;
  const fs=Math.min(Math.max(safe(employee.basicSalary),0),s.pagibig.maxFundSalary);
  let piEERate=fs<=s.pagibig.threshold?s.pagibig.lowRateEmployee:s.pagibig.highRateEmployee;
  const piEE=s.pagibig.enabled?money(fs*piEERate):0;
  const piER=s.pagibig.enabled?money(fs*s.pagibig.employerRate):0;
  return {sssEE,sssER,philhealthEE:phEE,philhealthER:phER,pagibigEE:piEE,pagibigER:piER};
}
function computePayrollForEmployee(employee, period, settings){
  const att=collection('attendance').filter(a=>a.companyId===employee.companyId && a.employeeId===employee.id && within(a.date,period.startDate,period.endDate));
  const approvedLeaves=collection('leaveRequests').filter(l=>l.companyId===employee.companyId&&l.employeeId===employee.id&&l.status==='Approved');
  const absences=att.filter(a=>String(a.status).toLowerCase()==='absent').length;
  const lateMinutes=att.reduce((x,a)=>x+safe(a.lateMinutes),0);
  const undertimeMinutes=att.reduce((x,a)=>x+safe(a.undertimeMinutes),0);
  const otHours=att.reduce((x,a)=>x+safe(a.otHours),0);
  const holidayHours=att.reduce((x,a)=>x+safe(a.holidayHours),0);
  const nightHours=att.reduce((x,a)=>x+safe(a.nightDiffHours),0);
  const workDays=att.filter(a=>['Present','Late','Holiday'].includes(a.status)).length;
  const group=(settings.workGroups||{})[employee.workGroup]||{};
  const dailyRate = employee.payType==='Daily' ? safe(employee.basicSalary) : safe(employee.basicSalary)/(settings.payroll.daysPerMonth||26);
  const hourlyRate = dailyRate/(settings.payroll.hoursPerDay||8);
  const cutoffFactor = period.payFrequency==='Semi-Monthly' ? settings.payroll.semiMonthlyFactor : 1;
  let regularPay = employee.payType==='Hourly' ? safe(employee.basicSalary)*Math.max(workDays,0)*(settings.payroll.hoursPerDay||8) : safe(employee.basicSalary)*cutoffFactor;
  if(employee.payType==='Daily') regularPay=dailyRate*Math.max(workDays,0);
  const absenceDeduction=dailyRate*absences;
  const lateDeduction=hourlyRate*(lateMinutes/60);
  const undertimeDeduction=hourlyRate*(undertimeMinutes/60);
  const otPay=hourlyRate*otHours*(safe(group.otMultiplier)||settings.payroll.otMultiplier);
  const holidayPay=hourlyRate*holidayHours*(safe(group.holidayMultiplier)||settings.payroll.holidayMultiplier);
  const ndPay=hourlyRate*nightHours*(safe(group.nightDiffRate)||settings.payroll.nightDiffRate);
  const allowance=safe(employee.allowances)*cutoffFactor;
  const gross=money(regularPay+otPay+holidayPay+ndPay+allowance);
  const stat=statutory(employee,gross,period,settings);
  const taxableGross=money(Math.max(0,gross-stat.sssEE-stat.philhealthEE-stat.pagibigEE));
  const withholding= settings.tax.enabled ? periodTax(taxableGross, period.payFrequency||'Monthly') : 0;
  const loans=collection('loans').filter(l=>l.companyId===employee.companyId&&l.employeeId===employee.id&&l.status==='Active');
  const loanDeduction=money(loans.reduce((x,l)=>x+safe(l.amortization),0));
  const other=collection('deductions').filter(d=>d.companyId===employee.companyId&&d.employeeId===employee.id&&d.status==='Active');
  const otherDeduction=money(other.reduce((x,d)=>x+safe(d.amount),0));
  const totalDed=money(absenceDeduction+lateDeduction+undertimeDeduction+stat.sssEE+stat.philhealthEE+stat.pagibigEE+withholding+loanDeduction+otherDeduction);
  return {
    id:uid('pr'), companyId:employee.companyId, periodId:period.id, employeeId:employee.id,
    employeeNo:employee.employeeNo, employeeName:`${employee.firstName} ${employee.lastName}`,
    regularPay:money(regularPay), overtimePay:money(otPay), holidayPay:money(holidayPay), nightDiffPay:money(ndPay), allowances:money(allowance),
    grossPay:gross, absenceDeduction:money(absenceDeduction), lateDeduction:money(lateDeduction), undertimeDeduction:money(undertimeDeduction),
    sssEE:stat.sssEE, sssER:stat.sssER, philhealthEE:stat.philhealthEE, philhealthER:stat.philhealthER, pagibigEE:stat.pagibigEE, pagibigER:stat.pagibigER,
    withholdingTax:withholding, loanDeduction, otherDeduction, totalDeductions:totalDed, netPay:money(gross-totalDed),
    metrics:{absences,lateMinutes,undertimeMinutes,otHours,holidayHours,nightHours,workDays}, status:'Draft', computedAt:now()
  };
}

function timeToMinutes(t){if(!t)return null;const [h,m]=String(t).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;}
function deriveAttendance(row){
  const emp=collection('employees').find(e=>e.id===row.employeeId);
  if(!emp||!row.timeIn)return row;
  const schedule=collection('schedules').find(s=>s.id===(row.scheduleId||emp.scheduleId));
  if(!schedule)return row;
  let tin=timeToMinutes(row.timeIn), tout=timeToMinutes(row.timeOut); const sin=timeToMinutes(schedule.start), sout=timeToMinutes(schedule.end);
  if(tin!=null&&sin!=null){row.lateMinutes=Math.max(0,tin-(sin+safe(schedule.graceMinutes)));}
  if(tout!=null&&sout!=null){let end=sout;if(end<=sin)end+=1440;let actual=tout;if(actual<sin)actual+=1440;const scheduled=Math.max(0,end-sin-safe(schedule.breakMinutes));const worked=Math.max(0,actual-tin-safe(schedule.breakMinutes));row.undertimeMinutes=Math.max(0,scheduled-worked);row.otHours=Math.max(0,(worked-scheduled)/60);if(tin<end&&tin>=1260&&tin<1440)row.nightDiffHours=Math.max(safe(row.nightDiffHours),Math.min(worked/60,8));}
  const holiday=collection('holidays').find(h=>h.companyId===emp.companyId&&h.date===row.date&&h.active!==false);if(holiday&&row.status==='Present')row.holidayHours= safe(row.holidayHours)||(schedule?Math.max(0,(tout||tin)-tin-safe(schedule.breakMinutes))/60:0);
  return row;
}
function exportCSV(rows){
  if(!rows.length) return '';
  const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
  const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  return keys.join(',')+'\n'+rows.map(r=>keys.map(k=>esc(typeof r[k]==='object'?JSON.stringify(r[k]):r[k])).join(',')).join('\n');
}

const server=http.createServer(async (req,res)=>{
  try{
    const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(req.method==='GET' && u.pathname.startsWith('/api/')){
      if(u.pathname==='/api/health') return send(res,200,{ok:true,time:now(),version:'1.0.0'});
      if(u.pathname==='/api/bootstrap'){
        const user=currentUser(req); if(!user) return send(res,401,{error:'Unauthorized'});
        const safeUsers=scoped(collection('users'),user).map(x=>({id:x.id,companyId:x.companyId,username:x.username,role:x.role,name:x.name,employeeId:x.employeeId,active:x.active,allowedBranchIds:x.allowedBranchIds||[]})); const data=Object.fromEntries(collections.filter(c=>c!=='audit').map(c=>[c,scoped(collection(c),user)])); if(data.users)data.users=safeUsers; return send(res,200,{user:{id:user.id,username:user.username,role:user.role,name:user.name,companyId:user.companyId,employeeId:user.employeeId,allowedBranchIds:user.allowedBranchIds||[]},permissions:ROLES[user.role]||[],settings:db.settings,data});
      }
      const user=currentUser(req); if(!user) return send(res,401,{error:'Unauthorized'});
      const m=u.pathname.match(/^\/api\/([^/]+)(?:\/([^/]+))?$/); if(!m) return send(res,404,{error:'Not found'});
      const resource=m[1], id=m[2];
      if(resource==='me') { const {passwordHash,token,...safeUser}=user; return send(res,200,{user:safeUser}); }
      if(resource==='reports'){
        const type=u.searchParams.get('type')||'summary';
        const emps=scoped(db.employees,user); const prs=scoped(db.payrollRecords,user); const att=scoped(db.attendance,user); const leaves=scoped(db.leaveRequests,user);
        if(type==='payroll') return send(res,200,{rows:prs,totals:{gross:prs.reduce((s,r)=>s+r.grossPay,0),net:prs.reduce((s,r)=>s+r.netPay,0),sss:prs.reduce((s,r)=>s+r.sssEE,0),philhealth:prs.reduce((s,r)=>s+r.philhealthEE,0),pagibig:prs.reduce((s,r)=>s+r.pagibigEE,0),tax:prs.reduce((s,r)=>s+r.withholdingTax,0)}});
        if(type==='attendance') return send(res,200,{rows:att,totals:{present:att.filter(a=>a.status==='Present').length,late:att.filter(a=>a.status==='Late').length,absent:att.filter(a=>a.status==='Absent').length,ot:att.reduce((s,a)=>s+safe(a.otHours),0)}});
        if(type==='leave') return send(res,200,{rows:leaves,totals:{pending:leaves.filter(l=>l.status==='Pending').length,approved:leaves.filter(l=>l.status==='Approved').length,rejected:leaves.filter(l=>l.status==='Rejected').length}});
        return send(res,200,{totals:{employees:emps.filter(e=>e.status==='Active').length,branches:scoped(db.branches,user).length,departments:scoped(db.departments,user).length,pendingLeave:leaves.filter(l=>l.status==='Pending').length,payrollCost:prs.reduce((s,r)=>s+r.grossPay,0),netPayroll:prs.reduce((s,r)=>s+r.netPay,0)}});
      }
      if(resource==='audit'){ return send(res,200,{rows:scoped(db.audit,user).slice(-500).reverse()}); }
      if(resource==='export'){
        const target=u.searchParams.get('resource'); if(!collections.includes(target)) return send(res,400,{error:'Invalid resource'});
        const csv=exportCSV(scoped(collection(target),user)); res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${target}.csv"`}); return res.end(csv);
      }
      if(!collections.includes(resource)) return send(res,404,{error:'Unknown resource'});
      let rows=scoped(collection(resource),user);
      if(id){ const row=rows.find(x=>x.id===id); return row?send(res,200,row):send(res,404,{error:'Record not found'}); }
      const q=u.searchParams.get('q')?.toLowerCase(); if(q) rows=rows.filter(x=>JSON.stringify(x).toLowerCase().includes(q));
      return send(res,200,rows);
    }
    if(req.method==='POST' && u.pathname==='/api/login'){
      const b=await readBody(req); const company=collection('companies').find(c=>c.code===b.companyCode||c.name===b.companyCode) || collection('companies')[0];
      const user=collection('users').find(x=>x.companyId===company.id&&x.username===b.username&&x.passwordHash===hash(b.password)&&x.active);
      if(!user) return send(res,401,{error:'Invalid username or password'});
      const token=crypto.randomBytes(24).toString('hex'); sessions.set(token,{...user,token}); audit(user,'LOGIN','auth',user.id,{}); save(); return send(res,200,{token,user:{id:user.id,username:user.username,role:user.role,name:user.name,companyId:user.companyId}});
    }
    if(req.method==='POST' && u.pathname==='/api/logout'){ const user=currentUser(req); if(user){audit(user,'LOGOUT','auth',user.id,{});save();sessions.delete(user.token);} return send(res,200,{ok:true}); }
    if(req.method==='POST' && u.pathname==='/api/settings'){
      const user=currentUser(req); if(!user||!can(user,'admin')) return send(res,403,{error:'Admin only'});
      const b=await readBody(req); db.settings={...db.settings,...b, payroll:{...db.settings.payroll,...(b.payroll||{})}, sss:{...db.settings.sss,...(b.sss||{})}, philhealth:{...db.settings.philhealth,...(b.philhealth||{})}, pagibig:{...db.settings.pagibig,...(b.pagibig||{})}, tax:{...db.settings.tax,...(b.tax||{})}};
      audit(user,'UPDATE','settings','global',{});save();return send(res,200,db.settings);
    }
    if(req.method==='POST' && u.pathname==='/api/biometrics/push'){
      const supplied=req.headers['x-biometric-token']; const cfg=db.settings.biometrics||{}; if(!cfg.enabled||!supplied||supplied!==cfg.pushToken)return send(res,401,{error:'Biometric push unauthorized or disabled'});
      const b=await readBody(req); const rows=Array.isArray(b.rows)?b.rows:[]; let added=0;
      for(const r of rows){const emp=collection('employees').find(e=>e.employeeNo===String(r.employeeNo||r.employee_no||'')&&e.companyId===String(b.companyId||collection('companies')[0].id)); if(!emp||!r.date)continue; const a=deriveAttendance({id:uid('att'),companyId:emp.companyId,employeeId:emp.id,employeeNo:emp.employeeNo,date:r.date,status:r.status||'Present',timeIn:r.timeIn||r.time_in||'',timeOut:r.timeOut||r.time_out||'',source:'biometric-api',createdAt:now()});collection('attendance').push(a);added++;}
      save();return send(res,200,{ok:true,added});
    }
    if(req.method==='POST' && u.pathname==='/api/import/attendance'){
      const user=currentUser(req); if(!user||!can(user,'timekeeping')) return send(res,403,{error:'Permission denied'});
      const b=await readBody(req); const rows=Array.isArray(b.rows)?b.rows:[]; let added=0;
      for(const r of rows){
        const emp=collection('employees').find(e=>e.companyId===user.companyId&&(e.employeeNo===String(r.employeeNo||r.employee_id||r.id||'')||e.id===String(r.employeeId||'')));
        if(!emp||!r.date) continue;
        const a=deriveAttendance({id:uid('att'),companyId:user.companyId,employeeId:emp.id,employeeNo:emp.employeeNo,date:r.date,status:r.status||'Present',timeIn:r.timeIn||r.time_in||'',timeOut:r.timeOut||r.time_out||'',lateMinutes:safe(r.lateMinutes||r.late_minutes),undertimeMinutes:safe(r.undertimeMinutes||r.undertime_minutes),otHours:safe(r.otHours||r.ot_hours),holidayHours:safe(r.holidayHours||r.holiday_hours),nightDiffHours:safe(r.nightDiffHours||r.night_diff_hours),source:'biometric-import',createdAt:now()});
        collection('attendance').push(a); added++;
      }
      audit(user,'IMPORT','attendance','bulk',{count:added});save();return send(res,200,{ok:true,added});
    }
    if(req.method==='POST' && u.pathname==='/api/payroll/13th-month'){
      const user=currentUser(req); if(!user||!can(user,'payroll')) return send(res,403,{error:'Payroll permission required'});
      const b=await readBody(req); const year=Number(b.year||new Date().getFullYear());
      const periods=scoped(db.payrollPeriods,user).filter(p=>new Date(p.endDate).getFullYear()===year&&p.status==='Approved'); const prs=scoped(db.payrollRecords,user);
      const emps=scoped(db.employees,user); const rows=emps.map(e=>{const r=prs.filter(x=>x.employeeId===e.id&&periods.some(p=>p.id===x.periodId));const basic=r.reduce((s,x)=>s+safe(x.regularPay),0);return {employeeId:e.id,employeeNo:e.employeeNo,employeeName:`${e.firstName} ${e.lastName}`,basicSalaryEarned:money(basic),thirteenthMonth:money(basic/12)};}).filter(x=>x.basicSalaryEarned>0);
      audit(user,'CALCULATE','13thMonth',String(year),{count:rows.length});save();return send(res,200,{year,rows,total:money(rows.reduce((s,x)=>s+x.thirteenthMonth,0))});
    }
    if(req.method==='POST' && u.pathname==='/api/payroll/generate'){
      const user=currentUser(req); if(!user||!can(user,'payroll')) return send(res,403,{error:'Payroll permission required'});
      const b=await readBody(req); const period=findCompanyScoped('payrollPeriods',b.periodId,user); if(!period) return send(res,404,{error:'Payroll period not found'});
      const emps=scoped(db.employees,user).filter(e=>e.status==='Active');
      const existing=collection('payrollRecords').filter(r=>r.companyId===user.companyId&&r.periodId===period.id); db.payrollRecords=db.payrollRecords.filter(r=>!existing.some(x=>x.id===r.id));
      const records=emps.map(e=>computePayrollForEmployee(e,period,db.settings)); db.payrollRecords.push(...records); period.status='Computed';
      audit(user,'GENERATE','payroll',period.id,{count:records.length});save();return send(res,200,{period,records});
    }
    if(req.method==='POST' && u.pathname.match(/^\/api\/payroll\/[^/]+\/approve$/)){
      const user=currentUser(req); if(!user||!can(user,'payroll:approve')) return send(res,403,{error:'Approver permission required'});
      const id=u.pathname.split('/')[3]; const period=findCompanyScoped('payrollPeriods',id,user); if(!period) return send(res,404,{error:'Payroll period not found'});
      period.status='Approved'; scoped(db.payrollRecords,user).filter(r=>r.periodId===id).forEach(r=>r.status='Approved'); audit(user,'APPROVE','payroll',id,{}); save(); return send(res,200,period);
    }
    if(req.method==='POST' && u.pathname.match(/^\/api\/attendance\/[^/]+\/approve$/)){
      const user=currentUser(req);if(!user||!can(user,'timekeeping:approve'))return send(res,403,{error:'Timekeeping approval required'});const id=u.pathname.split('/')[3];const row=findCompanyScoped('attendance',id,user);if(!row)return send(res,404,{error:'Attendance record not found'});row.adjustmentStatus='Approved';row.approvedBy=user.id;row.approvedAt=now();audit(user,'APPROVE','attendance',id,{});save();return send(res,200,row);
    }
    if(req.method==='POST' && u.pathname.match(/^\/api\/leave\/[^/]+\/decision$/)){
      const user=currentUser(req); if(!user||!can(user,'leave:approve')) return send(res,403,{error:'Approval permission required'});
      const id=u.pathname.split('/')[3]; const row=findCompanyScoped('leaveRequests',id,user); if(!row) return send(res,404,{error:'Leave request not found'});
      const b=await readBody(req); row.status=b.decision==='approve'?'Approved':'Rejected'; row.approvedBy=user.id; row.approvedAt=now(); row.comments=b.comments||''; audit(user,row.status.toUpperCase(),'leaveRequests',id,{comments:row.comments});save();return send(res,200,row);
    }
    if(req.method==='POST' && u.pathname==='/api/change-password'){
      const user=currentUser(req);if(!user)return send(res,401,{error:'Unauthorized'}); const b=await readBody(req); if(!b.currentPassword||hash(b.currentPassword)!==user.passwordHash)return send(res,400,{error:'Current password is incorrect'}); const target=collection('users').find(x=>x.id===user.id);target.passwordHash=hash(b.newPassword);audit(user,'PASSWORD_CHANGE','users',user.id,{});save();return send(res,200,{ok:true});
    }
    if(req.method==='POST' || req.method==='PUT' || req.method==='DELETE'){
      const user=currentUser(req); if(!user)return send(res,401,{error:'Unauthorized'});
      const m=u.pathname.match(/^\/api\/([^/]+)(?:\/([^/]+))?$/); if(!m)return send(res,404,{error:'Not found'}); const resource=m[1],id=m[2];
      if(!collections.includes(resource)||resource==='audit'||resource==='companies')return send(res,404,{error:'Unknown resource'});
      const permissionMap={employees:'employees',users:'admin',branches:'branches',departments:'branches',positions:'branches',schedules:'timekeeping',holidays:'timekeeping',attendance:'timekeeping',leaveTypes:'leave',leaveRequests:'leave',loans:'payroll',deductions:'payroll',payrollPeriods:'payroll',payrollRecords:'payroll',documents:'employees'};
      let perm=permissionMap[resource]||resource;
      if(req.method==='DELETE'&&!can(user,'admin')&&resource==='users')return send(res,403,{error:'Admin only'});
      if(resource==='leaveRequests' && req.method==='PUT' && !can(user,'leave:approve')) perm='leave:self';
      if(!can(user,perm) && !can(user,`${perm}:read`) && !can(user,'*')) return send(res,403,{error:'Permission denied'});
      const col=collection(resource);
      if(req.method==='GET'){
        if(id){const row=col.find(x=>x.id===id&&x.companyId===user.companyId);return row?send(res,200,row):send(res,404,{error:'Record not found'});}
        return send(res,200,scoped(col,user));
      }
      if(req.method==='DELETE'){
        const idx=col.findIndex(x=>x.id===id&&x.companyId===user.companyId); if(idx<0)return send(res,404,{error:'Record not found'}); const old=col[idx]; if((resource==='payrollPeriods'&&old.status==='Approved')||(resource==='payrollRecords'&&old.status==='Approved')) return send(res,409,{error:'Approved payroll records are locked and cannot be deleted'}); col.splice(idx,1);audit(user,'DELETE',resource,id,{record:old});save();return send(res,200,{ok:true});
      }
      const b=await readBody(req);
      if(req.method==='POST'){
        const row={...b,id:b.id||uid(resource.slice(0,3)),companyId:user.companyId,createdAt:b.createdAt||now(),updatedAt:now()}; if(resource==='attendance') { deriveAttendance(row); row.adjustmentStatus=(user.role==='admin'||can(user,'timekeeping:approve'))?'Approved':'Pending'; } if(resource==='attendance'&&safe(row.lateMinutes)>0&&row.status==='Present') row.status='Late'; if(resource==='users') row.passwordHash=hash(b.password||'ChangeMe123!'); delete row.password;
        col.push(row); audit(user,'CREATE',resource,row.id,{fields:Object.keys(b).filter(k=>k!=='password')});save();return send(res,201,row);
      }
      const idx=col.findIndex(x=>x.id===id&&x.companyId===user.companyId);if(idx<0)return send(res,404,{error:'Record not found'}); const old=col[idx]; const row={...old,...b,id:old.id,companyId:old.companyId,updatedAt:now()};if(resource==='attendance'){deriveAttendance(row);row.adjustmentStatus=(user.role==='admin'||can(user,'timekeeping:approve'))?'Approved':'Pending';}if(resource==='attendance'&&safe(row.lateMinutes)>0&&row.status==='Present') row.status='Late';if(resource==='users'&&b.password){row.passwordHash=hash(b.password);delete row.password;}col[idx]=row;audit(user,'UPDATE',resource,id,{before:old,after:row});save();return send(res,200,row);
    }
    return serveStatic(res,u.pathname);
  }catch(err){console.error(err);return send(res,500,{error:'Server error',detail:err.message});}
});

server.listen(PORT,()=>console.log(`DEGZ Enterprise HRIS running on http://localhost:${PORT}`));
