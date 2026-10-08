# DEGZ Enterprise HRIS & Philippine Payroll

A complete working HRIS + Payroll web application for Philippine operations. It runs as a local web server with a persistent JSON database and requires Node.js 18+.

## Client requirement coverage

- Employee Masterlist / 201 Files
- Personal, employment, compensation and government ID records
- 201-file document metadata + optional file attachment storage
- Biometrics CSV import
- Generic biometric push API adapter endpoint
- Attendance / DTR
- Assigned shifting schedules
- Automatic late / undertime / overtime derivation from time-in/out
- Holiday and night-differential fields/rules
- Manual time adjustment with approval state
- Payroll periods / cutoff
- Regular pay, OT, holiday pay, night differential, allowances
- Absences, late, undertime deductions
- SSS, PhilHealth and Pag-IBIG employee/employer shares
- BIR compensation withholding calculation tables
- Loans and recurring deductions
- Payroll generation, review, approval and locking
- Employee payslips with print view
- 13th-month computation from approved payroll history
- Leave types, requests, approvals, balances and history
- Multiple branches, departments, positions and employee groups
- Role-based access: Admin, HR, Payroll, Accounting, Manager, Approver, Employee
- Branch-scoped access for users with an Allowed Branch
- Audit trail / payroll history
- Dashboard KPIs and charts
- Payroll, attendance, leave and employee report center
- CSV export for operational and accounting workflows
- Responsive desktop/tablet/Android UI
- Light/dark mode

## Run

1. Install Node.js 18+.
2. Open a terminal in this folder.
3. Run `node server.js` or double-click `START-HRIS-WINDOWS.bat` on Windows.
4. Open `http://localhost:3030`.

No npm packages are required.

## Demo accounts

- Admin: `admin / admin123`
- HR: `hr / hr123`
- Payroll: `payroll / payroll123`

Change passwords before real client use.

## Biometrics

The generic integration has two paths:

1. CSV import from the Timekeeping page.
2. Generic push endpoint: `POST /api/biometrics/push` using header `x-biometric-token` and a JSON body such as:

```json
{
  "companyId": "COMPANY_ID",
  "rows": [
    {"employeeNo":"EMP-0001","date":"2026-10-08","timeIn":"08:59","timeOut":"18:03"}
  ]
}
```

Actual SDK/API communication still depends on the client's biometric device/model. The adapter endpoint is designed so a device-specific connector can be added without rebuilding the HRIS UI.

## Philippine statutory configuration

The app keeps statutory rates/configuration in Settings so they can be updated without changing payroll source code. The bundled defaults are based on official published references available during development, including:

- SSS: 15% SS contribution rate effective January 2025, 5% employee / 10% employer, maximum MSC ₱35,000; ECP employer contribution is also represented in employer cost calculation.
- PhilHealth: 5% premium rate with ₱10,000 income floor and ₱100,000 ceiling in the latest official premium advisory located for 2025.
- Pag-IBIG: employee 1% for monthly compensation at or below ₱1,500 and 2% above ₱1,500, employer counterpart 2%; the official circular also states the maximum monthly compensation used for mandatory contributions as ₱5,000.
- BIR: compensation tax table effective January 1, 2023 onwards, including the ₱250,000 tax-free bracket and the 15% / 20% / 25% / 30% / 35% graduated schedule.

Always verify the latest SSS, PhilHealth, Pag-IBIG and BIR circulars/tables before processing a live payroll period or filing statutory reports. This software is not a government-certified filing system by itself.

## Data and security

The local JSON database is stored in `data/db.json` and is company-scoped. For multi-server production deployment, migrate the storage layer to a managed relational database and place the application behind HTTPS with managed secrets, backups, MFA, monitoring, access logging and secure document storage.
