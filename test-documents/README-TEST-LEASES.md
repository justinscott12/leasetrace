# Test Lease Documents

Use these test leases to verify LegalTrace is working correctly. Each document has different compliance levels:

## Test Lease 1: Violations (`test-lease-1-violations.txt`)
**Expected Compliance Score: 30-50%**

**Issues to expect:**
- ❌ 3-day notice period (should be 7 days minimum per Fla. Stat. § 83.56)
- ❌ Security deposit can be used "for any purpose" (violates Fla. Stat. § 83.49)
- ❌ Landlord not responsible for common area repairs (violates Fla. Stat. § 83.51)
- ❌ Immediate re-entry without notice (violates Fla. Stat. § 83.56)
- ❌ Missing security deposit return requirements
- ❌ Missing landlord entry notice requirements

**What to look for:**
- Low compliance score
- Multiple recommendations
- Missing clauses identified

---

## Test Lease 2: Compliant (`test-lease-2-compliant.txt`)
**Expected Compliance Score: 85-95%**

**Compliant features:**
- ✅ 7-day notice period (Fla. Stat. § 83.56)
- ✅ Security deposit handling per Fla. Stat. § 83.49
- ✅ Landlord obligations clearly stated (Fla. Stat. § 83.51)
- ✅ Proper entry notice requirements (Fla. Stat. § 83.53)
- ✅ Security deposit return within 15 days
- ✅ Reasonable assignment/subletting terms

**What to look for:**
- High compliance score
- Few or no recommendations
- Minimal missing clauses

---

## Test Lease 3: Minimal (`test-lease-3-minimal.txt`)
**Expected Compliance Score: 10-30%**

**Major issues:**
- ❌ Extremely short (missing most required clauses)
- ❌ 2-day notice period (way too short)
- ❌ No security deposit return provisions
- ❌ Vague landlord/tenant obligations
- ❌ Missing most Florida Chapter 83 requirements

**What to look for:**
- Very low compliance score
- Many missing clauses identified
- Multiple recommendations

---

## Test Lease 4: Moderate Issues (`test-lease-4-moderate-issues.txt`)
**Expected Compliance Score: 50-70%**

**Issues:**
- ⚠️ 5-day notice period (should be 7 days per Fla. Stat. § 83.56)
- ⚠️ Security deposit handling not fully compliant with Fla. Stat. § 83.49
- ⚠️ Missing explicit security deposit return timeline
- ⚠️ Vague entry notice requirements
- ✅ Most other provisions are reasonable

**What to look for:**
- Moderate compliance score
- Some recommendations
- A few missing clauses

---

## How to Test

1. **Start with Test Lease 2 (Compliant)** - Should get high score, few issues
2. **Try Test Lease 1 (Violations)** - Should get low score, many issues
3. **Try Test Lease 3 (Minimal)** - Should get very low score, many missing clauses
4. **Try Test Lease 4 (Moderate)** - Should get medium score, some issues

## Expected Behavior

- **Compliance scores** should reflect the issues in each document
- **Recommendations** should cite specific Florida statutes (Chapter 83)
- **Missing clauses** should suggest adding required provisions
- **Statute references** should be found and displayed in the Audit Trail

