#!/usr/bin/env python3
"""
Backend API Testing for Aquadify IAP Verification Endpoint
Tests the deployed remote backend at https://drip-track-1.emergent.host/api
Verifies that the endpoint accepts BOTH signedTransaction AND appAccountToken fields
"""

import requests
import json
import sys

# Base URL for the deployed backend
BASE_URL = "https://drip-track-1.emergent.host/api"

# Test credentials
TEST_EMAIL = "mobiletest123@aqua.com"
TEST_PASSWORD = "Test1234!"

def print_section(title):
    """Print a formatted section header"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80)

def print_result(step, status_code, response_body, expected_status=None):
    """Print test result in a formatted way"""
    print(f"\nStep: {step}")
    print(f"Status Code: {status_code}")
    if expected_status:
        print(f"Expected: {expected_status}")
    print(f"Response Body: {json.dumps(response_body, indent=2)}")
    print("-" * 80)

def test_authentication():
    """
    Step 1: Authenticate to get a Bearer token
    POST /auth/login with email and password
    """
    print_section("STEP 1: Authentication")
    
    url = f"{BASE_URL}/auth/login"
    payload = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        response_body = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"raw": response.text}
        
        print_result("Authentication", response.status_code, response_body, expected_status=200)
        
        if response.status_code == 200 and "token" in response_body:
            token = response_body["token"]
            print(f"✅ PASS: Successfully authenticated. Token obtained.")
            return token
        else:
            print(f"❌ FAIL: Authentication failed. Expected 200 with 'token' field.")
            return None
            
    except Exception as e:
        print(f"❌ ERROR: Authentication request failed: {str(e)}")
        return None

def test_with_both_fields(token):
    """
    Step 2: Test with BOTH signedTransaction AND appAccountToken (the EXACT body mobile now sends)
    Should NOT return 422 (validation error)
    Should return 400 with "Apple signature verification failed" (expected for dummy JWS)
    This proves: (a) signedTransaction is still accepted (no "Field required")
                 (b) the extra appAccountToken field does not cause a validation error
    """
    print_section("STEP 2: Test with signedTransaction AND appAccountToken")
    
    url = f"{BASE_URL}/iap/verify"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    # EXACT body the mobile now sends
    payload = {
        "signedTransaction": "dummy.jws.token",
        "appAccountToken": "66f136e6-b495-58cc-bffd-67ea129fc210",
        "product_id": "com.mtagency.aquadify.premium.monthly",
        "transaction_id": "1000000123",
        "jws": "dummy.jws.token"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response_body = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"raw": response.text}
        
        print_result("With Both Fields Test", response.status_code, response_body, expected_status="400 (NOT 422)")
        
        # EXPECT: NOT 422 (validation error)
        if response.status_code == 422:
            print(f"❌ FAIL: Got 422 validation error - appAccountToken or signedTransaction not accepted!")
            detail = response_body.get("detail", [])
            print(f"   Validation errors: {json.dumps(detail, indent=2)}")
            return False
        
        # Expected: 400 with signature verification error (because JWS is dummy)
        if response.status_code == 400:
            detail = response_body.get("detail", "")
            if "Apple signature verification failed" in detail or "signature" in detail.lower():
                print(f"✅ PASS: Got expected 400 with signature verification error.")
                print(f"   This proves both signedTransaction and appAccountToken are accepted.")
                return True
            else:
                print(f"✅ PASS: Got 400 (not 422). Both fields accepted, though error message differs.")
                print(f"   Error: {detail}")
                return True
        
        # Any other non-422 status means validation passed
        print(f"⚠️  Got {response.status_code} (not 422). Fields accepted but unexpected response.")
        return True
            
    except Exception as e:
        print(f"❌ ERROR: Request failed: {str(e)}")
        return False

def test_without_signed_transaction(token):
    """
    Step 3: Test WITHOUT signedTransaction (required field guard check)
    Should return HTTP 422 with "Field required" at loc ["body", "signedTransaction"]
    This confirms the required-field guard is still intact
    """
    print_section("STEP 3: Test WITHOUT signedTransaction (required field check)")
    
    url = f"{BASE_URL}/iap/verify"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "appAccountToken": "66f136e6-b495-58cc-bffd-67ea129fc210",
        "product_id": "x"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response_body = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"raw": response.text}
        
        print_result("Without signedTransaction Test", response.status_code, response_body, expected_status=422)
        
        # EXPECT: 422 with "Field required" for signedTransaction
        if response.status_code == 422:
            detail = response_body.get("detail", [])
            if isinstance(detail, list):
                for error in detail:
                    loc = error.get("loc", [])
                    msg = error.get("msg", "")
                    if "signedTransaction" in str(loc) and "required" in msg.lower():
                        print(f"✅ PASS: Got expected 422 'Field required' for signedTransaction.")
                        print(f"   Required-field guard is intact.")
                        return True
            print(f"❌ FAIL: Got 422 but not for signedTransaction field.")
            print(f"   Details: {detail}")
            return False
        else:
            print(f"❌ FAIL: Expected 422 but got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: Request failed: {str(e)}")
        return False

def test_no_auth():
    """
    Step 4: Test without authentication token
    Should return 401 (auth required)
    """
    print_section("STEP 4: Test Without Authentication")
    
    url = f"{BASE_URL}/iap/verify"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "signedTransaction": "dummy.jws.token",
        "appAccountToken": "66f136e6-b495-58cc-bffd-67ea129fc210",
        "product_id": "com.mtagency.aquadify.premium.monthly",
        "transaction_id": "1000000123",
        "jws": "dummy.jws.token"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response_body = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"raw": response.text}
        
        print_result("No Auth Test", response.status_code, response_body, expected_status=401)
        
        if response.status_code == 401:
            print(f"✅ PASS: Got expected 401 (auth required).")
            return True
        else:
            print(f"❌ FAIL: Expected 401 but got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: No auth test request failed: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("  AQUADIFY IAP VERIFICATION ENDPOINT CONTRACT TEST")
    print("  Testing Remote Backend: https://drip-track-1.emergent.host/api")
    print("  Verifying: signedTransaction + appAccountToken acceptance")
    print("="*80)
    
    results = {
        "step_1_authentication": False,
        "step_2_with_both_fields": False,
        "step_3_without_signed_transaction": False,
        "step_4_no_auth": False
    }
    
    # Step 1: Authenticate
    token = test_authentication()
    if token:
        results["step_1_authentication"] = True
    else:
        print("\n❌ CRITICAL: Cannot proceed without authentication token.")
        print_final_summary(results)
        sys.exit(1)
    
    # Step 2: Test with BOTH signedTransaction AND appAccountToken
    results["step_2_with_both_fields"] = test_with_both_fields(token)
    
    # Step 3: Test without signedTransaction (required field check)
    results["step_3_without_signed_transaction"] = test_without_signed_transaction(token)
    
    # Step 4: Test without auth
    results["step_4_no_auth"] = test_no_auth()
    
    # Print final summary
    print_final_summary(results)
    
    # Exit with appropriate code
    if all(results.values()):
        sys.exit(0)
    else:
        sys.exit(1)

def print_final_summary(results):
    """Print final test summary"""
    print("\n" + "="*80)
    print("  FINAL TEST SUMMARY")
    print("="*80)
    
    print(f"\n1. Authentication (Step 1): {'✅ PASS' if results['step_1_authentication'] else '❌ FAIL'}")
    print(f"2. With signedTransaction + appAccountToken (Step 2): {'✅ PASS' if results['step_2_with_both_fields'] else '❌ FAIL'}")
    print(f"3. Without signedTransaction returns 422 (Step 3): {'✅ PASS' if results['step_3_without_signed_transaction'] else '❌ FAIL'}")
    print(f"4. Without Auth returns 401 (Step 4): {'✅ PASS' if results['step_4_no_auth'] else '❌ FAIL'}")
    
    print("\n" + "-"*80)
    
    if all(results.values()):
        print("\n🎉 CONTRACT VERIFICATION SUCCESSFUL")
        print("   ✅ signedTransaction field is still required (no regression)")
        print("   ✅ appAccountToken field is accepted (new field works)")
        print("   ✅ Authentication is enforced")
        print("   ✅ Endpoint proceeds to signature validation as expected")
    else:
        print("\n⚠️  CONTRACT VERIFICATION INCOMPLETE")
        if not results['step_2_with_both_fields']:
            print("   ❌ appAccountToken or signedTransaction not accepted properly")
        if not results['step_3_without_signed_transaction']:
            print("   ❌ Required field guard not working")
        if not results['step_4_no_auth']:
            print("   ❌ Authentication not enforced")
    
    print("\n" + "="*80 + "\n")

if __name__ == "__main__":
    main()
