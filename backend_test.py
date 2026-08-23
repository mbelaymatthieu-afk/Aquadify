#!/usr/bin/env python3
"""
Backend API Testing for Aquadify Premium Purchase Flow Bug Fix
Tests the deployed remote backend at https://drip-track-1.emergent.host/api
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

def test_old_broken_body(token):
    """
    Step 2: Test the OLD (broken) body without signedTransaction
    Should return HTTP 422 with "Field required" for signedTransaction
    """
    print_section("STEP 2: Test OLD Broken Body (without signedTransaction)")
    
    url = f"{BASE_URL}/iap/verify"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "product_id": "com.mtagency.aquadify.premium.monthly",
        "transaction_id": "1000000123",
        "jws": "dummy.jws.token"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response_body = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"raw": response.text}
        
        print_result("OLD Body Test", response.status_code, response_body, expected_status=422)
        
        # Check if we got 422 with the expected error
        if response.status_code == 422:
            detail = response_body.get("detail", [])
            if isinstance(detail, list):
                for error in detail:
                    if (error.get("type") == "missing" and 
                        error.get("loc") == ["body", "signedTransaction"] and
                        "Field required" in error.get("msg", "")):
                        print(f"✅ PASS: Got expected 422 error for missing 'signedTransaction' field.")
                        return True
            print(f"❌ FAIL: Got 422 but error details don't match expected format.")
            return False
        else:
            print(f"❌ FAIL: Expected 422 but got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: Old body test request failed: {str(e)}")
        return False

def test_fixed_body(token):
    """
    Step 3: Test the FIXED body with signedTransaction
    Should NOT return 422 "Field required" error
    Should return 400 with signature verification error (expected for dummy JWS)
    """
    print_section("STEP 3: Test FIXED Body (with signedTransaction)")
    
    url = f"{BASE_URL}/iap/verify"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "signedTransaction": "dummy.jws.token",
        "product_id": "com.mtagency.aquadify.premium.monthly",
        "transaction_id": "1000000123",
        "jws": "dummy.jws.token"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response_body = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"raw": response.text}
        
        print_result("FIXED Body Test", response.status_code, response_body, expected_status="400 (signature validation error)")
        
        # Check that we did NOT get 422 "Field required" for signedTransaction
        if response.status_code == 422:
            detail = response_body.get("detail", [])
            if isinstance(detail, list):
                for error in detail:
                    if (error.get("loc") == ["body", "signedTransaction"] and
                        "Field required" in error.get("msg", "")):
                        print(f"❌ FAIL: Still getting 422 'Field required' for signedTransaction. Bug NOT fixed.")
                        return False
            print(f"⚠️  Got 422 but NOT for missing signedTransaction. Different validation error.")
            return True
        
        # Expected: 400 with signature verification error
        if response.status_code == 400:
            detail = response_body.get("detail", "")
            if "signature" in detail.lower() or "verification" in detail.lower() or "Apple" in detail or "invalid" in detail.lower():
                print(f"✅ PASS: Got expected 400 error (signature validation). The 'Field required' error is GONE. Bug is FIXED.")
                return True
            else:
                print(f"✅ PASS: Got 400 (not 422 'Field required'). The schema now matches. Bug is FIXED.")
                print(f"   Note: Error message is: {detail}")
                return True
        
        # Any other status code (not 422 with Field required) means the field is accepted
        print(f"✅ PASS: Got {response.status_code} (not 422 'Field required'). The signedTransaction field is now accepted. Bug is FIXED.")
        return True
            
    except Exception as e:
        print(f"❌ ERROR: Fixed body test request failed: {str(e)}")
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
    print("  AQUADIFY PREMIUM PURCHASE FLOW BUG FIX VERIFICATION")
    print("  Testing Remote Backend: https://drip-track-1.emergent.host/api")
    print("="*80)
    
    results = {
        "authentication": False,
        "old_body_422": False,
        "fixed_body_no_422": False,
        "no_auth_401": False
    }
    
    # Step 1: Authenticate
    token = test_authentication()
    if token:
        results["authentication"] = True
    else:
        print("\n❌ CRITICAL: Cannot proceed without authentication token.")
        print_final_summary(results)
        sys.exit(1)
    
    # Step 2: Test old broken body
    results["old_body_422"] = test_old_broken_body(token)
    
    # Step 3: Test fixed body
    results["fixed_body_no_422"] = test_fixed_body(token)
    
    # Step 4: Test without auth
    results["no_auth_401"] = test_no_auth()
    
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
    
    print(f"\n1. Authentication (Step 1): {'✅ PASS' if results['authentication'] else '❌ FAIL'}")
    print(f"2. Old Body Returns 422 (Step 2): {'✅ PASS' if results['old_body_422'] else '❌ FAIL'}")
    print(f"3. Fixed Body NO 422 'Field required' (Step 3): {'✅ PASS' if results['fixed_body_no_422'] else '❌ FAIL'}")
    print(f"4. No Auth Returns 401 (Step 4): {'✅ PASS' if results['no_auth_401'] else '❌ FAIL'}")
    
    print("\n" + "-"*80)
    
    if results['fixed_body_no_422']:
        print("\n🎉 BUG FIX VERIFIED: The 'signedTransaction' field is now accepted by the backend.")
        print("   The 422 'Field required' error for 'signedTransaction' is RESOLVED.")
    else:
        print("\n⚠️  BUG NOT FIXED: The backend still requires the 'signedTransaction' field fix.")
    
    print("\n" + "="*80 + "\n")

if __name__ == "__main__":
    main()
