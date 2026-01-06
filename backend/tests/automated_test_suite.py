"""Automated test suite for LegalTrace that runs audits and validates results."""

import asyncio
import json
import os
from pathlib import Path
from typing import Dict, List, Optional

import httpx

# Test expectations
TEST_EXPECTATIONS = {
    "lease-violations.txt": {
        "min_compliance_score": 0.4,  # Should be low due to violations
        "max_compliance_score": 0.7,
        "expected_violations": [
            "10 days",  # Should flag 10-day notice issue
            "83.56",  # Should reference this statute
        ],
        "expected_recommendations": True,  # Should have recommendations
        "expected_missing_clauses": True,  # Should identify missing clauses
    },
    "lease-minimal.txt": {
        "min_compliance_score": 0.1,  # Very low - minimal document
        "max_compliance_score": 0.4,
        "expected_violations": [
            "5 days",  # Should flag 5-day notice issue
        ],
        "expected_recommendations": True,
        "expected_missing_clauses": True,
    },
    "lease-compliant.txt": {
        "min_compliance_score": 0.75,  # Should be high - compliant document
        "max_compliance_score": 1.0,
        "expected_violations": [],
        "expected_recommendations": False,  # Should have few/no recommendations
        "expected_missing_clauses": False,
    },
}


async def run_audit(document_path: Path, base_url: str = "http://localhost:8000", max_retries: int = 3) -> Dict:
    """Run an audit on a test document with retry logic for rate limits."""
    # Read document
    with open(document_path, "r") as f:
        document_text = f.read()
    
    doc_size = len(document_text)
    print(f"    Document size: {doc_size:,} characters")
    
    async with httpx.AsyncClient(timeout=120.0) as client:  # Increased timeout for large documents
        data = None
        for attempt in range(max_retries):
            # Start audit with retry logic for rate limits
            try:
                response = await client.post(
                    f"{base_url}/audit",
                    data={"document_text": document_text},
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                break  # Success, exit retry loop
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 500:
                    # Check if it's a rate limit error
                    try:
                        error_detail = e.response.json().get("detail", "")
                        if "rate_limit" in error_detail.lower() or "429" in error_detail:
                            if attempt < max_retries - 1:
                                wait_time = (attempt + 1) * 5  # Exponential backoff: 5s, 10s, 15s
                                print(f"    Rate limit hit, waiting {wait_time}s before retry {attempt + 2}/{max_retries}...")
                                await asyncio.sleep(wait_time)
                                continue
                    except:
                        pass
                # If not rate limit or max retries reached, raise
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(2)
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(2)
        
        if data is None:
            raise Exception("Failed to start audit after retries")
        
        thread_id = data["thread_id"]
        initial_state = data.get("state", {})
        
        # Check if already completed from initial response
        if initial_state.get("compliance_score") is not None:
            return {
                "thread_id": thread_id,
                "state": initial_state,
                "status": "completed",
            }
        
        # Poll for completion (allow longer time for large documents)
        max_polls = 600  # 10 minutes max (poll every 1 second) - allows for large documents
        poll_count = 0
        last_node = None
        last_score = None
        node_stuck_count = 0  # Track if we're stuck on the same node
        no_progress_count = 0  # Track if nothing is changing
        
        while poll_count < max_polls:
            await asyncio.sleep(1)
            poll_count += 1
            
            # Print progress every 30 seconds
            if poll_count % 30 == 0:
                print(f"    Still processing... ({poll_count}s elapsed, node: {last_node or 'unknown'})")
            
            try:
                trace_response = await client.get(
                    f"{base_url}/audit/{thread_id}/trace",
                    timeout=10.0,
                )
                if trace_response.status_code == 200:
                    trace_data = trace_response.json()
                    current_state = trace_data.get("current_state", {})
                    current_node = current_state.get("current_node", "unknown")
                    current_score = current_state.get("compliance_score")
                    
                    # Detect if we're stuck on the same node (potential infinite loop)
                    if current_node == last_node and current_node not in ["human_review", None, "unknown"]:
                        node_stuck_count += 1
                        if node_stuck_count > 120:  # Stuck for 2 minutes on same node
                            print(f"    ⚠️  Warning: Stuck on node '{current_node}' for 2+ minutes, may be in a loop")
                            # Return what we have rather than waiting forever
                            return {
                                "thread_id": thread_id,
                                "state": current_state,
                                "status": "stuck",
                            }
                    else:
                        if current_node != last_node:
                            print(f"    → Node: {current_node}")
                        node_stuck_count = 0  # Reset counter if node changed
                        last_node = current_node
                    
                    # Detect if compliance score is changing (progress indicator)
                    if current_score is not None and current_score != last_score:
                        print(f"    ✓ Compliance score: {current_score:.2f}")
                        last_score = current_score
                        no_progress_count = 0
                    elif current_score == last_score and current_score is not None:
                        no_progress_count += 1
                    
                    # Check if audit is complete
                    if current_score is not None:
                        # Give it a moment to finalize, then return
                        await asyncio.sleep(2)
                        return {
                            "thread_id": thread_id,
                            "state": current_state,
                            "status": "completed",
                        }
                    
                    # Check if waiting for human review
                    if current_node == "human_review":
                        # Auto-approve to continue
                        try:
                            await client.post(
                                f"{base_url}/audit/{thread_id}/approve",
                                json={"action": "approve", "user_feedback": "Auto-approved for testing"},
                                timeout=10.0,
                            )
                            print(f"    Auto-approved human review, continuing...")
                            no_progress_count = 0  # Reset - we made progress
                        except:
                            pass  # Continue polling even if approve fails
                        continue
            except Exception as e:
                # Continue polling on errors, but log if it's persistent
                if poll_count % 60 == 0:  # Log every minute if errors persist
                    print(f"    Polling error (will continue): {str(e)[:100]}")
                continue
        
        # Timeout - return initial state if available, otherwise empty
        return {
            "thread_id": thread_id,
            "state": initial_state if initial_state.get("compliance_score") else {},
            "status": "timeout",
        }


def validate_results(document_name: str, results: Dict, expectations: Dict) -> Dict:
    """Validate audit results against expectations."""
    state = results.get("state", {})
    compliance_score = state.get("compliance_score", 0.0)
    recommendations = state.get("recommendations", [])
    missing_clauses = state.get("missing_clauses", [])
    analysis = state.get("compliance_analysis", "")
    findings = state.get("extracted_findings", [])
    
    issues = []
    warnings = []
    
    # Check compliance score range
    if compliance_score < expectations["min_compliance_score"]:
        issues.append(
            f"Compliance score {compliance_score:.2f} is below minimum expected {expectations['min_compliance_score']:.2f}"
        )
    elif compliance_score > expectations["max_compliance_score"]:
        warnings.append(
            f"Compliance score {compliance_score:.2f} is above maximum expected {expectations['max_compliance_score']:.2f}"
        )
    
    # Check for expected violations
    analysis_lower = analysis.lower()
    findings_text = " ".join([f.get("clause_text", "") for f in findings]).lower()
    combined_text = (analysis_lower + " " + findings_text).lower()
    
    for violation in expectations.get("expected_violations", []):
        if violation.lower() not in combined_text:
            warnings.append(f"Expected violation '{violation}' not found in analysis or findings")
    
    # Check recommendations
    if expectations.get("expected_recommendations"):
        if not recommendations or len(recommendations) == 0:
            issues.append("Expected recommendations but none were provided")
    else:
        if recommendations and len(recommendations) > 0:
            warnings.append(f"Unexpected recommendations found: {len(recommendations)}")
    
    # Check missing clauses
    if expectations.get("expected_missing_clauses"):
        if not missing_clauses or len(missing_clauses) == 0:
            issues.append("Expected missing clauses but none were identified")
    else:
        if missing_clauses and len(missing_clauses) > 0:
            warnings.append(f"Unexpected missing clauses found: {len(missing_clauses)}")
    
    # Check statute references
    statute_refs = state.get("statute_references", [])
    if len(statute_refs) == 0:
        issues.append("No statute references found - RAG search may have failed")
    
    return {
        "document": document_name,
        "compliance_score": compliance_score,
        "num_recommendations": len(recommendations),
        "num_missing_clauses": len(missing_clauses),
        "num_statute_refs": len(statute_refs),
        "issues": issues,
        "warnings": warnings,
        "passed": len(issues) == 0,
    }


async def run_test_suite(
    test_documents_dir: Path,
    base_url: str = "http://localhost:8000",
    max_iterations: int = 2,  # Reduced iterations
) -> Dict:
    """Run the full test suite with iterative improvement."""
    results = []
    all_passed = False
    iteration = 0
    
    while not all_passed and iteration < max_iterations:
        iteration += 1
        print(f"\n{'='*60}")
        print(f"Test Iteration {iteration}/{max_iterations}")
        print(f"{'='*60}\n")
        
        iteration_results = []
        
        # Run tests in parallel for speed
        async def test_document(doc_name: str, expectations: Dict) -> Dict:
            doc_path = test_documents_dir / doc_name
            if not doc_path.exists():
                return {
                    "document": doc_name,
                    "passed": False,
                    "error": "File not found",
                }
            
            try:
                # Run audit
                audit_results = await run_audit(doc_path, base_url)
                
                # Validate results
                validation = validate_results(doc_name, audit_results, expectations)
                return validation
            except Exception as e:
                return {
                    "document": doc_name,
                    "passed": False,
                    "error": str(e),
                }
        
        # Run tests sequentially to avoid rate limits
        # (OpenAI has TPM limits that parallel tests can exceed)
        print("Running tests sequentially (to avoid rate limits)...")
        test_results = []
        for idx, (doc_name, expectations) in enumerate(TEST_EXPECTATIONS.items(), 1):
            print(f"\n[{idx}/{len(TEST_EXPECTATIONS)}] Testing: {doc_name}")
            result = await test_document(doc_name, expectations)
            test_results.append(result)
            # Small delay between tests to avoid rate limits
            if idx < len(TEST_EXPECTATIONS):
                await asyncio.sleep(2)
        
        # Process results
        for result in test_results:
            if isinstance(result, Exception):
                print(f"  ❌ ERROR: {str(result)}")
                iteration_results.append({
                    "document": "unknown",
                    "passed": False,
                    "error": str(result),
                })
            else:
                validation = result
                iteration_results.append(validation)
                
                # Print results
                status = "✅ PASS" if validation.get("passed", False) else "❌ FAIL"
                score = validation.get("compliance_score", 0.0)
                print(f"  {status} - {validation.get('document', 'unknown')} - Score: {score:.2f}")
                
                if validation.get("issues"):
                    for issue in validation["issues"][:2]:  # Show first 2 issues only
                        print(f"      - {issue}")
        
        results.append({
            "iteration": iteration,
            "results": iteration_results,
        })
        
        # Check if all passed
        all_passed = all(r.get("passed", False) for r in iteration_results)
        
        if all_passed:
            print(f"\n✅ All tests passed in iteration {iteration}!")
            break
        else:
            failed_count = sum(1 for r in iteration_results if not r.get("passed", False))
            print(f"\n⚠️  {failed_count} test(s) failed. Analyzing issues...")
            
            # Analyze common issues
            common_issues = {}
            for result in iteration_results:
                if not result.get("passed"):
                    for issue in result.get("issues", []):
                        common_issues[issue] = common_issues.get(issue, 0) + 1
            
            if common_issues:
                print("\nCommon issues found:")
                for issue, count in sorted(common_issues.items(), key=lambda x: x[1], reverse=True):
                    print(f"  - {issue} ({count} occurrences)")
            
            if iteration < max_iterations:
                print(f"\nAnalyzing failures for fixes...")
                # Don't wait - immediately proceed to next iteration
    
    # Summary
    print(f"\n{'='*60}")
    print("TEST SUITE SUMMARY")
    print(f"{'='*60}\n")
    
    total_tests = sum(len(r["results"]) for r in results)
    passed_tests = sum(
        sum(1 for res in r["results"] if res.get("passed", False))
        for r in results
    )
    
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Iterations: {iteration}")
    print(f"Final Status: {'✅ ALL PASSED' if all_passed else '❌ SOME FAILED'}")
    
    return {
        "all_passed": all_passed,
        "iterations": iteration,
        "total_tests": total_tests,
        "passed_tests": passed_tests,
        "results": results,
    }


if __name__ == "__main__":
    import sys
    
    test_dir = Path(__file__).parent.parent.parent / "test-documents"
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    
    print("LegalTrace Automated Test Suite")
    print(f"Test Documents: {test_dir}")
    print(f"Backend URL: {base_url}\n")
    
    if not test_dir.exists():
        print(f"❌ Test documents directory not found: {test_dir}")
        sys.exit(1)
    
    results = asyncio.run(run_test_suite(test_dir, base_url))
    
    sys.exit(0 if results["all_passed"] else 1)

